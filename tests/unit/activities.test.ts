import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The activity query layer, against a stubbed PostgREST client.
 *
 * What is worth pinning down here is the two-step filter: each facet resolves
 * to a set of activity ids and the sets are intersected, so an activity has to
 * satisfy every facet rather than any of them. The stub records the calls the
 * code makes, which is also how the `.in("id", …)` narrowing is checked.
 */

type Call = { table: string; filters: Record<string, unknown>; select: string };

const calls: Call[] = [];
/** Rows the stub returns, keyed by table. */
const tables = new Map<string, unknown[]>();

/** A chainable stand-in for the supabase-js query builder. */
function builder(table: string) {
  const call: Call = { table, filters: {}, select: "" };
  const rows = () => tables.get(table) ?? [];

  const self: Record<string, unknown> = {
    select(columns: string) {
      call.select = columns;
      calls.push(call);
      return self;
    },
    in(column: string, values: unknown[]) {
      call.filters[`in:${column}`] = values;
      return self;
    },
    eq(column: string, value: unknown) {
      call.filters[`eq:${column}`] = value;
      return self;
    },
    is(column: string, value: unknown) {
      call.filters[`is:${column}`] = value;
      return self;
    },
    not() {
      return self;
    },
    or(expression: string) {
      call.filters.or = expression;
      return self;
    },
    order(column: string, options?: { ascending?: boolean }) {
      const applied = (call.filters.order as string[] | undefined) ?? [];
      applied.push(`${column}:${options?.ascending === false ? "desc" : "asc"}`);
      call.filters.order = applied;
      return self;
    },
    limit() {
      return self;
    },
    range(from: number, to: number) {
      call.filters.range = [from, to];
      return Promise.resolve({ data: rows(), error: null, count: rows().length });
    },
    maybeSingle() {
      return Promise.resolve({ data: rows()[0] ?? null, error: null });
    },
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve({ data: rows(), error: null, count: rows().length }).then(resolve);
    },
  };
  return self;
}

vi.mock("@/lib/supabase", async () => {
  const actual = await vi.importActual<typeof import("@/lib/supabase")>("@/lib/supabase");
  return {
    ...actual,
    db: () => ({ from: (table: string) => builder(table) }),
  };
});

// The bucket is not configured under test, so file references resolve to null
// rather than reaching for a signature.
vi.mock("@/lib/storage", () => ({ fileUrl: async () => null }));

const { emptyFilters, searchActivities } = await import("@/lib/activities");

function activityRow(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Actividad ${id}`,
    learning_objective: "Objetivo",
    duration_minutes: 45,
    created_at: "2024-05-01T10:00:00Z",
    saved_count: 2,
    download_count: 7,
    author: { id: 9, first_name: "Angela", last_name: "Palma", avatar_key: null, avatar_url: null },
    subject_grades: [
      {
        subject_grade: {
          subject: { id: 7, name: "Matemática" },
          grade: { id: 4, name: "9 a 10 años", description: null },
        },
      },
    ],
    resources: [
      {
        id: 1,
        file_key: "actividades/recursos/a",
        file_url: null,
        external_url: null,
        deleted_at: null,
        resource_type: { id: 3, name: "Guía" },
      },
    ],
    ...overrides,
  };
}

function find(table: string): Call | undefined {
  return calls.find((c) => c.table === table);
}

beforeEach(() => {
  calls.length = 0;
  tables.clear();
});

describe("searchActivities", () => {
  it("maps a row onto the shape the list renders", async () => {
    tables.set("tshare_activities", [activityRow(1)]);

    const page = await searchActivities(emptyFilters());

    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      id: 1,
      title: "Actividad 1",
      subjects: ["Matemática"],
      grades: ["9 a 10 años"],
      resourceTypes: ["Guía"],
      documentCount: 1,
      savedCount: 2,
      downloadCount: 7,
      author: { id: 9, name: "Angela Palma" },
    });
  });

  it("hides soft-deleted activities", async () => {
    tables.set("tshare_activities", []);
    await searchActivities(emptyFilters());
    expect(find("tshare_activities")?.filters["is:deleted_at"]).toBeNull();
  });

  it("does not count a deleted resource as a document", async () => {
    tables.set("tshare_activities", [
      activityRow(1, {
        resources: [
          {
            id: 1,
            file_key: "a",
            file_url: null,
            external_url: null,
            deleted_at: "2024-06-01T00:00:00Z",
            resource_type: { id: 3, name: "Guía" },
          },
        ],
      }),
    ]);
    const page = await searchActivities(emptyFilters());
    expect(page.items[0]!.documentCount).toBe(0);
    expect(page.items[0]!.resourceTypes).toEqual([]);
  });

  it("resolves a subject filter through tshare_subject_grades", async () => {
    tables.set("tshare_subject_grades", [{ id: 58 }]);
    tables.set("tshare_activity_subject_grades", [{ activity_id: 5 }, { activity_id: 6 }]);
    tables.set("tshare_activities", [activityRow(5), activityRow(6)]);

    await searchActivities({ ...emptyFilters(), subjectIds: [7] });

    expect(find("tshare_subject_grades")?.filters["in:subject_id"]).toEqual([7]);
    expect(find("tshare_activity_subject_grades")?.filters["in:subject_grade_id"]).toEqual([58]);
    expect(find("tshare_activities")?.filters["in:id"]).toEqual([5, 6]);
  });

  it("intersects facets, so an activity must satisfy all of them", async () => {
    tables.set("tshare_subject_grades", [{ id: 58 }]);
    tables.set("tshare_activity_subject_grades", [{ activity_id: 5 }, { activity_id: 6 }]);
    // Only activity 6 has the requested skill.
    tables.set("tshare_activity_skills", [{ activity_id: 6 }, { activity_id: 9 }]);
    tables.set("tshare_activities", [activityRow(6)]);

    await searchActivities({ ...emptyFilters(), subjectIds: [7], skillIds: [2] });

    expect(find("tshare_activities")?.filters["in:id"]).toEqual([6]);
  });

  it("short-circuits to an empty page when a facet matches nothing", async () => {
    tables.set("tshare_subject_grades", []);

    const page = await searchActivities({ ...emptyFilters(), subjectIds: [999] });

    expect(page).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    // No point asking for rows we already know cannot exist.
    expect(find("tshare_activities")).toBeUndefined();
  });

  it("searches title, objective and description together", async () => {
    tables.set("tshare_activities", []);
    await searchActivities({ ...emptyFilters(), q: "fracciones" });
    expect(find("tshare_activities")?.filters.or).toBe(
      "title.ilike.%fracciones%,learning_objective.ilike.%fracciones%,description.ilike.%fracciones%",
    );
  });

  it("neutralises characters that would end the PostgREST filter early", async () => {
    tables.set("tshare_activities", []);
    await searchActivities({ ...emptyFilters(), q: "post-it, positivo (x)" });
    const or = String(find("tshare_activities")?.filters.or);
    expect(or.split(",")).toHaveLength(3);
    expect(or).toContain("post-it  positivo  x ");
  });

  it("orders by newest by default and by downloads when asked for the most used", async () => {
    tables.set("tshare_activities", []);
    await searchActivities(emptyFilters());
    expect(find("tshare_activities")?.filters.order).toEqual(["created_at:desc", "id:desc"]);

    calls.length = 0;
    await searchActivities({ ...emptyFilters(), sort: "populares" });
    expect(find("tshare_activities")?.filters.order).toEqual(["download_count:desc", "id:desc"]);
  });

  it("pages through results", async () => {
    tables.set("tshare_activities", []);
    await searchActivities({ ...emptyFilters(), page: 3 });
    expect(find("tshare_activities")?.filters.range).toEqual([40, 59]);
  });

  it("treats a nonsense page number as the first page", async () => {
    tables.set("tshare_activities", []);
    await searchActivities({ ...emptyFilters(), page: -4 });
    expect(find("tshare_activities")?.filters.range).toEqual([0, 19]);
  });
});
