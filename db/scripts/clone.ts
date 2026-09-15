/**
 * Clones the tshare_* half of the Supabase project into a fresh project.
 *
 *   npm run db:clone -- --dump      # read the source into db/.clone/*.ndjson
 *   npm run db:clone -- --load      # write those files into the target
 *   npm run db:clone -- --verify    # compare row counts on both sides
 *   npm run db:clone -- --all       # dump, load and verify in one pass
 *
 * Source credentials are the usual `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`;
 * the target adds `NEW_SUPABASE_URL` / `NEW_SUPABASE_SERVICE_ROLE`.
 * Apply `db/schema.sql` to the target before loading — this script moves rows,
 * never DDL.
 *
 * The source project is shared with another app, so only `tshare_*` travels.
 * Files are not touched: they live in S3 and the bucket stays where it is.
 *
 * Idempotent: rows are upserted on their primary key, so a re-run repairs a
 * partial load instead of duplicating it.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { appendFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

config({ path: '.env.local', quiet: true });

/**
 * Every tshare_ table, ordered so a parent is always written before its
 * children. Derived from the foreign keys in `db/schema.sql`; no table
 * references itself, so row order inside a table never matters.
 */
const TABLES = [
  'tshare_countries',
  'tshare_grades',
  'tshare_newsletter_subscribers',
  'tshare_plans',
  'tshare_resource_types',
  'tshare_roles',
  'tshare_schools',
  'tshare_sections',
  'tshare_skills',
  'tshare_suggested_materials',
  'tshare_labels',
  'tshare_plan_features',
  'tshare_plan_roles',
  'tshare_subjects',
  'tshare_users',
  'tshare_activities',
  'tshare_events',
  'tshare_follows',
  'tshare_messages',
  'tshare_notifications',
  'tshare_password_resets',
  'tshare_payments',
  'tshare_school_users',
  'tshare_subject_equivalences',
  'tshare_subject_grades',
  'tshare_user_grades',
  'tshare_user_groups',
  'tshare_user_roles',
  'tshare_user_skills',
  'tshare_user_subjects',
  'tshare_activity_authorizations',
  'tshare_activity_downloads',
  'tshare_activity_instructions',
  'tshare_activity_materials',
  'tshare_activity_resources',
  'tshare_activity_sections',
  'tshare_activity_skills',
  'tshare_activity_subject_grades',
  'tshare_comments',
  'tshare_purchase_items',
  'tshare_saved_activities',
  'tshare_units',
  'tshare_activity_units',
  'tshare_comment_reactions',
] as const;

const PAGE = 1000;
const CHUNK = 500;
const DEFAULT_DIR = 'db/.clone';

const args = process.argv.slice(2);
const dirArg = args.indexOf('--dir');
const dir = dirArg === -1 ? DEFAULT_DIR : (args[dirArg + 1] ?? DEFAULT_DIR);
const all = args.includes('--all');
const doDump = all || args.includes('--dump');
const doLoad = all || args.includes('--load');
const doVerify = all || args.includes('--verify');

const ENV = {
  source: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  target: ['NEW_SUPABASE_URL', 'NEW_SUPABASE_SERVICE_ROLE'],
} as const;

function connect(which: 'source' | 'target'): SupabaseClient {
  const [urlVar, keyVar] = ENV[which];
  const url = process.env[urlVar];
  const key = process.env[keyVar];
  if (!url || !key) {
    throw new Error(`${urlVar} and ${keyVar} must be set (see .env.example).`);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function file(table: string) {
  return join(dir, `${table}.ndjson`);
}

async function count(db: SupabaseClient, table: string): Promise<number> {
  const { count: n, error } = await db.from(table).select('id', { head: true, count: 'exact' });
  if (error) throw new Error(`${table}: ${error.message}`);
  return n ?? 0;
}

/** Reads one table page by page, streaming it straight to disk. */
async function dumpTable(db: SupabaseClient, table: string): Promise<number> {
  rmSync(file(table), { force: true });
  let written = 0;
  for (;;) {
    const { data, error } = await db
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(written, written + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    appendFileSync(file(table), data.map((row) => JSON.stringify(row)).join('\n') + '\n');
    written += data.length;
    process.stdout.write(`\r  ${table.padEnd(34)} ${written}`);
    if (data.length < PAGE) break;
  }
  console.log(`\r  ${table.padEnd(34)} ${String(written).padStart(6)} rows`);
  return written;
}

async function loadTable(db: SupabaseClient, table: string): Promise<number> {
  let rows: Record<string, unknown>[];
  try {
    rows = readFileSync(file(table), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  } catch {
    console.log(`  ${table.padEnd(34)} (no dump file — skipped)`);
    return 0;
  }

  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await db.from(table).upsert(slice, { onConflict: 'id' });
    if (error) {
      throw new Error(
        `${table}: rows ${i}-${i + slice.length} failed — ${error.message}` +
          (error.details ? ` (${error.details})` : ''),
      );
    }
    process.stdout.write(`\r  ${table.padEnd(34)} ${i + slice.length}/${rows.length}`);
  }
  console.log(`\r  ${table.padEnd(34)} ${String(rows.length).padStart(6)} rows`);
  return rows.length;
}

async function main() {
  const started = Date.now();

  if (doDump) {
    const source = connect('source');
    mkdirSync(dir, { recursive: true });
    console.log(`Reading ${process.env.SUPABASE_URL} into ${dir}\n`);
    let total = 0;
    for (const table of TABLES) total += await dumpTable(source, table);
    console.log(`\n${total} rows dumped.\n`);
  }

  if (doLoad) {
    const target = connect('target');
    console.log(`Writing ${dir} into ${process.env.NEW_SUPABASE_URL}\n`);
    let total = 0;
    for (const table of TABLES) total += await loadTable(target, table);
    console.log(`\n${total} rows loaded.`);

    // The saved/download triggers fired on every inserted row, so the counters
    // on tshare_activities are now wrong; both helpers recompute from scratch.
    const counters = await target.rpc('tshare_refresh_activity_counters');
    if (counters.error) console.warn(`Could not refresh counters: ${counters.error.message}`);
    else console.log('Activity counters recomputed.');

    // Legacy ids were written explicitly, which leaves every sequence at 1.
    const seq = await target.rpc('tshare_reset_sequences');
    if (seq.error) {
      console.warn(`Could not reset sequences: ${seq.error.message}`);
      console.warn('Run `select tshare_reset_sequences();` by hand before the app inserts rows.');
    } else {
      console.log(`Identity sequences re-seeded (${(seq.data as unknown[])?.length ?? 0} tables).`);
    }
    console.log('');
  }

  if (doVerify) {
    const source = connect('source');
    const target = connect('target');
    console.log('Comparing row counts.\n');
    let bad = 0;
    for (const table of TABLES) {
      const [a, b] = await Promise.all([count(source, table), count(target, table)]);
      const ok = a === b;
      if (!ok) bad += 1;
      console.log(
        `  ${ok ? '✓' : '✗'} ${table.padEnd(34)} source ${String(a).padStart(6)}   target ${String(b).padStart(6)}`,
      );
    }
    console.log(bad ? `\n${bad} table(s) differ.` : '\nEvery table matches.');
    if (bad) process.exitCode = 1;
  }

  if (!doDump && !doLoad && !doVerify) {
    console.log('Nothing to do. Pass --dump, --load, --verify or --all.');
    return;
  }

  console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s.`);
}

main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
