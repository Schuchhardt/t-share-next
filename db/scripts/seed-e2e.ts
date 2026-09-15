/**
 * Deterministic fixtures for the Playwright suite.
 *
 *   npm run db:seed:e2e          # create or refresh them
 *   npm run db:seed:e2e -- --drop   # remove them
 *
 * The rows sit at ids from 900000 up, above the migrated data, and are
 * upserted, so running this twice is the same as running it once. The teacher
 * it creates carries a Laravel-style `$2y$` hash on purpose: that is what the
 * forced-password-change test needs in order to be a real test.
 *
 * Being the highest ids in the table has a consequence worth knowing: once the
 * sequences are re-seeded past them, every new row the app writes also lands
 * above 900000. Nothing here may clean up by id range alone — see `dropE2E`.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { E2E } from './e2e-fixtures';

config({ path: '.env.local', quiet: true });

function client(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  return createClient(url, key, { auth: { persistSession: false } });
}

/** PHP's password_hash writes the same digest under a `$2y$` prefix. */
async function legacyHash(password: string): Promise<string> {
  const hash = await bcrypt.hash(password, 10);
  return `$2y$${hash.slice(4)}`;
}

async function upsert(db: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  const { error } = await db.from(table).upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`${table}: ${error.message}`);
}

export async function dropE2E(db: SupabaseClient = client()) {
  // Children first; the schema cascades, but being explicit keeps the order
  // obvious if a table is added later.
  const order: [string, number[]][] = [
    ['tshare_activity_resources', [900030]],
    ['tshare_activity_instructions', [900031, 900032]],
    ['tshare_activity_materials', [900033]],
    ['tshare_activity_skills', [900034]],
    ['tshare_activity_subject_grades', [900035, 900036]],
    ['tshare_comments', [900037]],
    ['tshare_saved_activities', [900038]],
    ['tshare_activities', [E2E.activity.id, E2E.quietActivity.id]],
    ['tshare_users', [E2E.legacyUser.id, E2E.modernUser.id, E2E.recoveryUser.id]],
    ['tshare_subject_grades', [E2E.subjectGrade.id]],
    ['tshare_subjects', [E2E.subject.id, E2E.otherSubject.id]],
    ['tshare_grades', [E2E.grade.id]],
    ['tshare_skills', [E2E.skill.id]],
    ['tshare_resource_types', [E2E.resourceType.id]],
    ['tshare_countries', [E2E.country.id]],
  ];
  for (const [table, ids] of order) {
    const { error } = await db.from(table).delete().in('id', ids);
    if (error) throw new Error(`drop ${table}: ${error.message}`);
  }
  // Anything the tests created themselves. Scoped to the fixture accounts, and
  // that is not belt and braces: the identity sequence now issues ids *above*
  // 900000, because the fixtures are the highest rows in the table. An id range
  // on its own would take every activity a real teacher publishes from here on
  // with it.
  const { error } = await db
    .from('tshare_activities')
    .delete()
    .gte('id', 900000)
    .in('user_id', [E2E.legacyUser.id, E2E.modernUser.id, E2E.recoveryUser.id]);
  if (error) throw new Error(`drop stray activities: ${error.message}`);
}

async function insert(db: SupabaseClient) {
  await upsert(db, 'tshare_countries', [{ id: E2E.country.id, name: E2E.country.name }]);
  await upsert(db, 'tshare_subjects', [
    { id: E2E.subject.id, name: E2E.subject.name, country_id: E2E.country.id },
    { id: E2E.otherSubject.id, name: E2E.otherSubject.name, country_id: E2E.country.id },
  ]);
  await upsert(db, 'tshare_grades', [
    { id: E2E.grade.id, name: E2E.grade.name, description: E2E.grade.description },
  ]);
  await upsert(db, 'tshare_subject_grades', [
    { id: E2E.subjectGrade.id, subject_id: E2E.subject.id, grade_id: E2E.grade.id },
  ]);
  await upsert(db, 'tshare_skills', [{ id: E2E.skill.id, name: E2E.skill.name }]);
  await upsert(db, 'tshare_resource_types', [
    { id: E2E.resourceType.id, name: E2E.resourceType.name },
  ]);

  // Every row carries the same keys on purpose: a PostgREST upsert sends one
  // column list for the whole batch, so a field present on only one of them
  // arrives as null on the others — and `login_attempts` is not nullable.
  // Zero is also what the recovery specs need as a starting point.
  await upsert(db, 'tshare_users', [
    {
      id: E2E.legacyUser.id,
      email: E2E.legacyUser.email,
      first_name: E2E.legacyUser.firstName,
      last_name: E2E.legacyUser.lastName,
      // The whole point of this fixture: a hash written by the old PHP app,
      // with the flag the migration sets.
      password_hash: await legacyHash(E2E.legacyUser.password),
      must_change_password: true,
      is_active: true,
      login_attempts: 0,
    },
    {
      id: E2E.modernUser.id,
      email: E2E.modernUser.email,
      first_name: E2E.modernUser.firstName,
      last_name: E2E.modernUser.lastName,
      password_hash: await bcrypt.hash(E2E.modernUser.password, 10),
      must_change_password: false,
      is_active: true,
      login_attempts: 0,
    },
    {
      id: E2E.recoveryUser.id,
      email: E2E.recoveryUser.email,
      first_name: E2E.recoveryUser.firstName,
      last_name: E2E.recoveryUser.lastName,
      password_hash: await bcrypt.hash(E2E.recoveryUser.password, 10),
      must_change_password: false,
      is_active: true,
      login_attempts: 0,
    },
  ]);

  const now = new Date().toISOString();
  await upsert(db, 'tshare_activities', [
    {
      id: E2E.activity.id,
      title: E2E.activity.title,
      learning_objective: E2E.activity.objective,
      description: 'Una actividad creada por el seed de pruebas.',
      evaluation: 'Se evalúa que el test pase.',
      duration_minutes: 45,
      user_id: E2E.modernUser.id,
      created_at: now,
      updated_at: now,
    },
    {
      id: E2E.quietActivity.id,
      title: E2E.quietActivity.title,
      learning_objective: 'Una actividad sin archivos adjuntos',
      duration_minutes: 30,
      user_id: E2E.modernUser.id,
      created_at: now,
      updated_at: now,
    },
  ]);

  await upsert(db, 'tshare_activity_subject_grades', [
    { id: 900035, activity_id: E2E.activity.id, subject_grade_id: E2E.subjectGrade.id },
    { id: 900036, activity_id: E2E.quietActivity.id, subject_grade_id: E2E.subjectGrade.id },
  ]);
  await upsert(db, 'tshare_activity_skills', [
    { id: 900034, activity_id: E2E.activity.id, skill_id: E2E.skill.id },
  ]);
  await upsert(db, 'tshare_activity_resources', [
    {
      id: 900030,
      activity_id: E2E.activity.id,
      resource_type_id: E2E.resourceType.id,
      name: 'Guía de la actividad E2E',
      external_url: 'https://example.org/guia-e2e.pdf',
    },
  ]);
  await upsert(db, 'tshare_activity_instructions', [
    { id: 900031, activity_id: E2E.activity.id, name: 'Inicio', body: 'Se parte con una pregunta.' },
    { id: 900032, activity_id: E2E.activity.id, name: 'Cierre', body: 'Se cierra con una puesta en común.' },
  ]);
  await upsert(db, 'tshare_activity_materials', [
    { id: 900033, activity_id: E2E.activity.id, name: 'Plumones E2E' },
  ]);
}

/**
 * Removes anything a previous run left behind, then writes the fixtures fresh.
 * Playwright's global setup calls this, so a suite that changes the migrated
 * teacher's password still starts from a known state next time.
 */
export async function seedE2E(db: SupabaseClient = client()): Promise<void> {
  await dropE2E(db);
  await insert(db);
}

/** Only when run as a script; the Playwright setup imports the functions. */
if (process.argv[1]?.endsWith('seed-e2e.ts')) {
  const run = async () => {
    const db = client();
    if (process.argv.includes('--drop')) {
      await dropE2E(db);
      console.log('E2E fixtures removed.');
      return;
    }
    await seedE2E(db);
    console.log(
      `E2E fixtures ready (activity #${E2E.activity.id}, users ${E2E.legacyUser.email} / ${E2E.modernUser.email}).`,
    );
  };
  run().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
