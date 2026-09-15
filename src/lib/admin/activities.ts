import "server-only";
import { documentName } from "@/lib/format";
import { fileLabel } from "@/lib/preview";
import { fileUrl } from "@/lib/storage";
import { T, db, unwrap } from "@/lib/supabase";
import type { Paged } from "@/lib/types";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/users";

/**
 * Las actividades vistas desde el panel.
 *
 * `src/lib/activities.ts` lee el catálogo: filtra por facetas, oculta lo
 * borrado y devuelve la ficha ya armada para mostrarla. Esto lee la fila —
 * incluidas las borradas, con las claves de S3 en crudo y con los ids que el
 * formulario necesita para volver a guardarlas. Son dos lecturas distintas de
 * la misma tabla y por eso no comparten módulo.
 */

export type AdminActivityListItem = {
  id: number;
  title: string;
  authorId: number | null;
  authorName: string;
  createdAt: string;
  deletedAt: string | null;
  documentCount: number;
  downloadCount: number;
  savedCount: number;
};

/** Un adjunto tal como lo edita el panel: la fila, no lo que se muestra. */
export type AdminDocument = {
  id: number;
  name: string;
  displayName: string;
  resourceTypeId: number | null;
  externalUrl: string | null;
  fileKey: string | null;
  fileUrl: string | null;
  /** Para abrirlo desde el panel; firmada cuando el bucket es privado. */
  openUrl: string | null;
  format: string | null;
  deletedAt: string | null;
};

export type AdminActivityDetail = {
  id: number;
  title: string;
  learningObjective: string | null;
  description: string | null;
  evaluation: string | null;
  durationMinutes: number | null;
  createdAt: string;
  deletedAt: string | null;
  authorId: number | null;
  authorEmail: string | null;
  authorName: string;
  coverKey: string | null;
  coverUrl: string | null;
  coverPreviewUrl: string | null;
  subjectId: number | null;
  gradeId: number | null;
  skillIds: number[];
  /** Los tres momentos, por nombre, tal como los guarda el formulario. */
  steps: Record<string, string>;
  materials: string[];
  documents: AdminDocument[];
  downloadCount: number;
  savedCount: number;
};

function safeTerm(term: string): string {
  return term.replace(/[,()\\%*]/g, " ").trim();
}

export async function listActivities(options: {
  q?: string;
  page?: number;
  authorId?: number;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
}): Promise<Paged<AdminActivityListItem>> {
  const page = Math.max(1, options.page ?? 1);

  let query = db()
    .from(T.activities)
    .select(
      `id, title, created_at, deleted_at, download_count, saved_count, user_id,
       author:${T.users} ( id, first_name, last_name, email ),
       resources:${T.activityResources} ( id, deleted_at )`,
      { count: "exact" },
    );

  if (options.onlyDeleted) query = query.not("deleted_at", "is", null);
  else if (!options.includeDeleted) query = query.is("deleted_at", null);
  if (options.authorId) query = query.eq("user_id", options.authorId);

  const term = safeTerm(options.q ?? "");
  if (term) {
    query = query.or(
      `title.ilike.%${term}%,learning_objective.ilike.%${term}%,description.ilike.%${term}%`,
    );
  }

  const from = (page - 1) * ADMIN_PAGE_SIZE;
  const result = await query
    .order("id", { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1);
  if (result.error) throw new Error(`list activities: ${result.error.message}`);

  const rows = (result.data ?? []) as unknown as {
    id: number;
    title: string;
    created_at: string;
    deleted_at: string | null;
    download_count: number;
    saved_count: number;
    user_id: number | null;
    author: { id: number; first_name: string | null; last_name: string | null; email: string } | null;
    resources: { id: number; deleted_at: string | null }[];
  }[];

  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      authorId: row.author?.id ?? row.user_id,
      authorName: row.author
        ? [row.author.first_name, row.author.last_name].filter(Boolean).join(" ").trim() ||
          row.author.email
        : "Sin autor",
      createdAt: row.created_at,
      deletedAt: row.deleted_at,
      documentCount: row.resources.filter((r) => !r.deleted_at).length,
      downloadCount: row.download_count,
      savedCount: row.saved_count,
    })),
    total: result.count ?? rows.length,
    page,
    pageSize: ADMIN_PAGE_SIZE,
  };
}

export async function getAdminActivity(id: number): Promise<AdminActivityDetail | null> {
  if (!Number.isInteger(id) || id <= 0) return null;

  const { data, error } = await db()
    .from(T.activities)
    .select(
      `id, title, learning_objective, description, evaluation, duration_minutes,
       created_at, deleted_at, user_id, cover_image_key, cover_image_url,
       download_count, saved_count,
       author:${T.users} ( id, first_name, last_name, email ),
       subject_grades:${T.activitySubjectGrades} (
         subject_grade:${T.subjectGrades} ( id, subject_id, grade_id )
       ),
       skills:${T.activitySkills} ( skill_id ),
       instructions:${T.activityInstructions} ( id, name, body, deleted_at ),
       materials:${T.activityMaterials} ( id, name, deleted_at ),
       resources:${T.activityResources} (
         id, name, resource_type_id, external_url, file_key, file_url, deleted_at
       )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`activity ${id}: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as {
    id: number;
    title: string;
    learning_objective: string | null;
    description: string | null;
    evaluation: string | null;
    duration_minutes: number | null;
    created_at: string;
    deleted_at: string | null;
    user_id: number | null;
    cover_image_key: string | null;
    cover_image_url: string | null;
    download_count: number;
    saved_count: number;
    author: { id: number; first_name: string | null; last_name: string | null; email: string } | null;
    subject_grades: { subject_grade: { id: number; subject_id: number | null; grade_id: number | null } | null }[];
    skills: { skill_id: number }[];
    instructions: { id: number; name: string; body: string | null; deleted_at: string | null }[];
    materials: { id: number; name: string; deleted_at: string | null }[];
    resources: {
      id: number;
      name: string;
      resource_type_id: number | null;
      external_url: string | null;
      file_key: string | null;
      file_url: string | null;
      deleted_at: string | null;
    }[];
  };

  const pair = row.subject_grades.map((sg) => sg.subject_grade).find(Boolean) ?? null;

  const documents = await Promise.all(
    row.resources
      .filter((r) => !r.deleted_at)
      .map(async (r) => {
        const openUrl =
          (await fileUrl({ key: r.file_key, url: r.file_url })) ?? r.external_url ?? null;
        const source = r.file_key ?? r.file_url ?? r.external_url;
        return {
          id: r.id,
          name: r.name ?? "",
          displayName: documentName(r.name, null),
          resourceTypeId: r.resource_type_id,
          externalUrl: r.external_url,
          fileKey: r.file_key,
          fileUrl: r.file_url,
          openUrl,
          format: fileLabel(source),
          deletedAt: r.deleted_at,
        } satisfies AdminDocument;
      }),
  );

  const steps: Record<string, string> = {};
  for (const instruction of row.instructions) {
    if (instruction.deleted_at) continue;
    const name = instruction.name?.trim();
    if (name) steps[name] = instruction.body?.trim() ?? "";
  }

  return {
    id: row.id,
    title: row.title,
    learningObjective: row.learning_objective,
    description: row.description,
    evaluation: row.evaluation,
    durationMinutes: row.duration_minutes,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    authorId: row.author?.id ?? row.user_id,
    authorEmail: row.author?.email ?? null,
    authorName: row.author
      ? [row.author.first_name, row.author.last_name].filter(Boolean).join(" ").trim() ||
        row.author.email
      : "Sin autor",
    coverKey: row.cover_image_key,
    coverUrl: row.cover_image_url,
    coverPreviewUrl: await fileUrl({ key: row.cover_image_key, url: row.cover_image_url }),
    subjectId: pair?.subject_id ?? null,
    gradeId: pair?.grade_id ?? null,
    skillIds: row.skills.map((s) => s.skill_id),
    steps,
    materials: row.materials.filter((m) => !m.deleted_at).map((m) => m.name).filter(Boolean),
    documents,
    downloadCount: row.download_count,
    savedCount: row.saved_count,
  };
}

/** Cuántas actividades hay, vivas y borradas — para la portada del panel. */
export async function countActivitiesForAdmin(): Promise<{ live: number; deleted: number }> {
  const [live, deleted] = await Promise.all([
    db().from(T.activities).select("id", { count: "exact", head: true }).is("deleted_at", null),
    db().from(T.activities).select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
  ]);
  if (live.error) throw new Error(`count activities: ${live.error.message}`);
  if (deleted.error) throw new Error(`count activities: ${deleted.error.message}`);
  return { live: live.count ?? 0, deleted: deleted.count ?? 0 };
}

/** Lo mismo para las cuentas. */
export async function countUsersForAdmin(): Promise<{ live: number; deleted: number }> {
  const [live, deleted] = await Promise.all([
    db().from(T.users).select("id", { count: "exact", head: true }).is("deleted_at", null),
    db().from(T.users).select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
  ]);
  if (live.error) throw new Error(`count users: ${live.error.message}`);
  if (deleted.error) throw new Error(`count users: ${deleted.error.message}`);
  return { live: live.count ?? 0, deleted: deleted.count ?? 0 };
}

/** El catálogo de tipos de recurso, sin el filtro de borrados que usa el
 * sitio: el panel tiene que poder ver el tipo que lleva una fila antigua. */
export async function listAllResourceTypes(): Promise<{ id: number; name: string }[]> {
  const rows = unwrap(
    await db().from(T.resourceTypes).select("id, name").order("id"),
    "resource types",
  ) as { id: number; name: string }[];
  return rows.map((r) => ({ id: r.id, name: r.name.trim() }));
}
