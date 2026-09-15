import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the catalogue offers: the subject chips on the landing page and the
 * filter facets on /actividades.
 *
 * The rule is that every option has to lead somewhere. Counts and usage are
 * read from the live activities outwards, through `tshare_subject_grades` —
 * the table the search filter itself walks — so what a chip or a checkbox
 * promises is what clicking it shows. The cases below are the ways that used
 * to go wrong: an empty subject riding the alphabet onto the page, an activity
 * counted twice for being filed under two grades, a duplicated name keeping
 * the emptier of its two ids, and a facet offered straight from the
 * vocabulary table with nothing published under it.
 */

type Row = Record<string, unknown>;

/** Rows the stub serves, keyed by table. */
const tables = new Map<string, Row[]>();

function builder(table: string) {
  const rows = () => tables.get(table) ?? [];
  const self: Record<string, unknown> = {
    select() {
      return self;
    },
    is() {
      return self;
    },
    order() {
      return self;
    },
    range(from: number, to: number) {
      return Promise.resolve({ data: rows().slice(from, to + 1), error: null });
    },
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve({ data: rows(), error: null }).then(resolve);
    },
  };
  return self;
}

vi.mock("@/lib/supabase", async () => {
  const actual = await vi.importActual<typeof import("@/lib/supabase")>("@/lib/supabase");
  return { ...actual, db: () => ({ from: (table: string) => builder(table) }) };
});

const { T } = await import("@/lib/supabase");

/** `cache` memoises per module instance, so each case needs a fresh import. */
async function fresh() {
  vi.resetModules();
  return import("@/lib/catalog");
}

async function ranked(limit?: number) {
  return (await fresh()).getSubjectsWithActivities(limit);
}

/**
 * One live activity, as the usage query returns it: its subject/grade pairs,
 * its habilidades and the types of its documents.
 */
function activity(options: {
  pairs?: (number | null)[];
  skills?: number[];
  resources?: { type: number | null; deleted?: boolean }[];
}): Row {
  return {
    subject_grades: (options.pairs ?? []).map((id) => ({ subject_grade_id: id })),
    skills: (options.skills ?? []).map((id) => ({ skill_id: id })),
    resources: (options.resources ?? []).map((r) => ({
      resource_type_id: r.type,
      deleted_at: r.deleted ? "2026-01-01" : null,
    })),
  };
}

beforeEach(() => {
  tables.clear();
});

describe("getSubjectsWithActivities", () => {
  it("leaves out a subject nothing is filed under", async () => {
    tables.set(T.subjects, [
      { id: 1, name: "Arte y Cultura" },
      { id: 2, name: "Biología" },
    ]);
    tables.set(T.subjectGrades, [{ id: 10, subject_id: 1 }]);
    tables.set(T.activities, [activity({ pairs: [10] })]);

    // Biología sorts first alphabetically and would have led the old list.
    await expect(ranked()).resolves.toEqual([{ id: 1, name: "Arte y Cultura" }]);
  });

  it("orders by how many activities each one holds", async () => {
    tables.set(T.subjects, [
      { id: 1, name: "Arte y Cultura" },
      { id: 2, name: "Matemática" },
    ]);
    tables.set(T.subjectGrades, [
      { id: 10, subject_id: 1 },
      { id: 20, subject_id: 2 },
    ]);
    tables.set(T.activities, [
      activity({ pairs: [10] }),
      activity({ pairs: [20] }),
      activity({ pairs: [20] }),
    ]);

    await expect(ranked()).resolves.toEqual([
      { id: 2, name: "Matemática" },
      { id: 1, name: "Arte y Cultura" },
    ]);
  });

  it("counts an activity once even when it is filed under two grades", async () => {
    tables.set(T.subjects, [
      { id: 1, name: "Una sola actividad" },
      { id: 2, name: "Dos actividades" },
    ]);
    tables.set(T.subjectGrades, [
      { id: 10, subject_id: 1 },
      { id: 11, subject_id: 1 },
      { id: 20, subject_id: 2 },
    ]);
    tables.set(T.activities, [
      // The same activity, under two grades of the same subject.
      activity({ pairs: [10, 11] }),
      activity({ pairs: [20] }),
      activity({ pairs: [20] }),
    ]);

    await expect(ranked()).resolves.toEqual([
      { id: 2, name: "Dos actividades" },
      { id: 1, name: "Una sola actividad" },
    ]);
  });

  it("keeps the fuller of two ids sharing a name", async () => {
    // The catalogue really does hold "Matemática" and "Matemática ".
    tables.set(T.subjects, [
      { id: 1, name: "Matemática" },
      { id: 2, name: "Matemática " },
    ]);
    tables.set(T.subjectGrades, [
      { id: 10, subject_id: 1 },
      { id: 20, subject_id: 2 },
    ]);
    tables.set(T.activities, [
      activity({ pairs: [10] }),
      activity({ pairs: [20] }),
      activity({ pairs: [20] }),
    ]);

    await expect(ranked()).resolves.toEqual([{ id: 2, name: "Matemática" }]);
  });

  it("ignores a link whose pair no longer names a subject", async () => {
    tables.set(T.subjects, [{ id: 1, name: "Arte y Cultura" }]);
    tables.set(T.subjectGrades, [
      { id: 10, subject_id: 1 },
      { id: 11, subject_id: null },
    ]);
    tables.set(T.activities, [
      activity({ pairs: [10] }),
      activity({ pairs: [11] }),
      activity({ pairs: [null] }),
    ]);

    await expect(ranked()).resolves.toEqual([{ id: 1, name: "Arte y Cultura" }]);
  });

  it("stops at the limit it is given", async () => {
    tables.set(T.subjects, [
      { id: 1, name: "Uno" },
      { id: 2, name: "Dos" },
      { id: 3, name: "Tres" },
    ]);
    tables.set(T.subjectGrades, [
      { id: 10, subject_id: 1 },
      { id: 20, subject_id: 2 },
      { id: 30, subject_id: 3 },
    ]);
    tables.set(T.activities, [
      activity({ pairs: [10] }),
      activity({ pairs: [20] }),
      activity({ pairs: [30] }),
    ]);

    await expect(ranked(2)).resolves.toHaveLength(2);
  });
});

describe("getFilterCatalog", () => {
  /** A vocabulary much longer than what the one activity below uses. */
  function vocabulary() {
    tables.set(T.subjects, [
      { id: 1, name: "Matemática" },
      { id: 2, name: "Biología" },
    ]);
    tables.set(T.grades, [
      { id: 5, name: "5° básico", description: "Básica" },
      { id: 6, name: "6° básico", description: "Básica" },
    ]);
    tables.set(T.skills, [
      { id: 7, name: "Comunicación" },
      { id: 8, name: "Creatividad" },
    ]);
    tables.set(T.resourceTypes, [
      { id: 3, name: "Guía" },
      { id: 4, name: "Presentación" },
    ]);
    tables.set(T.subjectGrades, [
      { id: 10, subject_id: 1, grade_id: 5 },
      { id: 20, subject_id: 2, grade_id: 6 },
    ]);
  }

  it("offers only what a live activity carries", async () => {
    vocabulary();
    tables.set(T.activities, [activity({ pairs: [10], skills: [7], resources: [{ type: 3 }] })]);

    const catalog = await (await fresh()).getFilterCatalog();
    expect(catalog.subjects).toEqual([{ id: 1, name: "Matemática" }]);
    expect(catalog.grades).toEqual([{ id: 5, name: "5° básico", level: "Básica" }]);
    expect(catalog.skills).toEqual([{ id: 7, name: "Comunicación" }]);
    expect(catalog.resourceTypes).toEqual([{ id: 3, name: "Guía" }]);
  });

  it("drops every facet while there are no activities at all", async () => {
    vocabulary();
    tables.set(T.activities, []);

    const catalog = await (await fresh()).getFilterCatalog();
    expect(catalog).toEqual({ subjects: [], grades: [], skills: [], resourceTypes: [] });
  });

  it("forgets a resource type once its only document is taken down", async () => {
    vocabulary();
    tables.set(T.activities, [
      activity({ pairs: [10], resources: [{ type: 3, deleted: true }, { type: 4 }] }),
    ]);

    const catalog = await (await fresh()).getFilterCatalog();
    expect(catalog.resourceTypes).toEqual([{ id: 4, name: "Presentación" }]);
  });

  it("lists the subjects alphabetically, not by size", async () => {
    vocabulary();
    tables.set(T.activities, [
      activity({ pairs: [10] }),
      activity({ pairs: [10] }),
      activity({ pairs: [20] }),
    ]);

    const catalog = await (await fresh()).getFilterCatalog();
    expect(catalog.subjects.map((s) => s.name)).toEqual(["Biología", "Matemática"]);
  });
});
