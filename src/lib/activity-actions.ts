"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { hasStorageConfig } from "@/lib/env";
import { notifyActivityCommented } from "@/lib/notifications";
import { previewKindForFile } from "@/lib/preview";
import { putFile, uploadKey } from "@/lib/storage";
import { T, db, unwrap } from "@/lib/supabase";

/**
 * Writing activities: saving one, recording a download, commenting, and
 * publishing a new one.
 *
 * Every action re-reads the session server-side — a form field claiming a user
 * id would be trusted by nothing here.
 */

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 12;
/** The cover is decoration, not a resource; 8 MB is already generous for one. */
const MAX_COVER_BYTES = 8 * 1024 * 1024;

export type ActionResult = { ok: boolean; error: string | null };

const OK: ActionResult = { ok: true, error: null };

function failed(error: string): ActionResult {
  return { ok: false, error };
}

/** Adds or removes the activity from the teacher's saved list. */
export async function toggleSaved(activityId: number): Promise<ActionResult> {
  const session = await requireSession();
  if (!Number.isInteger(activityId) || activityId <= 0) return failed("Actividad inválida.");

  const existing = await db()
    .from(T.savedActivities)
    .select("id")
    .eq("activity_id", activityId)
    .eq("user_id", session.userId)
    .maybeSingle();
  if (existing.error) return failed(existing.error.message);

  if (existing.data) {
    const { error } = await db()
      .from(T.savedActivities)
      .delete()
      .eq("id", (existing.data as { id: number }).id);
    if (error) return failed(error.message);
  } else {
    const { error } = await db()
      .from(T.savedActivities)
      .insert({ activity_id: activityId, user_id: session.userId });
    if (error) return failed(error.message);
  }

  revalidatePath(`/actividades/detalle/${activityId}`);
  revalidatePath("/mi-perfil");
  return OK;
}

/**
 * Bumps the download counter. The legacy table keeps one row per
 * (activity, user) with a running total, so a repeat download increments it
 * rather than inserting again.
 */
export async function recordDownload(activityId: number): Promise<ActionResult> {
  const session = await requireSession();
  if (!Number.isInteger(activityId) || activityId <= 0) return failed("Actividad inválida.");

  const existing = await db()
    .from(T.activityDownloads)
    .select("id, quantity")
    .eq("activity_id", activityId)
    .eq("user_id", session.userId)
    .maybeSingle();
  if (existing.error) return failed(existing.error.message);

  if (existing.data) {
    const row = existing.data as { id: number; quantity: number };
    const { error } = await db()
      .from(T.activityDownloads)
      .update({ quantity: row.quantity + 1, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) return failed(error.message);
  } else {
    const { error } = await db()
      .from(T.activityDownloads)
      .insert({ activity_id: activityId, user_id: session.userId, quantity: 1 });
    if (error) return failed(error.message);
  }

  revalidatePath(`/actividades/detalle/${activityId}`);
  return OK;
}

const commentSchema = z.object({
  activityId: z.coerce.number().int().positive(),
  body: z.string().trim().min(3, "Escribe un comentario un poco más largo.").max(2000),
  rating: z.coerce.number().min(1).max(5).optional(),
});

export async function addComment(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = commentSchema.safeParse({
    activityId: formData.get("activityId"),
    body: formData.get("body"),
    rating: formData.get("rating") || undefined,
  });
  if (!parsed.success) return failed(parsed.error.issues[0]?.message ?? "Revisa el comentario.");

  const { error } = await db().from(T.comments).insert({
    activity_id: parsed.data.activityId,
    user_id: session.userId,
    body: parsed.data.body,
    rating: parsed.data.rating ?? null,
    is_published: true,
  });
  if (error) return failed(error.message);

  // Laravel did this in `ComentarioController@add`. `after` keeps the mail off
  // the response, and the comment stands whether or not it goes out.
  after(() =>
    notifyAuthorOfComment(parsed.data.activityId, session.userId, session.name).catch((err) =>
      console.error("[comment] no se pudo avisar al autor:", err),
    ),
  );

  revalidatePath(`/actividades/detalle/${parsed.data.activityId}`);
  return OK;
}

/**
 * Emails the teacher who published the activity. Commenting on your own
 * activity sends nothing — the old app did notify you of your own comment,
 * which was noise.
 */
async function notifyAuthorOfComment(
  activityId: number,
  commenterId: number,
  commenterName: string,
): Promise<void> {
  const { data, error } = await db()
    .from(T.activities)
    .select(`id, title, user_id, author:${T.users} ( email, first_name, last_name )`)
    .eq("id", activityId)
    .maybeSingle();
  if (error || !data) return;

  const row = data as unknown as {
    title: string | null;
    user_id: number | null;
    author: { email: string; first_name: string; last_name: string | null } | null;
  };

  if (!row.author?.email || row.user_id === commenterId) return;

  await notifyActivityCommented(
    {
      email: row.author.email,
      name: row.author.first_name || row.author.email,
    },
    {
      commenterName,
      activityId,
      activityTitle: row.title ?? "tu actividad",
    },
  );
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

const createSchema = z.object({
  title: z.string().trim().min(3, "El título es obligatorio.").max(300),
  learningObjective: z.string().trim().max(2000).optional(),
  description: z.string().trim().max(5000).optional(),
  evaluation: z.string().trim().max(5000).optional(),
  durationMinutes: z.coerce.number().int().min(0).max(1000).optional(),
  subjectId: z.coerce.number().int().positive({ message: "Elige una asignatura." }),
  gradeId: z.coerce.number().int().positive({ message: "Elige un nivel." }),
  resourceTypeId: z.coerce.number().int().positive().optional(),
});

/**
 * Finds the `tshare_subject_grades` row for a subject/grade pair, creating it
 * when the pair is new — the legacy catalogue does not cover every combination
 * and a teacher should not be blocked by that.
 */
async function subjectGradeId(subjectId: number, gradeId: number): Promise<number> {
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

/** Splits a textarea into trimmed, non-empty lines. */
function lines(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function createActivity(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    learningObjective: formData.get("learningObjective") || undefined,
    description: formData.get("description") || undefined,
    evaluation: formData.get("evaluation") || undefined,
    durationMinutes: formData.get("durationMinutes") || undefined,
    subjectId: formData.get("subjectId"),
    gradeId: formData.get("gradeId"),
    resourceTypeId: formData.get("resourceTypeId") || undefined,
  });
  if (!parsed.success) return failed(parsed.error.issues[0]?.message ?? "Revisa el formulario.");

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_FILES) return failed(`Máximo ${MAX_FILES} archivos por actividad.`);
  const tooBig = files.find((f) => f.size > MAX_FILE_BYTES);
  if (tooBig) return failed(`"${tooBig.name}" supera los 25 MB.`);

  // The portada — `avatar` on the old `actividades` table.
  const picked = formData.get("cover");
  const cover = picked instanceof File && picked.size > 0 ? picked : null;
  if (cover) {
    if (previewKindForFile(cover) !== "image") {
      return failed("La portada tiene que ser una imagen (JPG, PNG, GIF o WEBP).");
    }
    if (cover.size > MAX_COVER_BYTES) return failed("La portada supera los 8 MB.");
  }

  if ((files.length > 0 || cover) && !hasStorageConfig()) {
    return failed("La subida de archivos no está configurada en este entorno.");
  }

  let activityId: number;
  try {
    const pairId = await subjectGradeId(parsed.data.subjectId, parsed.data.gradeId);

    const activity = unwrap(
      await db()
        .from(T.activities)
        .insert({
          title: parsed.data.title,
          learning_objective: parsed.data.learningObjective ?? null,
          description: parsed.data.description ?? null,
          evaluation: parsed.data.evaluation ?? null,
          duration_minutes: parsed.data.durationMinutes ?? null,
          user_id: session.userId,
        })
        .select("id")
        .single(),
      "create activity",
    ) as { id: number };
    activityId = activity.id;

    await db()
      .from(T.activitySubjectGrades)
      .insert({ activity_id: activityId, subject_grade_id: pairId });

    const skillIds = formData
      .getAll("skillIds")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (skillIds.length) {
      await db()
        .from(T.activitySkills)
        .insert(skillIds.map((skill_id) => ({ activity_id: activityId, skill_id })));
    }

    // "Momentos de la clase" — one instruction row per filled-in moment.
    const steps = (["Inicio", "Desarrollo", "Cierre"] as const)
      .map((name) => ({ name, body: String(formData.get(`step_${name}`) ?? "").trim() }))
      .filter((s) => s.body);
    if (steps.length) {
      await db()
        .from(T.activityInstructions)
        .insert(steps.map((s) => ({ activity_id: activityId, name: s.name, body: s.body })));
    }

    const materials = lines(formData.get("materials"));
    if (materials.length) {
      await db()
        .from(T.activityMaterials)
        .insert(materials.map((name) => ({ activity_id: activityId, name })));
    }

    if (cover) {
      const stored = await putFile(
        uploadKey("actividades/portadas", cover.name),
        new Uint8Array(await cover.arrayBuffer()),
        cover.type || "image/jpeg",
      );
      await db()
        .from(T.activities)
        .update({ cover_image_key: stored.key, cover_image_url: stored.url })
        .eq("id", activityId);
    }

    for (const file of files) {
      const stored = await putFile(
        uploadKey("actividades/recursos", file.name),
        new Uint8Array(await file.arrayBuffer()),
        file.type || "application/octet-stream",
      );
      await db().from(T.activityResources).insert({
        activity_id: activityId,
        resource_type_id: parsed.data.resourceTypeId ?? null,
        name: file.name,
        file_key: stored.key,
        file_url: stored.url,
      });
    }
  } catch (err) {
    return failed(err instanceof Error ? err.message : "No pudimos publicar la actividad.");
  }

  revalidatePath("/actividades");
  revalidatePath("/mi-perfil");
  revalidatePath("/");
  redirect(`/actividades/detalle/${activityId}`);
}
