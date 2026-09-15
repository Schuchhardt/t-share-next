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
 * and the live activities are already close to that. Everything here is
 * narrow, cached per request, so paging it is cheaper than the alternative — a
 * database function that would have to be applied to production before the
 * next deploy could render the landing page at all.
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
 * What the catalogue is actually used for, read from the live activities.
 *
 * The vocabulary tables carry far more than the activities do — 32 subjects,
 * niveles nobody has published for, tipos de recurso nobody has uploaded — so
 * an option offered straight from them is a promise the results page cannot
 * keep: a chip, or a filter checkbox, that returns nothing.
 *
 * It reads from `tshare_activities` outwards rather than walking each link
 * table, which is one round-trip instead of nine and makes the counting fall
 * out for free: an activity filed under the same subject through two grades is
 * still one row here.
 *
 * The subject pairing runs through `tshare_subject_grades`, the same table the
 * search filter walks, so the number is exactly what clicking the chip will
 * show. And where the catalogue holds the same name twice ("Matemática" and
 * "Matemática "), the id that keeps the name is the one holding more
 * activities — which is why this counts against the raw table instead of
 * reusing `getSubjects`, whose own de-duplication keeps whichever id sorted
 * first.
 */
type UsageRow = {
  subject_grades: { subject_grade_id: number | null }[];
  skills: { skill_id: number | null }[];
  resources: { resource_type_id: number | null; deleted_at: string | null }[];
};

const readUsage = cache(async () => {
  const [subjects, pairs, rows] = await Promise.all([
    selectAll<{ id: number; name: string }>(T.subjects, "id, name", (q) =>
      q.is("deleted_at", null),
    ),
    selectAll<{ id: number; subject_id: number | null; grade_id: number | null }>(
      T.subjectGrades,
      "id, subject_id, grade_id",
    ),
    selectAll<UsageRow>(
      T.activities,
      `
        subject_grades:${T.activitySubjectGrades} ( subject_grade_id ),
        skills:${T.activitySkills} ( skill_id ),
        resources:${T.activityResources} ( resource_type_id, deleted_at )
      `,
      (q) => q.is("deleted_at", null),
    ),
  ]);

  const pairById = new Map(pairs.map((p) => [p.id, p]));
  const activitiesPerSubject = new Map<number, number>();
  const gradeIds = new Set<number>();
  const skillIds = new Set<number>();
  const resourceTypeIds = new Set<number>();

  for (const row of rows) {
    // Per activity, so two grades of one subject still count as one.
    const subjectsHere = new Set<number>();
    for (const link of row.subject_grades ?? []) {
      const pair = link.subject_grade_id ? pairById.get(link.subject_grade_id) : null;
      if (!pair) continue;
      if (pair.subject_id) subjectsHere.add(pair.subject_id);
      if (pair.grade_id) gradeIds.add(pair.grade_id);
    }
    for (const id of subjectsHere) {
      activitiesPerSubject.set(id, (activitiesPerSubject.get(id) ?? 0) + 1);
    }
    for (const link of row.skills ?? []) {
      if (link.skill_id) skillIds.add(link.skill_id);
    }
    for (const link of row.resources ?? []) {
      // A document that was taken down does not keep its type on the shelf.
      if (link.resource_type_id && !link.deleted_at) resourceTypeIds.add(link.resource_type_id);
    }
  }

  const ranked = subjects
    .map((s) => ({ id: s.id, name: s.name.trim(), count: activitiesPerSubject.get(s.id) ?? 0 }))
    .filter((s) => s.name && s.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));

  // Sorted by count already, so the first of a repeated name is the fuller one.
  const seen = new Set<string>();
  const rankedSubjects = ranked
    .filter((s) => {
      const key = s.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ id, name }): CatalogItem => ({ id, name }));

  return { subjects: rankedSubjects, gradeIds, skillIds, resourceTypeIds };
});

/** Subjects that actually have something behind them, most stocked first. */
export const getSubjectsWithActivities = cache(
  async (limit = 10): Promise<CatalogItem[]> => (await readUsage()).subjects.slice(0, limit),
);

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
 *
 * Only the options a live activity actually carries. A facet nobody has
 * published under is worse than no facet at all — it reads as a promise of
 * results and delivers an empty page — and a new activity puts its own
 * asignatura, nivel, habilidad and tipo de recurso on the list the moment it
 * is published.
 */
export const getFilterCatalog = cache(async () => {
  const [used, grades, skills, resourceTypes] = await Promise.all([
    readUsage(),
    getGrades(),
    getSkills(),
    getResourceTypes(),
  ]);
  return {
    // `readUsage` ranks subjects by size for the landing chips; the sidebar is
    // a list to scan, so it goes back to alphabetical.
    subjects: [...used.subjects].sort((a, b) => a.name.localeCompare(b.name, "es")),
    grades: grades.filter((g) => used.gradeIds.has(g.id)),
    skills: skills.filter((s) => used.skillIds.has(s.id)),
    resourceTypes: resourceTypes.filter((r) => used.resourceTypeIds.has(r.id)),
  };
});

/**
 * La fila de `tshare_subject_grades` que empareja una asignatura con un nivel,
 * creándola cuando ese par es nuevo.
 *
 * El catálogo heredado no cubre todas las combinaciones y nadie — ni un
 * profesor publicando, ni el panel corrigiendo — debería quedarse bloqueado
 * por eso. Vive aquí, y no en el server action que lo usaba, porque ahora lo
 * usan dos y un `"use server"` no puede exportar una función que no sea acción.
 */
export async function ensureSubjectGrade(subjectId: number, gradeId: number): Promise<number> {
  const found = await db()
    .from(T.subjectGrades)
    .select("id")
    .eq("subject_id", subjectId)
    .eq("grade_id", gradeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (found.error) throw new Error(found.error.message);
  if (found.data) return (found.data as { id: number }).id;

  const created = unwrap(
    await db()
      .from(T.subjectGrades)
      .insert({ subject_id: subjectId, grade_id: gradeId })
      .select("id")
      .single(),
    "create subject/grade",
  ) as { id: number };
  return created.id;
}
