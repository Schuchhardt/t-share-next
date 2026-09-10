/**
 * Compares what is in Supabase against what the CSV export holds.
 *
 *   npm run db:verify
 *
 * Prints a row per table — expected (after de-duplication) vs. loaded — and
 * exits non-zero if any table is short, so it can gate a deploy.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { SPECS, type MigrationContext } from '../legacy-map';
import { buildRows } from './loader';

config({ path: '.env.local', quiet: true });

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  const db = createClient(url, key, { auth: { persistSession: false } });

  const ctx: MigrationContext = { known: new Map(), notes: [] };
  let short = 0;

  console.log(`${'table'.padEnd(34)} ${'expected'.padStart(9)} ${'loaded'.padStart(9)}`);
  console.log('-'.repeat(56));

  for (const spec of SPECS) {
    const { kept } = buildRows(spec, ctx);
    ctx.known.set(spec.table, new Set(kept.map((r) => String(r.id))));

    const { count, error } = await db
      .from(spec.table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`${spec.table.padEnd(34)} ${String(kept.length).padStart(9)}    ERROR  ${error.message}`);
      short += 1;
      continue;
    }

    const loaded = count ?? 0;
    const flag = loaded < kept.length ? '  <- short' : '';
    if (flag) short += 1;
    console.log(
      `${spec.table.padEnd(34)} ${String(kept.length).padStart(9)} ${String(loaded).padStart(9)}${flag}`,
    );
  }

  // Every migrated account must still be forced through a password reset.
  const { count: stale } = await db
    .from('tshare_users')
    .select('*', { count: 'exact', head: true })
    .like('password_hash', '$2y$%')
    .eq('must_change_password', false);
  if (stale) {
    console.log(`\n${stale} accounts carry a Laravel hash without must_change_password.`);
    short += 1;
  }

  if (short) {
    console.log(`\n${short} table(s) need attention.`);
    process.exit(1);
  }
  console.log('\nEverything matches.');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
