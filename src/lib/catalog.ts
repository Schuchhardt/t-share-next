import "server-only";
import { cache } from "react";
import { T, db, unwrap } from "@/lib/supabase";
import type { CatalogItem, Grade } from "@/lib/types";

/**
 * The filter vocabulary, read from the database rather than hard-coded.
 *
 * Everything the sidebar, the upload form and the activity ficha offer comes
 * from here, so adding a subject or a resource type in Supabase is enough to
 * make it appear in the UI.
 *
 * Each list is wrapped in React's `cache`, so a request that renders the
 * sidebar and the form only reads each table once.
 */

export const getSubjects = cache(async (): Promise<CatalogItem[]> => {
  const rows = unwrap(
    await db()
      .from(T.subjects)
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),
    "subjects",
  ) as { id: number; name: string }[];

  // The catalogue holds a few names that differ only by a trailing space
  // ("Matemática" and "Matemática "), which would read as duplicates.
  const seen = new Set<string>();
  return rows
    .map((r) => ({ id: r.id, name: r.name.trim() }))
    .filter((r) => {
      if (!r.name || seen.has(r.name.toLowerCase())) return false;
      seen.add(r.name.toLowerCase());
      return true;
    });
});

/**
 * Reads a whole table, a page at a time.
 *
 * PostgREST caps a response at 1 000 rows no matter what `.limit()` asks for,
 * and `tshare_activity_subject_grades` is nearly three times that. Everything
 * here is small, cached per request, and behind a page that revalidates every
 * five minutes, so paging it is cheaper than the alternative — a database
 * function that would have to be applied to production before the next deploy
 * could render the landing page at all.
 */
/** The slice of the PostgREST builder `selectAll` passes around. */
type Narrowable = {
  is(column: string, value: null): Narrowable;
  range(
    from: number,
    to: number,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

async function selectAll<T>(
  table: string,
  columns: string,
  narrow?: (query: Narrowable) => Narrowable,
): Promise<T[]> {
  const PAGE = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const base = db().from(table).select(columns) as unknown as Narrowable;
    const query = narrow ? narrow(base) : base;
    const page = unwrap(await query.range(from, from + PAGE - 1), `read ${table}`) as T[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/**
 * Subjects that actually have something behind them, most stocked first.
 *
 * The catalogue carries 34 subjects but the activities do not spread evenly
 * across them, so the alphabetical list `getSubjects` returns would put empty
 * ones on the landing page — a chip that promises results and delivers none.
 *
 * Two things make this more than a `count`. The pairing runs through
 * `tshare_subject_grades`, the same table the search filter walks, so the
 * number here is exactly what clicking the chip will show. And where the
 * catalogue holds the same name twice ("Matemática" and "Matemática "), the id
 * that keeps the name is the one holding more activities — which is why this
 * counts against the raw table instead of reusing `getSubjects`, whose own
 * de-duplication keeps whichever id sorted first.
 */
export const getSubjectsWithActivities = cache(async (limit = 10): Promise<CatalogItem[]> => {
  const [subjects, pairs, links] = await Promise.all([
    selectAll<{ id: number; name: string }>(T.subjects, "id, name", (q) =>
      q.is("deleted_at", null),
    ),
    selectAll<{ id: number; subject_id: number | null }>(T.subjectGrades, "id, subject_id"),
    selectAll<{ activity_id: number; subject_grade_id: number | null }>(
      T.activitySubjectGrades,
      `activity_id, subject_grade_id, activity:${T.activities}!inner ( id )`,
      (q) => q.is("activity.deleted_at", null),
    ),
  ]);

  const subjectOf = new Map(pairs.map((p) => [p.id, p.subject_id]));

  // An activity can sit under the same subject through two grades; counting
  // the link rows rather than the activities behind them would double it.
  const activities = new Map<number, Set<number>>();
  for (const link of links) {
    const subjectId = link.subject_grade_id ? subjectOf.get(link.subject_grade_id) : null;
    if (!subjectId) continue;
    const bucket = activities.get(subjectId) ?? new Set<number>();
    bucket.add(link.activity_id);
    activities.set(subjectId, bucket);
  }

  const ranked = subjects
    .map((s) => ({ id: s.id, name: s.name.trim(), count: activities.get(s.id)?.size ?? 0 }))
    .filter((s) => s.name && s.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));

  // Sorted by count already, so the first of a repeated name is the fuller one.
  const seen = new Set<string>();
  return ranked
    .filter((s) => {
      const key = s.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map(({ id, name }) => ({ id, name }));
});

export const getGrades = cache(async (): Promise<Grade[]> => {
  const rows = unwrap(
    await db()
      .from(T.grades)
      .select("id, name, description")
      .is("deleted_at", null)
      .order("id"),
    "grades",
  ) as { id: number; name: string; description: string | null }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name.trim(),
    level: r.description?.trim() || null,
  }));
});

export const getSkills = cache(async (): Promise<CatalogItem[]> => {
  const rows = unwrap(
    await db().from(T.skills).select("id, name").order("id"),
    "skills",
  ) as { id: number; name: string }[];
  return rows.map((r) => ({ id: r.id, name: r.name.trim() }));
});

export const getResourceTypes = cache(async (): Promise<CatalogItem[]> => {
  const rows = unwrap(
    await db().from(T.resourceTypes).select("id, name").is("deleted_at", null).order("id"),
    "resource types",
  ) as { id: number; name: string }[];
  return rows.map((r) => ({ id: r.id, name: r.name.trim() }));
});

/** Materials the upload form suggests. */
export const getSuggestedMaterials = cache(async (): Promise<CatalogItem[]> => {
  const rows = unwrap(
    await db().from(T.suggestedMaterials).select("id, name").order("name"),
    "suggested materials",
  ) as { id: number; name: string }[];
  return rows.map((r) => ({ id: r.id, name: r.name.trim() })).filter((r) => r.name);
});

/**
 * Everything the filter sidebar needs, in one call.
 */
export const getFilterCatalog = cache(async () => {
  const [subjects, grades, skills, resourceTypes] = await Promise.all([
    getSubjects(),
    getGrades(),
    getSkills(),
    getResourceTypes(),
  ]);
  return { subjects, grades, skills, resourceTypes };
});
