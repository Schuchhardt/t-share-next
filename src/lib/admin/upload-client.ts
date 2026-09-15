"use client";

import {
  ADMIN_UPLOAD_ENDPOINT,
  MAX_ADMIN_FILE_BYTES,
  MODE_HEADER,
  NAME_HEADER,
  PREFIX_HEADER,
  type AdminUploadMode,
} from "@/lib/uploads";

/**
 * Subir un archivo desde el panel.
 *
 * Igual que en el formulario del profesor, el archivo no viaja dentro del
 * server action: uno acepta 1 MB de cuerpo y cualquier PDF de verdad lo
 * revienta. Va antes a `/api/admin/subidas`, que devuelve la clave, y el
 * formulario manda después sólo esa clave.
 */

export type AdminUploadResult =
  | { ok: true; key: string; name: string; size: number }
  | { ok: false; error: string };

export async function uploadToBucket(
  file: File,
  prefix: string,
  mode: AdminUploadMode = "uuid",
): Promise<AdminUploadResult> {
  if (file.size === 0) return { ok: false, error: `"${file.name}" está vacío.` };
  if (file.size > MAX_ADMIN_FILE_BYTES) {
    return {
      ok: false,
      error: `"${file.name}" supera los ${Math.round(MAX_ADMIN_FILE_BYTES / (1024 * 1024))} MB.`,
    };
  }

  let response: Response;
  try {
    response = await fetch(ADMIN_UPLOAD_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": file.type || "application/octet-stream",
        // Un encabezado HTTP no admite la ñ; la ruta lo decodifica.
        [NAME_HEADER]: encodeURIComponent(file.name),
        [PREFIX_HEADER]: encodeURIComponent(prefix),
        [MODE_HEADER]: mode,
      },
      body: file,
    });
  } catch {
    return { ok: false, error: `No pudimos subir "${file.name}". Revisa tu conexión.` };
  }

  if (!response.ok) {
    return { ok: false, error: await errorFrom(response, file.name) };
  }

  const stored = (await response.json()) as { key?: string; name?: string; size?: number };
  if (!stored?.key) {
    return { ok: false, error: `No pudimos subir "${file.name}". Vuelve a intentarlo.` };
  }
  return { ok: true, key: stored.key, name: stored.name ?? file.name, size: stored.size ?? file.size };
}

/** Lo que dijo la ruta, o algo propio: un 413 puede venir de la plataforma
 * antes de llegar a ella, y entonces el cuerpo no es JSON. */
async function errorFrom(response: Response, fileName: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error) return body.error;
  } catch {
    // Cae al mensaje de abajo.
  }
  if (response.status === 413) return `"${fileName}" es demasiado pesado.`;
  return `No pudimos subir "${fileName}" (${response.status}).`;
}
