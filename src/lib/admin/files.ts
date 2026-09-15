import "server-only";
import { storedUrlFor } from "@/lib/storage";
import { T, db } from "@/lib/supabase";

/**
 * Quién apunta a un objeto del bucket.
 *
 * S3 no lo sabe: una clave es una clave, y borrarla deja la fila que la
 * nombraba apuntando al vacío — una portada rota, una guía que responde 404 al
 * profesor que la descarga. Como la base tampoco lo sabe (no hay una tabla de
 * archivos, hay seis columnas `*_key` repartidas), esto las recorre para que
 * el panel pueda decir qué se va a llevar por delante antes de llevárselo.
 */

/** Las columnas del esquema que guardan una clave de S3, con su gemela `*_url`. */
const FILE_COLUMNS = [
  { table: T.activities, keyColumn: "cover_image_key", urlColumn: "cover_image_url", what: "portada de actividad" },
  { table: T.activities, keyColumn: "pdf_key", urlColumn: "pdf_url", what: "PDF de actividad" },
  { table: T.activityResources, keyColumn: "file_key", urlColumn: "file_url", what: "documento de actividad" },
  { table: T.activityInstructions, keyColumn: "file_key", urlColumn: "file_url", what: "momento de la clase" },
  { table: T.activityMaterials, keyColumn: "file_key", urlColumn: "file_url", what: "material" },
  { table: T.users, keyColumn: "avatar_key", urlColumn: "avatar_url", what: "foto de perfil" },
] as const;

export type FileReference = { what: string; count: number };

/** Dónde se usa esa clave, y cuántas veces en cada sitio. */
export async function referencesTo(key: string): Promise<FileReference[]> {
  const found = await Promise.all(
    FILE_COLUMNS.map(async (column) => {
      const { count, error } = await db()
        .from(column.table)
        .select("id", { count: "exact", head: true })
        .eq(column.keyColumn, key);
      if (error) throw new Error(`references: ${error.message}`);
      return { what: column.what, count: count ?? 0 };
    }),
  );
  return found.filter((reference) => reference.count > 0);
}

export function totalReferences(references: FileReference[]): number {
  return references.reduce((sum, reference) => sum + reference.count, 0);
}

/**
 * Apunta a la clave nueva todas las filas que nombraban la vieja, o las deja
 * sin archivo cuando `to` es null.
 *
 * Es lo que convierte "renombrar" en una operación de verdad y no en una forma
 * de romper la base: el objeto se mueve y las filas se mueven con él.
 */
export async function retargetReferences(from: string, to: string | null): Promise<number> {
  let touched = 0;
  for (const column of FILE_COLUMNS) {
    const { data, error } = await db()
      .from(column.table)
      .update({
        [column.keyColumn]: to,
        [column.urlColumn]: to ? storedUrlFor(to) : null,
      })
      .eq(column.keyColumn, from)
      .select("id");
    if (error) throw new Error(`retarget ${column.table}: ${error.message}`);
    touched += (data ?? []).length;
  }
  return touched;
}
