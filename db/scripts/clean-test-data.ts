/**
 * Removes everything the Playwright suite leaves behind — rows *and* the files
 * they put in S3.
 *
 *   npm run db:clean:test           # muestra qué borraría, sin tocar nada
 *   npm run db:clean:test -- --yes  # lo borra
 *
 * It exists because the suite runs against a real project. Every pass seeds
 * the fixtures and publishes a couple of activities, and those are the newest
 * rows in the table: left alone they take over "Agregadas recientemente" on
 * the landing page and push the real classes out of it. `db:seed:e2e --drop`
 * already removes the rows; this also collects the S3 keys first, which
 * nothing else did, so a 3 MB PDF per run stopped accumulating in the bucket.
 *
 * It cleans whichever project `SUPABASE_URL` names, and prints it before doing
 * anything. To clean a different one, point the variables at it for the single
 * command:
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npm run db:clean:test -- --yes
 *
 * Nothing here matches on an id range. The fixtures are the highest rows in
 * the table, so the identity sequences hand out ids above them, and `id >=
 * 900000` would take real activities with it. What it deletes instead is what
 * belongs to the fixture accounts, plus rows whose titles are the ones the
 * specs generate — a timestamp, which no teacher will ever type.
 */

import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { appendFileSync } from 'node:fs';
import { E2E } from './e2e-fixtures';
import { dropE2E } from './seed-e2e';

config({ path: '.env.local', quiet: true });

const apply = process.argv.includes('--yes');

const FIXTURE_USERS: number[] = [E2E.legacyUser.id, E2E.modernUser.id, E2E.recoveryUser.id];

/**
 * Titles the specs build as `Actividad publicada ${Date.now()}`. The 13 digits
 * are what make this safe to run against a live catalogue.
 *
 * It is a safety net rather than the main path: an activity belongs to the
 * fixture account that published it, so deleting the account already takes it.
 * This catches the leftovers of a run whose fixture ids have since changed in
 * `e2e-fixtures.ts`, which nothing else would ever reach.
 */
const TEST_TITLES = ['Actividad publicada 1%', 'Actividad con adjuntos 1%'];
const TEST_TITLE_RE = /^(Actividad publicada|Actividad con adjuntos) \d{13}$/;

/** Tables that hold an S3 object key, and the column holding it. */
const FILE_COLUMNS: [table: string, column: string][] = [
  ['tshare_activity_resources', 'file_key'],
  ['tshare_activity_instructions', 'file_key'],
  ['tshare_activity_materials', 'file_key'],
];

function db(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  return createClient(url, key, { auth: { persistSession: false } });
}

type Doomed = {
  users: { id: number; email: string; avatar_key: string | null }[];
  activities: { id: number; title: string; user_id: number }[];
  comments: number;
  keys: string[];
};

/** Everything this script would remove, gathered before anything is deleted. */
async function survey(supabase: SupabaseClient): Promise<Doomed> {
  const users = (
    await supabase
      .from('tshare_users')
      .select('id, email, avatar_key')
      .in('id', FIXTURE_USERS)
  ).data as Doomed['users'] | null;

  // Owned by a fixture account, or titled the way the specs title things.
  const byOwner = (
    await supabase
      .from('tshare_activities')
      .select('id, title, user_id, cover_image_key, pdf_key')
      .in('user_id', FIXTURE_USERS)
  ).data as (Doomed['activities'][number] & {
    cover_image_key: string | null;
    pdf_key: string | null;
  })[] | null;

  const byTitle: typeof byOwner = [];
  for (const pattern of TEST_TITLES) {
    const { data } = await supabase
      .from('tshare_activities')
      .select('id, title, user_id, cover_image_key, pdf_key')
      .like('title', pattern);
    for (const row of (data ?? []) as NonNullable<typeof byOwner>) {
      // `like` is a prefix match; the regex is what actually decides.
      if (TEST_TITLE_RE.test(row.title)) byTitle.push(row);
    }
  }

  const activities = [...(byOwner ?? []), ...byTitle].filter(
    (row, i, all) => all.findIndex((r) => r.id === row.id) === i,
  );
  const ids = activities.map((a) => a.id);

  const keys = new Set<string>();
  for (const a of activities) {
    if (a.cover_image_key) keys.add(a.cover_image_key);
    if (a.pdf_key) keys.add(a.pdf_key);
  }
  for (const u of users ?? []) if (u.avatar_key) keys.add(u.avatar_key);

  if (ids.length) {
    for (const [table, column] of FILE_COLUMNS) {
      const { data } = await supabase.from(table).select(column).in('activity_id', ids);
      for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
        const key = row[column];
        if (key) keys.add(key);
      }
    }
  }

  const { count: comments } = await supabase
    .from('tshare_comments')
    .select('id', { head: true, count: 'exact' })
    .in('user_id', FIXTURE_USERS);

  return {
    users: users ?? [],
    activities: activities.map(({ id, title, user_id }) => ({ id, title, user_id })),
    comments: comments ?? 0,
    keys: [...keys],
  };
}

/**
 * Where a key goes when the bucket refuses to delete it. Once the row is gone
 * nothing else remembers that object exists, so the alternative to writing it
 * down is an orphan nobody can ever find again.
 */
const ORPHANS = 'db/.orphaned-s3-keys.txt';

/**
 * Deletes the collected objects. Keys only ever come from rows this script is
 * removing, so there is no pattern here that could sweep up a migrated file.
 *
 * Returns the keys it could not delete. The production credentials are
 * PutObject/GetObject only — no `s3:DeleteObject` — so in practice this is
 * every key until somebody widens that policy.
 */
async function deleteFiles(keys: string[]): Promise<string[]> {
  const bucket = process.env.S3_BUCKET;
  if (!bucket || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    console.warn('  S3 sin configurar: los archivos quedan en el bucket.');
    return keys;
  }
  const s3 = new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });

  const failed: string[] = [];
  let denied = false;
  for (let i = 0; i < keys.length; i += 1000) {
    const slice = keys.slice(i, i + 1000);
    const out = await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: slice.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    for (const err of out.Errors ?? []) {
      if (err.Key) failed.push(err.Key);
      if (err.Code === 'AccessDenied') denied = true;
      else console.warn(`  ${err.Key}: ${err.Message}`);
    }
  }

  if (denied) {
    console.warn(
      '  El bucket rechaza el borrado: estas credenciales no tienen s3:DeleteObject.\n' +
        '  Los archivos quedan donde están; agrega el permiso en IAM y vuelve a correrlo.',
    );
  }
  return failed;
}

async function main() {
  const supabase = db();
  console.log(`Proyecto: ${process.env.SUPABASE_URL}\n`);

  const doomed = await survey(supabase);
  const nothing =
    !doomed.users.length && !doomed.activities.length && !doomed.comments && !doomed.keys.length;

  console.log(`  cuentas de prueba      ${doomed.users.length}`);
  for (const u of doomed.users) console.log(`      ${u.id}  ${u.email}`);
  console.log(`  actividades            ${doomed.activities.length}`);
  for (const a of doomed.activities) console.log(`      ${a.id}  ${a.title}`);
  console.log(`  comentarios            ${doomed.comments}`);
  console.log(`  archivos en S3         ${doomed.keys.length}`);
  for (const k of doomed.keys) console.log(`      ${k}`);

  if (nothing) {
    console.log('\nNo hay nada que limpiar.');
    return;
  }

  if (!apply) {
    console.log('\nNada se borró. Agrega --yes para hacerlo.');
    return;
  }

  console.log('');
  // Files first: once the rows are gone, nothing remembers these keys.
  const failed = await deleteFiles(doomed.keys);
  console.log(`Archivos borrados del bucket: ${doomed.keys.length - failed.length}/${doomed.keys.length}`);
  if (failed.length) {
    // The rows still go — stale activities on the landing page are the urgent
    // half — but the keys are written down so the objects stay findable.
    appendFileSync(ORPHANS, failed.map((k) => `${k}\n`).join(''));
    console.log(`Las ${failed.length} claves que quedaron sin borrar están anotadas en ${ORPHANS}.`);
  }

  // Titled leftovers whose owner is not a fixture any more: nothing cascades
  // to them, so they go by id before the accounts do.
  const orphans = doomed.activities.filter((a) => !FIXTURE_USERS.includes(a.user_id));
  if (orphans.length) {
    const { error } = await supabase
      .from('tshare_activities')
      .delete()
      .in('id', orphans.map((a) => a.id));
    if (error) throw new Error(`borrar actividades sueltas: ${error.message}`);
    console.log(`Actividades sueltas borradas: ${orphans.length}`);
  }

  // The fixtures themselves, and everything that cascades off them.
  await dropE2E(supabase);
  console.log('Fixtures y lo que colgaba de ellas: borrado.');

  const left = await survey(supabase);
  if (left.users.length || left.activities.length || left.comments) {
    console.log('\nQuedó algo sin borrar:');
    console.log(`  cuentas ${left.users.length}, actividades ${left.activities.length}, comentarios ${left.comments}`);
    process.exitCode = 1;
  } else {
    console.log('\nLa base quedó sin datos de prueba.');
  }
}

main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
