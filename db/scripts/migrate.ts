/**
 * Loads the legacy CSV export into Supabase.
 *
 *   npm run db:migrate                 # load everything
 *   npm run db:migrate -- --dry-run    # parse and validate, write nothing
 *   npm run db:migrate -- --only tshare_users,tshare_activities
 *
 * Reads `LEGACY_EXPORT_DIR`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
 * from `.env.local`. Idempotent: rows are upserted on their primary key, so a
 * re-run repairs a partial load instead of duplicating it.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { SPECS, type MigrationContext, type TableSpec } from '../legacy-map';
import { DEFAULT_EXPORT_DIR, buildRows } from './loader';

config({ path: '.env.local', quiet: true });

const CHUNK = 500;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyArg = args.indexOf('--only');
const only =
  onlyArg === -1 ? null : new Set((args[onlyArg + 1] ?? '').split(',').filter(Boolean));

function client(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function load(db: SupabaseClient, spec: TableSpec, ctx: MigrationContext) {
  const { kept, dropped } = buildRows(spec, ctx);
  ctx.known.set(spec.table, new Set(kept.map((r) => String(r.id))));

  if (dryRun) {
    console.log(`  ${spec.table.padEnd(34)} ${String(kept.length).padStart(6)} rows (dry run)`);
    return;
  }

  for (let i = 0; i < kept.length; i += CHUNK) {
    const slice = kept.slice(i, i + CHUNK);
    const { error } = await db.from(spec.table).upsert(slice, { onConflict: 'id' });
    if (error) {
      throw new Error(
        `${spec.table}: rows ${i}-${i + slice.length} failed — ${error.message}` +
          (error.details ? ` (${error.details})` : ''),
      );
    }
    process.stdout.write(`\r  ${spec.table.padEnd(34)} ${i + slice.length}/${kept.length}`);
  }
  const suffix = dropped ? `  (${dropped} duplicate rows collapsed)` : '';
  console.log(`\r  ${spec.table.padEnd(34)} ${String(kept.length).padStart(6)} rows${suffix}`);
}

async function main() {
  const db = client();
  const ctx: MigrationContext = { known: new Map(), notes: [] };
  const specs = only ? SPECS.filter((s) => only.has(s.table)) : SPECS;

  if (only && specs.length !== only.size) {
    throw new Error(`Unknown table in --only: ${[...only].join(', ')}`);
  }

  console.log(`Reading ${DEFAULT_EXPORT_DIR}`);
  console.log(dryRun ? 'Dry run — nothing is written.\n' : 'Loading into Supabase.\n');

  const started = Date.now();
  for (const spec of specs) {
    await load(db, spec, ctx);
  }

  if (!dryRun) {
    // The counter triggers fired during the load, but an upsert re-run would
    // count the same row twice — recompute both counters from source.
    const { error: counterError } = await db.rpc('tshare_refresh_activity_counters');
    if (counterError) {
      console.warn(`\nCould not refresh activity counters: ${counterError.message}`);
    }

    const { data, error } = await db.rpc('tshare_reset_sequences');
    if (error) {
      console.warn(`\nCould not reset sequences: ${error.message}`);
      console.warn('Run `select tshare_reset_sequences();` by hand before the app inserts rows.');
    } else {
      console.log(`\nIdentity sequences re-seeded (${(data as unknown[])?.length ?? 0} tables).`);
    }
  }

  if (ctx.notes.length) {
    console.log(`\n${ctx.notes.length} rows needed a decision:`);
    for (const note of ctx.notes.slice(0, 20)) {
      console.log(`  ${note.table} #${note.id} — ${note.reason}`);
    }
    if (ctx.notes.length > 20) console.log(`  … and ${ctx.notes.length - 20} more`);
  }

  console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s.`);
}

main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
