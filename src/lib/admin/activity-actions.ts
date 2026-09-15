"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/session";
import { findUserIdByEmail } from "@/lib/admin/users";
import { ensureSubjectGrade } from "@/lib/catalog";
import { deleteObject, storedUrlFor } from "@/lib/storage";
import { T, db, unwrap } from "@/lib/supabase";
import { MOMENTS } from "@/lib/types";
import { done, failed, type AdminState } from "@/lib/admin/state";

/**
 * El CRUD de actividades del panel.
 *
 * Se parece a `createActivity` de `src/lib/activity-actions.ts` y hace a
 * propósito dos cosas distintas:
 *
 *   * El autor es un campo. Un profesor sólo puede publicar a su nombre — el
 *     suyo sale de la sesión y ningún campo del formulario lo cambia. El panel
 *     tiene que poder arreglar una actividad que quedó colgando de la cuenta
 *     equivocada, así que lo pide por correo y lo resuelve contra la tabla.
 *   * Las claves de S3 llegan sin ticket firmado. El ticket existe para que un
 *     formulario manipulado no pueda colgar de su actividad un objeto ajeno
 *     del bucket; quien tiene `ADMIN_KEY` puede tocar cualquier objeto del
 *     bucket de todas formas, así que aquí no protegería de nada.
 */

const activitySchema = z.object({
  title: z.string().trim().min(3, "El título es obligatorio.").max(300),
  learningObjective: z.string().trim().max(2000),
  description: z.string().trim().max(5000),
  evaluation: z.string().trim().max(5000),
  durationMinutes: z
    .union([z.literal(""), z.coerce.number().int().min(0).max(1000)])
    .transform((value) => (value === "" ? null : value)),
  subjectId: z.coerce.number().int().positive({ message: "Elige una asignatura." }),
  gradeId: z.coerce.number().int().positive({ message: "Elige un nivel." }),
  authorEmail: z
    .string()
    .trim()
    .min(1, "Escribe el correo del autor.")
    .max(320)
    .email("Ese correo no parece válido."),
});

function fieldsFrom(formData: FormData) {
  return activitySchema.safeParse({
    title: formData.get("title"),
    learningObjective: formData.get("learningObjective") ?? "",
    description: formData.get("description") ?? "",
    evaluation: formData.get("evaluation") ?? "",
    durationMinutes: formData.get("durationMinutes") ?? "",
    subjectId: formData.get("subjectId"),
    gradeId: formData.get("gradeId"),
    authorEmail: formData.get("authorEmail"),
  });
}

function idsFrom(formData: FormData, name: string): number[] {
  return formData
    .getAll(name)
    .map((value) => Number(value))
    .filter((id) => Number.isInteger(id) && id > 0);
}

/** Divide un textarea en líneas limpias. */
function lines(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function checked(formData: FormData, name: string): boolean {
  return formData.get(name) !== null;
}

/**
 * Deja la tabla hija con exactamente estas filas: borra las que hay y mete las
 * nuevas.
 *
 * Sin transacciones sobre PostgREST no hay forma de hacerlo atómico, así que
 * el borrado va primero y el error del insert sube: si algo falla, la
 * actividad se queda sin esas filas y el panel lo dice, en vez de quedar con
 * las viejas y las nuevas mezcladas.
 */
async function replaceChildren(
  table: string,
  activityId: number,
  rows: Record<string, unknown>[],
  what: string,
): Promise<void> {
  const removed = await db().from(table).delete().eq("activity_id", activityId);
  if (removed.error) throw new Error(`${what}: ${removed.error.message}`);
  if (rows.length === 0) return;
  const added = await db().from(table).insert(rows);
  if (added.error) throw new Error(`${what}: ${added.error.message}`);
}

/** Lo que comparten crear y editar: autor, par asignatura/nivel y columnas. */
async function commonFields(
  parsed: z.infer<typeof activitySchema>,
): Promise<{ userId: number; pairId: number; columns: Record<string, unknown> }> {
  const userId = await findUserIdByEmail(parsed.authorEmail);
  if (!userId) throw new Error(`No hay ninguna cuenta con el correo ${parsed.authorEmail}.`);

  const pairId = await ensureSubjectGrade(parsed.subjectId, parsed.gradeId);

  return {
    userId,
    pairId,
    columns: {
      title: parsed.title,
      learning_objective: parsed.learningObjective || null,
      description: parsed.description || null,
      evaluation: parsed.evaluation || null,
      duration_minutes: parsed.durationMinutes,
      user_id: userId,
      updated_at: new Date().toISOString(),
    },
  };
}

/** Guarda momentos, materiales y habilidades, que son los mismos en las dos. */
async function saveChildren(activityId: number, pairId: number, formData: FormData): Promise<void> {
  await replaceChildren(
    T.activitySubjectGrades,
    activityId,
    [{ activity_id: activityId, subject_grade_id: pairId }],
    "asignatura y nivel",
  );

  await replaceChildren(
    T.activitySkills,
    activityId,
    idsFrom(formData, "skillIds").map((skill_id) => ({ activity_id: activityId, skill_id })),
    "habilidades",
  );

  await replaceChildren(
    T.activityInstructions,
    activityId,
    MOMENTS.map((name) => ({ name, body: String(formData.get(`step_${name}`) ?? "").trim() }))
      .filter((step) => step.body)
      .map((step) => ({ activity_id: activityId, name: step.name, body: step.body })),
    "momentos de la clase",
  );

  await replaceChildren(
    T.activityMaterials,
    activityId,
    lines(formData.get("materials")).map((name) => ({ activity_id: activityId, name })),
    "materiales",
  );
}

export async function createAdminActivity(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const parsed = fieldsFrom(formData);
  if (!parsed.success) return failed(parsed.error.issues[0]?.message ?? "Revisa el formulario.");

  const coverKey = String(formData.get("coverKey") ?? "").trim();

  let activityId: number | null = null;
  try {
    const { pairId, columns } = await commonFields(parsed.data);

    const created = unwrap(
      await db()
        .from(T.activities)
        .insert({
          ...columns,
          cover_image_key: coverKey || null,
          cover_image_url: coverKey ? storedUrlFor(coverKey) : null,
        })
        .select("id")
        .single(),
      "create activity",
    ) as { id: number };
    activityId = created.id;

    await saveChildren(activityId, pairId, formData);
  } catch (err) {
    // Igual que en el formulario del profesor: sin transacciones, deshacer es
    // borrar la actividad, y el esquema se lleva en cascada lo que alcanzó a
    // entrar. El objeto de S3 queda huérfano, y nadie lo referencia.
    if (activityId !== null) {
      await db()
        .from(T.activities)
        .delete()
        .eq("id", activityId)
        .then(({ error }) => {
          if (error) console.error("[admin] no se pudo deshacer la actividad:", error.message);
        });
    }
    return failed(err instanceof Error ? err.message : "No pudimos crear la actividad.");
  }

  revalidatePath("/admin/actividades");
  revalidatePath("/actividades");
  redirect(`/admin/actividades/${activityId}?creada=1`);
}

export async function updateAdminActivity(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const activityId = Number(formData.get("id"));
  if (!Number.isInteger(activityId) || activityId <= 0) return failed("Actividad inválida.");

  const parsed = fieldsFrom(formData);
  if (!parsed.success) return failed(parsed.error.issues[0]?.message ?? "Revisa el formulario.");

  const coverKey = String(formData.get("coverKey") ?? "").trim();
  const removeCover = checked(formData, "removeCover");

  try {
    const { pairId, columns } = await commonFields(parsed.data);

    const patch: Record<string, unknown> = { ...columns };
    if (removeCover) {
      patch.cover_image_key = null;
      patch.cover_image_url = null;
    } else if (coverKey) {
      patch.cover_image_key = coverKey;
      patch.cover_image_url = storedUrlFor(coverKey);
    }

    const { error } = await db().from(T.activities).update(patch).eq("id", activityId);
    if (error) throw new Error(error.message);

    await saveChildren(activityId, pairId, formData);
  } catch (err) {
    return failed(err instanceof Error ? err.message : "No pudimos guardar la actividad.");
  }

  revalidatePath("/admin/actividades");
  revalidatePath(`/admin/actividades/${activityId}`);
  revalidatePath(`/actividades/detalle/${activityId}`);
  revalidatePath("/actividades");
  return done("Listo, la actividad quedó guardada.");
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

const documentSchema = z.object({
  name: z.string().trim().max(300),
  resourceTypeId: z
    .union([z.literal(""), z.coerce.number().int().positive()])
    .transform((value) => (value === "" ? null : value)),
  externalUrl: z
    .union([z.literal(""), z.string().trim().url("Ese enlace no parece válido.")])
    .transform((value) => (value === "" ? null : value)),
});

export async function addActivityDocument(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const activityId = Number(formData.get("activityId"));
  if (!Number.isInteger(activityId) || activityId <= 0) return failed("Actividad inválida.");

  const parsed = documentSchema.safeParse({
    name: formData.get("name") ?? "",
    resourceTypeId: formData.get("resourceTypeId") ?? "",
    externalUrl: formData.get("externalUrl") ?? "",
  });
  if (!parsed.success) return failed(parsed.error.issues[0]?.message ?? "Revisa el documento.");

  // O un archivo que ya subió `/api/admin/subidas`, o un enlace de fuera.
  const fileKey = String(formData.get("fileKey") ?? "").trim();
  if (!fileKey && !parsed.data.externalUrl) {
    return failed("Sube un archivo o pega un enlace.");
  }

  const { error } = await db().from(T.activityResources).insert({
    activity_id: activityId,
    resource_type_id: parsed.data.resourceTypeId,
    name: parsed.data.name,
    external_url: parsed.data.externalUrl,
    file_key: fileKey || null,
    file_url: fileKey ? storedUrlFor(fileKey) : null,
  });
  if (error) return failed(`No pudimos agregar el documento: ${error.message}`);

  revalidatePath(`/admin/actividades/${activityId}`);
  revalidatePath(`/actividades/detalle/${activityId}`);
  return done("Documento agregado.");
}

export async function updateActivityDocument(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const documentId = Number(formData.get("id"));
  const activityId = Number(formData.get("activityId"));
  if (!Number.isInteger(documentId) || documentId <= 0) return failed("Documento inválido.");

  const parsed = documentSchema.safeParse({
    name: formData.get("name") ?? "",
    resourceTypeId: formData.get("resourceTypeId") ?? "",
    externalUrl: formData.get("externalUrl") ?? "",
  });
  if (!parsed.success) return failed(parsed.error.issues[0]?.message ?? "Revisa el documento.");

  const patch: Record<string, unknown> = {
    name: parsed.data.name,
    resource_type_id: parsed.data.resourceTypeId,
    external_url: parsed.data.externalUrl,
    updated_at: new Date().toISOString(),
  };

  // Sólo si se eligió uno nuevo: en blanco quiere decir "deja el que tiene".
  const fileKey = String(formData.get("fileKey") ?? "").trim();
  if (fileKey) {
    patch.file_key = fileKey;
    patch.file_url = storedUrlFor(fileKey);
  }

  const { error } = await db().from(T.activityResources).update(patch).eq("id", documentId);
  if (error) return failed(`No pudimos guardar el documento: ${error.message}`);

  revalidatePath(`/admin/actividades/${activityId}`);
  revalidatePath(`/actividades/detalle/${activityId}`);
  return done("Documento guardado.");
}

/**
 * Quita el documento de la actividad y, si se pidió, el archivo del bucket.
 *
 * Las dos cosas por separado porque son dos cosas: el mismo objeto puede estar
 * colgado de más de una fila, y el bucket de producción puede no dar permiso
 * de borrado. Si la fila se va y el objeto no, lo dice — no se calla un
 * archivo que sigue ahí.
 */
export async function deleteActivityDocument(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const documentId = Number(formData.get("id"));
  const activityId = Number(formData.get("activityId"));
  if (!Number.isInteger(documentId) || documentId <= 0) return failed("Documento inválido.");

  const { data, error: readError } = await db()
    .from(T.activityResources)
    .select("file_key")
    .eq("id", documentId)
    .maybeSingle();
  if (readError) return failed(`No pudimos leer el documento: ${readError.message}`);

  const { error } = await db().from(T.activityResources).delete().eq("id", documentId);
  if (error) return failed(`No pudimos borrar el documento: ${error.message}`);

  let notice = "Documento eliminado.";
  const fileKey = (data as { file_key: string | null } | null)?.file_key;
  if (checked(formData, "alsoFile") && fileKey) {
    try {
      await deleteObject(fileKey);
      notice = "Documento eliminado, y el archivo borrado del bucket.";
    } catch (err) {
      notice =
        "Documento eliminado, pero el archivo sigue en el bucket: " +
        (err instanceof Error ? err.message : "S3 rechazó el borrado.");
    }
  }

  revalidatePath(`/admin/actividades/${activityId}`);
  revalidatePath(`/actividades/detalle/${activityId}`);
  return done(notice);
}

// ---------------------------------------------------------------------------
// Borrar, restaurar y eliminar
// ---------------------------------------------------------------------------

/** La saca del catálogo sin perder nada: es lo que hace el sitio. */
export async function deleteAdminActivity(formData: FormData): Promise<void> {
  await requireAdmin();
  const activityId = Number(formData.get("id"));
  if (!Number.isInteger(activityId) || activityId <= 0) throw new Error("Actividad inválida.");

  const { error } = await db()
    .from(T.activities)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", activityId);
  if (error) throw new Error(`delete activity: ${error.message}`);

  revalidatePath("/admin/actividades");
  revalidatePath("/actividades");
  redirect(`/admin/actividades/${activityId}?estado=borrada`);
}

export async function restoreAdminActivity(formData: FormData): Promise<void> {
  await requireAdmin();
  const activityId = Number(formData.get("id"));
  if (!Number.isInteger(activityId) || activityId <= 0) throw new Error("Actividad inválida.");

  const { error } = await db()
    .from(T.activities)
    .update({ deleted_at: null })
    .eq("id", activityId);
  if (error) throw new Error(`restore activity: ${error.message}`);

  revalidatePath("/admin/actividades");
  revalidatePath("/actividades");
  redirect(`/admin/actividades/${activityId}?estado=restaurada`);
}

/**
 * Borra la fila de verdad, con sus documentos, comentarios y guardados.
 *
 * Los objetos de S3 no se tocan: quedan huérfanos en el bucket y desde
 * /admin/archivos se pueden borrar a mano. Es a propósito — una actividad
 * eliminada por error se puede volver a armar si los archivos siguen ahí.
 */
export async function purgeAdminActivity(formData: FormData): Promise<void> {
  await requireAdmin();
  const activityId = Number(formData.get("id"));
  if (!Number.isInteger(activityId) || activityId <= 0) throw new Error("Actividad inválida.");

  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "ELIMINAR") {
    redirect(`/admin/actividades/${activityId}?estado=confirmacion`);
  }

  const { error } = await db().from(T.activities).delete().eq("id", activityId);
  if (error) throw new Error(`purge activity: ${error.message}`);

  revalidatePath("/admin/actividades");
  revalidatePath("/actividades");
  redirect("/admin/actividades?estado=eliminada");
}
