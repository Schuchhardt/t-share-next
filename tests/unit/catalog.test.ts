import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The subject chips on the landing page.
 *
 * The rule is that every chip has to lead somewhere: the count is taken
 * through `tshare_subject_grades`, which is the table the search filter walks,
 * so what the chip promises is what clicking it shows. The cases below are the
 * three ways that used to go wrong — an empty subject riding the alphabet onto
 * the page, an activity counted twice for being filed under two grades, and a
 * duplicated name keeping the emptier of its two ids.
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
async function ranked(limit?: number) {
  vi.resetModules();
  const fresh = await import("@/lib/catalog");
  return fresh.getSubjectsWithActivities(limit);
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
    tables.set(T.activitySubjectGrades, [{ activity_id: 100, subject_grade_id: 10 }]);

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
    tables.set(T.activitySubjectGrades, [
      { activity_id: 100, subject_grade_id: 10 },
      { activity_id: 200, subject_grade_id: 20 },
      { activity_id: 201, subject_grade_id: 20 },
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
    tables.set(T.activitySubjectGrades, [
      // The same activity, under two grades of the same subject.
      { activity_id: 100, subject_grade_id: 10 },
      { activity_id: 100, subject_grade_id: 11 },
      { activity_id: 200, subject_grade_id: 20 },
      { activity_id: 201, subject_grade_id: 20 },
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
    tables.set(T.activitySubjectGrades, [
      { activity_id: 100, subject_grade_id: 10 },
      { activity_id: 200, subject_grade_id: 20 },
      { activity_id: 201, subject_grade_id: 20 },
    ]);

    await expect(ranked()).resolves.toEqual([{ id: 2, name: "Matemática" }]);
  });

  it("ignores a link whose pair no longer names a subject", async () => {
    tables.set(T.subjects, [{ id: 1, name: "Arte y Cultura" }]);
    tables.set(T.subjectGrades, [
      { id: 10, subject_id: 1 },
      { id: 11, subject_id: null },
    ]);
    tables.set(T.activitySubjectGrades, [
      { activity_id: 100, subject_grade_id: 10 },
      { activity_id: 101, subject_grade_id: 11 },
      { activity_id: 102, subject_grade_id: null },
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
    tables.set(T.activitySubjectGrades, [
      { activity_id: 100, subject_grade_id: 10 },
      { activity_id: 200, subject_grade_id: 20 },
      { activity_id: 300, subject_grade_id: 30 },
    ]);

    await expect(ranked(2)).resolves.toHaveLength(2);
  });
});
