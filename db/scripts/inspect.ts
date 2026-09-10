/**
 * Parses the whole export without touching a database and prints what the
 * loader would write.
 *
 *   npm run db:inspect                  # a row count per table
 *   npm run db:inspect -- tshare_users  # plus the first two mapped rows
 *
 * This is the fast way to re-check `db/legacy-map.ts` after editing it.
 */

import { SPECS, type MigrationContext } from '../legacy-map';
import { buildRows } from './loader';

const wanted = new Set(process.argv.slice(2));
const ctx: MigrationContext = { known: new Map(), notes: [] };
let total = 0;

for (const spec of SPECS) {
  const { kept, dropped } = buildRows(spec, ctx);
  ctx.known.set(spec.table, new Set(kept.map((r) => String(r.id))));
  total += kept.length;

  const note = dropped ? ` (${dropped} duplicates collapsed)` : '';
  console.log(`${spec.table.padEnd(34)} ${String(kept.length).padStart(6)}${note}`);

  if (wanted.has(spec.table)) {
    for (const row of kept.slice(0, 2)) console.dir(row, { depth: null });
  }
}

console.log(`\n${total} rows across ${SPECS.length} tables.`);
if (ctx.notes.length) {
  console.log(`${ctx.notes.length} rows needed a decision:`);
  for (const note of ctx.notes) console.log(`  ${note.table} #${note.id} — ${note.reason}`);
}
