"use client";

import {
  KIND_HEADER,
  MAX_FILES,
  NAME_HEADER,
  UPLOAD_ENDPOINT,
  maxBytesFor,
  maxMbFor,
  type UploadKind,
  type UploadedFile,
} from "@/lib/uploads";

/**
 * Subir los archivos antes de publicar.
 *
 * Van de a uno a `POST /api/subidas`, que los guarda en el bucket y devuelve
 * la clave. El formulario después manda solo esas claves, así que el server
 * action recibe un cuerpo de unos cientos de bytes por mucho que pesen las
 * guías — que es justo lo que antes lo reventaba.
 *
 * Un archivo que falla corta el resto: publicar una actividad a la que le
 * falta la mitad de los documentos es peor que no publicarla.
 */

export type PickedUpload = { kind: UploadKind; file: File };

export type UploadOutcome =
  | { ok: true; cover: UploadedFile | null; files: UploadedFile[] }
  | { ok: false; error: string };

export async function uploadPicked(
  picked: PickedUpload[],
  onProgress?: (done: number, total: number) => void,
): Promise<UploadOutcome> {
  if (picked.length === 0) return { ok: true, cover: null, files: [] };
  if (picked.filter((p) => p.kind === "document").length > MAX_FILES) {
    return { ok: false, error: `Máximo ${MAX_FILES} archivos por actividad.` };
  }

  // Antes de gastar la primera subida: si uno no cabe, no cabe.
  for (const { kind, file } of picked) {
    if (file.size > maxBytesFor(kind)) {
      return {
        ok: false,
        error:
          kind === "cover"
            ? `La portada supera los ${maxMbFor(kind)} MB.`
            : `"${file.name}" supera los ${maxMbFor(kind)} MB.`,
      };
    }
  }

  let cover: UploadedFile | null = null;
  const files: UploadedFile[] = [];

  for (let i = 0; i < picked.length; i++) {
    const { kind, file } = picked[i]!;
    onProgress?.(i, picked.length);

    let response: Response;
    try {
      response = await fetch(UPLOAD_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": file.type || "application/octet-stream",
          [KIND_HEADER]: kind,
          // Un encabezado HTTP no admite la ñ; la ruta lo decodifica.
          [NAME_HEADER]: encodeURIComponent(file.name),
        },
        body: file,
      });
    } catch {
      return { ok: false, error: `No pudimos subir "${file.name}". Revisa tu conexión.` };
    }

    if (!response.ok) {
      return { ok: false, error: await errorFrom(response, file.name) };
    }

    const stored = (await response.json()) as Partial<UploadedFile>;
    if (!stored?.key || !stored?.ticket) {
      return { ok: false, error: `No pudimos subir "${file.name}". Vuelve a intentarlo.` };
    }

    const uploaded: UploadedFile = { key: stored.key, ticket: stored.ticket, name: file.name };
    if (kind === "cover") cover = uploaded;
    else files.push(uploaded);
  }

  onProgress?.(picked.length, picked.length);
  return { ok: true, cover, files };
}

/**
 * El mensaje que mandó la ruta, o uno propio. Un 413 puede venir de la
 * plataforma antes de llegar a la ruta, y entonces el cuerpo no es JSON.
 */
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
