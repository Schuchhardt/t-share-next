"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/session";
import { referencesTo, retargetReferences, totalReferences } from "@/lib/admin/files";
import { done, failed, type AdminState } from "@/lib/admin/state";
import { copyObject, deleteObject, objectExists } from "@/lib/storage";
import { normaliseKey } from "@/lib/uploads";

/**
 * Lo que el explorador de archivos puede hacerle al bucket: mover un objeto y
 * borrarlo. Subir va por `/api/admin/subidas`, porque un server action no
 * acepta más de 1 MB de cuerpo.
 *
 * Las dos operaciones arrastran las filas que nombraban esa clave. Es la
 * diferencia entre administrar el bucket y romperlo: sin eso, renombrar una
 * portada la borra de la actividad que la mostraba, y el panel no diría nada.
 */

/** "3 documentos de actividad y 1 foto de perfil". */
function describe(references: { what: string; count: number }[]): string {
  return references.map((r) => `${r.count} ${r.what}${r.count === 1 ? "" : "s"}`).join(", ");
}

export async function renameStoredObject(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const from = normaliseKey(String(formData.get("key") ?? ""));
  const to = normaliseKey(String(formData.get("newKey") ?? ""));
  if (!from) return failed("Clave inválida.");
  if (!to) return failed("Escribe la clave nueva.");
  if (from === to) return failed("La clave nueva es la misma.");

  let touched: number;
  try {
    if (await objectExists(to)) return failed(`Ya hay un objeto en ${to}.`);

    // Copiar primero y mover las filas después: si la copia falla no se ha
    // tocado nada, y si algo sale mal más adelante las filas siguen apuntando
    // a un objeto que existe.
    await copyObject(from, to);
    touched = await retargetReferences(from, to);
  } catch (err) {
    return failed(
      `No pudimos mover el archivo: ${err instanceof Error ? err.message : "S3 lo rechazó."}`,
    );
  }

  // Borrar el original es limpieza, no parte del movimiento. En este bucket
  // falla — las credenciales no tienen `s3:DeleteObject` — y aun así el
  // movimiento está hecho: la copia existe y las filas la nombran. Fallar aquí
  // habría dejado el trabajo hecho y el mensaje diciendo que no.
  let leftover: string | null = null;
  try {
    await deleteObject(from);
  } catch (err) {
    leftover = err instanceof Error ? err.message : "S3 rechazó el borrado";
  }

  revalidatePath("/admin/archivos");
  revalidatePath("/actividades");

  const moved = touched > 0
    ? `Movido a ${to}. ${touched} fila${touched === 1 ? "" : "s"} apunta${touched === 1 ? "" : "n"} ahora ahí.`
    : `Movido a ${to}.`;

  return done(
    leftover ? `${moved} La copia vieja sigue en ${from}: ${leftover}.` : moved,
  );
}

/**
 * Borra el objeto del bucket.
 *
 * Si alguna fila lo nombraba, no lo hace a la primera: dice qué lo usa y pide
 * marcar la casilla. Con ella marcada, borra el objeto y deja esas filas sin
 * archivo — que es la verdad de lo que pasó, y no una clave que ya no resuelve.
 */
export async function deleteStoredObject(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const key = normaliseKey(String(formData.get("key") ?? ""));
  if (!key) return failed("Clave inválida.");

  try {
    const references = await referencesTo(key);
    const used = totalReferences(references);
    if (used > 0 && formData.get("confirm") === null) {
      return failed(
        `Ese archivo lo usa ${describe(references)}. Marca la casilla para borrarlo igual: ` +
          `esas filas van a quedar sin archivo.`,
      );
    }

    await deleteObject(key);
    if (used > 0) await retargetReferences(key, null);

    revalidatePath("/admin/archivos");
    revalidatePath("/actividades");
    return done(
      used > 0
        ? `Borrado. ${used} fila${used === 1 ? "" : "s"} quedó sin archivo.`
        : "Borrado del bucket.",
    );
  } catch (err) {
    return failed(
      `No pudimos borrar el archivo: ${err instanceof Error ? err.message : "S3 lo rechazó."}`,
    );
  }
}
