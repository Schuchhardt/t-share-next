import "server-only";
import { cache } from "react";
import { T, db, unwrap } from "@/lib/supabase";
import { documentName, stepName } from "@/lib/format";
import { fileUrl } from "@/lib/storage";
import type {
  ActivityDetail,
  ActivityDocument,
  ActivityFilters,
  ActivityStep,
  ActivitySummary,
  Paged,
} from "@/lib/types";

/**
 * Reading activities.
 *
 * Filtering happens in two steps rather than one giant embedded query: each
 * active facet resolves to a set of activity ids, the sets are intersected, and
 * the result narrows the main select. PostgREST can filter on an embedded
 * table, but only in ways that turn "has a resource of type X" into a join that
 * also drops the other resources from the row — the id-set pass keeps the
 * filter and the payload independent, and the catalogue is small enough
 * (~1 200 activities) that the extra round-trips are cheap.
 */

export const PAGE_SIZE = 20;

/** Soft-deleted rows stay in the table; nothing user-facing should see them. */
const LIVE = { column: "deleted_at", value: null } as const;

/**
 * The columns every list row needs. Counts come from the denormalised columns
 * on `tshare_activities`, kept current by triggers.
 */
const BASE_SELECT = `
  id, title, learning_objective, duration_minutes, created_at,
  saved_count, download_count,
  author:${T.users} ( id, first_name, last_name, avatar_key, avatar_url ),
  subject_grades:${T.activitySubjectGrades} (
    subject_grade:${T.subjectGrades} (
      subject:${T.subjects} ( id, name ),
      grade:${T.grades} ( id, name, description )
    )
  )
`;

/** A list row only needs enough of a resource to count it and name its type. */
const SUMMARY_SELECT = `
  ${BASE_SELECT},
  resources:${T.activityResources} (
    id, file_key, file_url, external_url, deleted_at,
    resource_type:${T.resourceTypes} ( id, name )
  )
`;

type SummaryRow = {
  id: number;
  title: string;
  learning_objective: string | null;
  duration_minutes: number | null;
  created_at: string;
  saved_count: number;
  download_count: number;
  author: {
    id: number;
    first_name: string;
    last_name: string | null;
    avatar_key: string | null;
    avatar_url: string | null;
  } | null;
  subject_grades: {
    subject_grade: {
      subject: { id: number; name: string } | null;
      grade: { id: number; name: string; description: string | null } | null;
    } | null;
  }[];
  resources: {
    id: number;
    file_key: string | null;
    file_url: string | null;
    external_url: string | null;
    deleted_at: string | null;
    resource_type: { id: number; name: string } | null;
  }[];
};

/** Trims, de-duplicates and sorts a list of catalogue names for display. */
function names(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const name = value?.trim();
    if (name) seen.add(name);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, "es"));
}

async function toSummary(row: SummaryRow): Promise<ActivitySummary> {
  const pairs = row.subject_grades.map((sg) => sg.subject_grade).filter(Boolean);
  const live = row.resources.filter((r) => !r.deleted_at);
  return {
    id: row.id,
    title: row.title,
    learningObjective: row.learning_objective,
    durationMinutes: row.duration_minutes,
    createdAt: row.created_at,
    author: row.author
      ? {
          id: row.author.id,
          name: [row.author.first_name, row.author.last_name].filter(Boolean).join(" ").trim(),
          avatarUrl: await fileUrl({ key: row.author.avatar_key, url: row.author.avatar_url }),
        }
      : null,
    subjects: names(pairs.map((p) => p?.subject?.name)),
    grades: names(pairs.map((p) => p?.grade?.name)),
    resourceTypes: names(live.map((r) => r.resource_type?.name)),
    documentCount: live.filter((r) => r.file_key || r.file_url || r.external_url).length,
    savedCount: row.saved_count,
    downloadCount: row.download_count,
  };
}

/** Resolves one facet to the activity ids it allows, or null when inactive. */
async function idsForFacet(
  table: string,
  column: string,
  values: number[],
): Promise<Set<number> | null> {
  if (values.length === 0) return null;
  const rows = unwrap(
    await db().from(table).select("activity_id").in(column, values),
    `filter on ${table}`,
  ) as { activity_id: number }[];
  return new Set(rows.map((r) => r.activity_id));
}

/**
 * Subject and grade both hang off `tshare_subject_grades`, so they resolve
 * through that table first.
 */
async function idsForSubjectGrade(
  subjectIds: number[],
  gradeIds: number[],
): Promise<Set<number> | null> {
  if (subjectIds.length === 0 && gradeIds.length === 0) return null;

  let query = db().from(T.subjectGrades).select("id");
  if (subjectIds.length) query = query.in("subject_id", subjectIds);
  if (gradeIds.length) query = query.in("grade_id", gradeIds);
  const pairs = unwrap(await query, "subject/grade filter") as { id: number }[];
  if (pairs.length === 0) return new Set<number>();

  const rows = unwrap(
    await db()
      .from(T.activitySubjectGrades)
      .select("activity_id")
      .in(
        "subject_grade_id",
        pairs.map((p) => p.id),
      ),
    "activity subject/grade filter",
  ) as { activity_id: number }[];
  return new Set(rows.map((r) => r.activity_id));
}

function intersect(sets: (Set<number> | null)[]): number[] | null {
  const active = sets.filter((s): s is Set<number> => s !== null);
  if (active.length === 0) return null;
  const [first, ...rest] = active;
  return [...first!].filter((id) => rest.every((s) => s.has(id)));
}

export function emptyFilters(): ActivityFilters {
  return { q: "", subjectIds: [], gradeIds: [], skillIds: [], resourceTypeIds: [], sort: "recientes", page: 1 };
}

export async function searchActivities(
  filters: ActivityFilters,
): Promise<Paged<ActivitySummary>> {
  const [subjectGradeIds, skillIds, resourceTypeIds] = await Promise.all([
    idsForSubjectGrade(filters.subjectIds, filters.gradeIds),
    idsForFacet(T.activitySkills, "skill_id", filters.skillIds),
    idsForFacet(T.activityResources, "resource_type_id", filters.resourceTypeIds),
  ]);

  const allowed = intersect([subjectGradeIds, skillIds, resourceTypeIds]);
  const page = Math.max(1, filters.page);

  if (allowed !== null && allowed.length === 0) {
    return { items: [], total: 0, page, pageSize: PAGE_SIZE };
  }

  let query = db()
    .from(T.activities)
    .select(SUMMARY_SELECT, { count: "exact" })
    .is(LIVE.column, LIVE.value);

  if (allowed !== null) query = query.in("id", allowed);

  const term = filters.q.trim();
  if (term) {
    // PostgREST's `or` takes a comma-separated list, so a comma or a paren in
    // the term would end the filter early.
    const safe = term.replace(/[,()\\]/g, " ");
    query = query.or(
      `title.ilike.%${safe}%,learning_objective.ilike.%${safe}%,description.ilike.%${safe}%`,
    );
  }

  query =
    filters.sort === "populares"
      ? query.order("download_count", { ascending: false }).order("id", { ascending: false })
      : query.order("created_at", { ascending: false }).order("id", { ascending: false });

  const from = (page - 1) * PAGE_SIZE;
  const result = await query.range(from, from + PAGE_SIZE - 1);
  if (result.error) throw new Error(`search activities: ${result.error.message}`);

  const items = await Promise.all(((result.data ?? []) as unknown as SummaryRow[]).map(toSummary));
  return { items, total: result.count ?? items.length, page, pageSize: PAGE_SIZE };
}

export const getRecentActivities = cache(async (limit = 4): Promise<ActivitySummary[]> => {
  const rows = unwrap(
    await db()
      .from(T.activities)
      .select(SUMMARY_SELECT)
      .is(LIVE.column, LIVE.value)
      .order("created_at", { ascending: false })
      .limit(limit),
    "recent activities",
  ) as unknown as SummaryRow[];
  return Promise.all(rows.map(toSummary));
});

export const countActivities = cache(async (): Promise<number> => {
  const { count, error } = await db()
    .from(T.activities)
    .select("id", { count: "exact", head: true })
    .is(LIVE.column, LIVE.value);
  if (error) throw new Error(`count activities: ${error.message}`);
  return count ?? 0;
});

const DETAIL_SELECT = `
  ${BASE_SELECT},
  resources:${T.activityResources} (
    id, name, external_url, file_key, file_url, deleted_at,
    resource_type:${T.resourceTypes} ( id, name )
  ),
  description, evaluation, rating, cover_image_key, cover_image_url, pdf_key, pdf_url,
  skills:${T.activitySkills} ( skill:${T.skills} ( id, name ) ),
  units:${T.activityUnits} ( unit:${T.units} ( id, name ) ),
  instructions:${T.activityInstructions} ( id, name, body, external_url, file_key, file_url, deleted_at ),
  materials:${T.activityMaterials} ( id, name, external_url, file_key, file_url, deleted_at )
`;

type DetailRow = Omit<SummaryRow, "resources"> & {
  description: string | null;
  evaluation: string | null;
  rating: number | null;
  cover_image_key: string | null;
  cover_image_url: string | null;
  pdf_key: string | null;
  pdf_url: string | null;
  skills: { skill: { id: number; name: string } | null }[];
  units: { unit: { id: number; name: string } | null }[];
  instructions: {
    id: number;
    name: string;
    body: string | null;
    external_url: string | null;
    file_key: string | null;
    file_url: string | null;
    deleted_at: string | null;
  }[];
  materials: {
    id: number;
    name: string;
    external_url: string | null;
    file_key: string | null;
    file_url: string | null;
    deleted_at: string | null;
  }[];
  resources: (SummaryRow["resources"][number] & { name: string })[];
};

export async function getActivity(id: number): Promise<ActivityDetail | null> {
  if (!Number.isInteger(id) || id <= 0) return null;

  const { data, error } = await db()
    .from(T.activities)
    .select(DETAIL_SELECT)
    .eq("id", id)
    .is(LIVE.column, LIVE.value)
    .maybeSingle();

  if (error) throw new Error(`activity ${id}: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as DetailRow;
  const summary = await toSummary(row);

  const liveResources = row.resources.filter((r) => !r.deleted_at);
  const liveMaterials = row.materials.filter((m) => !m.deleted_at);
  const liveInstructions = row.instructions.filter((i) => !i.deleted_at);

  const [coverUrl, pdfUrl, resourceUrls] = await Promise.all([
    fileUrl({ key: row.cover_image_key, url: row.cover_image_url }),
    fileUrl({ key: row.pdf_key, url: row.pdf_url }),
    Promise.all(liveResources.map((r) => fileUrl({ key: r.file_key, url: r.file_url }))),
  ]);

  const documents: ActivityDocument[] = liveResources.map((r, i) => ({
    id: r.id,
    name: documentName(r.name, r.resource_type?.name ?? null),
    url: resourceUrls[i] ?? r.external_url ?? null,
    kind: r.resource_type?.name?.trim() ?? null,
  }));

  const steps: ActivityStep[] = liveInstructions
    .filter((i) => i.body?.trim() || i.name?.trim())
    .map((i, index) => ({
      id: i.id,
      name: stepName(i.name, index),
      text: i.body?.trim() ?? "",
    }));

  return {
    ...summary,
    description: row.description,
    evaluation: row.evaluation,
    rating: row.rating,
    coverUrl,
    pdfUrl,
    skills: names(row.skills.map((s) => s.skill?.name)),
    units: names(row.units.map((u) => u.unit?.name)),
    steps,
    materials: names(liveMaterials.map((m) => m.name)),
    documents,
  };
}

/** Ids only — used to render "Guardada" state without loading the rows. */
export async function getSavedActivityIds(userId: number): Promise<number[]> {
  const rows = unwrap(
    await db().from(T.savedActivities).select("activity_id").eq("user_id", userId),
    "saved activity ids",
  ) as { activity_id: number }[];
  return rows.map((r) => r.activity_id);
}

async function summariesByIds(ids: number[]): Promise<ActivitySummary[]> {
  if (ids.length === 0) return [];
  const rows = unwrap(
    await db()
      .from(T.activities)
      .select(SUMMARY_SELECT)
      .in("id", ids)
      .is(LIVE.column, LIVE.value)
      .order("created_at", { ascending: false }),
    "activities by id",
  ) as unknown as SummaryRow[];
  return Promise.all(rows.map(toSummary));
}

export async function getSavedActivities(userId: number): Promise<ActivitySummary[]> {
  return summariesByIds(await getSavedActivityIds(userId));
}

export async function getActivitiesByAuthor(userId: number): Promise<ActivitySummary[]> {
  const rows = unwrap(
    await db()
      .from(T.activities)
      .select(SUMMARY_SELECT)
      .eq("user_id", userId)
      .is(LIVE.column, LIVE.value)
      .order("created_at", { ascending: false }),
    "activities by author",
  ) as unknown as SummaryRow[];
  return Promise.all(rows.map(toSummary));
}
