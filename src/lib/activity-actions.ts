"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { notifyActivityCommented } from "@/lib/notifications";
import { storedUrlFor } from "@/lib/storage";
import { T, db, unwrap } from "@/lib/supabase";
import { MOMENTS } from "@/lib/types";
import { verifyUploadTicket } from "@/lib/upload-ticket";
import { MAX_FILES } from "@/lib/uploads";

/**
 * Writing activities: saving one, recording a download, commenting, and
 * publishing a new one.
 *
 * Every action re-reads the session server-side — a form field claiming a user
 * id would be trusted by nothing here. Lo mismo vale para los archivos: el
 * navegador los sube directo al bucket y manda solo la clave, que solo se
 * acepta si viene con el ticket firmado que se la entregó (`upload-ticket`).
 */

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

/** Un archivo que el navegador ya dejó en el bucket, con su comprobante. */
const uploadedSchema = z.object({
  key: z.string().min(1).max(500),
  ticket: z.string().min(1),
  name: z.string().max(300).default(""),
});

const uploadsSchema = z.object({
  cover: uploadedSchema.nullable().default(null),
  files: z.array(uploadedSchema).max(MAX_FILES).default([]),
});

type Uploads = z.infer<typeof uploadsSchema>;

/**
 * Lee las referencias de los archivos que el navegador ya subió y comprueba
 * que cada una venga con el ticket que se la entregó a este profesor. Una
 * clave sin ticket válido se descarta entera: es la única defensa contra un
 * formulario manipulado que apunte a objetos ajenos del bucket.
 */
async function readUploads(value: FormDataEntryValue | null, userId: number): Promise<Uploads> {
  if (typeof value !== "string" || !value) return { cover: null, files: [] };

  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    throw new Error("No pudimos leer los archivos subidos. Vuelve a intentarlo.");
  }

  const parsed = uploadsSchema.safeParse(raw);
  if (!parsed.success) throw new Error("No pudimos leer los archivos subidos. Vuelve a intentarlo.");

  const { cover, files } = parsed.data;
  if (cover && !(await verifyUploadTicket(cover.ticket, cover.key, userId, "cover"))) {
    throw new Error("La portada no se subió correctamente. Vuelve a elegirla.");
  }
  for (const file of files) {
    if (!(await verifyUploadTicket(file.ticket, file.key, userId, "document"))) {
      throw new Error(`"${file.name}" no se subió correctamente. Vuelve a elegirlo.`);
    }
  }
  return parsed.data;
}

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

/**
 * Inserta y revienta si Postgres se queja.
 *
 * Cada una de estas filas — la asignatura, las habilidades, los momentos, los
 * materiales — es parte de la actividad, no un adorno. Ignorar su error
 * publicaba una actividad a medias sin decírselo a nadie: la que se quedaba
 * sin su fila de asignatura/nivel ni siquiera aparecía al filtrar.
 */
async function insertAll(table: string, rows: Record<string, unknown>[], what: string) {
  if (rows.length === 0) return;
  const { error } = await db().from(table).insert(rows);
  if (error) throw new Error(`${what}: ${error.message}`);
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

  let uploads: Uploads;
  try {
    uploads = await readUploads(formData.get("uploads"), session.userId);
  } catch (err) {
    return failed(err instanceof Error ? err.message : "Revisa los archivos.");
  }

  let activityId: number | null = null;
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
          // La portada ya está en el bucket; aquí solo se guarda su referencia.
          cover_image_key: uploads.cover?.key ?? null,
          cover_image_url: uploads.cover ? storedUrlFor(uploads.cover.key) : null,
          user_id: session.userId,
        })
        .select("id")
        .single(),
      "create activity",
    ) as { id: number };
    activityId = activity.id;

    await insertAll(
      T.activitySubjectGrades,
      [{ activity_id: activityId, subject_grade_id: pairId }],
      "asignatura y nivel",
    );

    const skillIds = formData
      .getAll("skillIds")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n > 0);
    await insertAll(
      T.activitySkills,
      skillIds.map((skill_id) => ({ activity_id: activityId, skill_id })),
      "habilidades",
    );

    // "Momentos de la clase" — one instruction row per filled-in moment.
    const steps = MOMENTS.map((name) => ({
      name,
      body: String(formData.get(`step_${name}`) ?? "").trim(),
    })).filter((s) => s.body);
    await insertAll(
      T.activityInstructions,
      steps.map((s) => ({ activity_id: activityId, name: s.name, body: s.body })),
      "momentos de la clase",
    );

    await insertAll(
      T.activityMaterials,
      lines(formData.get("materials")).map((name) => ({ activity_id: activityId, name })),
      "materiales",
    );

    await insertAll(
      T.activityResources,
      uploads.files.map((file) => ({
        activity_id: activityId,
        resource_type_id: parsed.data.resourceTypeId ?? null,
        name: file.name,
        file_key: file.key,
        file_url: storedUrlFor(file.key),
      })),
      "documentos",
    );
  } catch (err) {
    // Sin transacciones sobre PostgREST, deshacer es borrar la actividad: el
    // esquema cascadea, así que se lleva las filas hijas que alcanzaron a
    // entrar. Los objetos de S3 quedan — las credenciales del bucket no tienen
    // permiso de borrado — pero son huérfanos que nadie referencia.
    if (activityId !== null) {
      await db()
        .from(T.activities)
        .delete()
        .eq("id", activityId)
        .then(({ error }) => {
          if (error) console.error("[crear] no se pudo deshacer la actividad:", error.message);
        });
    }
    return failed(err instanceof Error ? err.message : "No pudimos publicar la actividad.");
  }

  revalidatePath("/actividades");
  revalidatePath("/mi-perfil");
  revalidatePath("/");
  redirect(`/actividades/detalle/${activityId}`);
}
