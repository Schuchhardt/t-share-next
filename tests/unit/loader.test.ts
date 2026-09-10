import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TableSpec } from "../../db/legacy-map";
import { dedupe, readCsv } from "../../db/scripts/loader";

/**
 * The loader's two jobs: read the export positionally rather than by header,
 * and collapse the rows the old database repeated.
 */

const spec: TableSpec = {
  csv: "toy.csv",
  table: "tshare_toy",
  legacy: ["id", "name", "email"],
  uniqueBy: ["email"],
  map: (r) => ({ id: Number(r.id), name: r.name, email: r.email }),
};

function fixture(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "tshare-loader-"));
  writeFileSync(join(dir, "toy.csv"), contents, "utf8");
  return dir;
}

describe("readCsv", () => {
  it("ignores the alphabetical header and reads by position", () => {
    // This is the shape the export actually has: the header is sorted, the
    // values are not. Reading by name would put the email under `id`.
    const dir = fixture("email,id,name\n28,Angela,angela@example.cl\n");
    expect(readCsv(spec, dir)).toEqual([
      { id: "28", name: "Angela", email: "angela@example.cl" },
    ]);
  });

  it("strips the BOM the exporter left on every file", () => {
    const dir = fixture("﻿email,id,name\n28,Angela,angela@example.cl\n");
    expect(readCsv(spec, dir)[0]!.id).toBe("28");
  });

  it("keeps quoted commas and embedded newlines inside one field", () => {
    const dir = fixture('email,id,name\n1,"Palma, Angela\nsegunda línea",a@b.cl\n');
    const rows = readCsv(spec, dir);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Palma, Angela\nsegunda línea");
  });

  it("refuses a file whose column count no longer matches the declared order", () => {
    const dir = fixture("a,b,c,d\n1,2,3,4\n");
    expect(() => readCsv(spec, dir)).toThrow(/expected 3 columns, file has 4/);
  });
});

describe("dedupe", () => {
  it("collapses rows the export repeated verbatim", () => {
    const rows = [
      { id: 1, email: "a@b.cl" },
      { id: 1, email: "a@b.cl" },
      { id: 2, email: "c@d.cl" },
    ];
    const { kept, dropped } = dedupe(rows);
    expect(kept).toHaveLength(2);
    expect(dropped).toBe(1);
  });

  it("also collapses distinct ids that would collide on a unique index", () => {
    // `roles_users` and friends hold repeated (user, role) pairs under
    // different ids; the new schema has a unique index on the pair.
    const rows = [
      { id: 1, email: "a@b.cl" },
      { id: 7, email: "a@b.cl" },
      { id: 9, email: "c@d.cl" },
    ];
    const { kept, dropped } = dedupe(rows, ["email"]);
    expect(kept.map((r) => r.id)).toEqual([1, 9]);
    expect(dropped).toBe(1);
  });

  it("keeps everything when nothing repeats", () => {
    const rows = [
      { id: 1, email: "a@b.cl" },
      { id: 2, email: "c@d.cl" },
    ];
    expect(dedupe(rows, ["email"])).toEqual({ kept: rows, dropped: 0 });
  });
});
