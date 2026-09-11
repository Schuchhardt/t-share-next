import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hasStorageConfig } from "@/lib/env";
import { putFile, uploadKey } from "@/lib/storage";
import { signUploadTicket } from "@/lib/upload-ticket";
import {
  IMAGE_TYPES,
  KIND_HEADER,
  NAME_HEADER,
  folderFor,
  maxBytesFor,
  maxMbFor,
  type UploadKind,
} from "@/lib/uploads";

/**
 * Recibe un archivo del formulario de publicación y lo deja en el bucket.
 *
 * Es una ruta y no un server action a propósito: un server action acepta 1 MB
 * de cuerpo y rechazaba cualquier guía de verdad. Una ruta no tiene ese tope,
 * así que el techo pasa a ser el de Netlify (6 MB de payload, ~4,5 MB de
 * binario una vez en base64) y de ahí salen los máximos de `@/lib/uploads`.
 *
 * El cuerpo es el archivo tal cual, sin envolver en multipart: son dos campos
 * de metadatos y así no se gastan bytes del presupuesto en el sobre. El nombre
 * viaja en un encabezado y por eso va percent-encoded — un encabezado HTTP no
 * admite la ñ.
 *
 * Lo que devuelve es la clave donde quedó y un ticket firmado. `createActivity`
 * no acepta una clave sin su ticket: el navegador podría mandar cualquiera.
 *
 * Un `POST` de otro sitio no llega aquí: la cookie de sesión es `sameSite=lax`,
 * así que en una petición cross-site no se manda y esto responde 401.
 */

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Tu sesión expiró. Vuelve a entrar." }, { status: 401 });
  }
  if (!hasStorageConfig()) {
    return NextResponse.json(
      { error: "La subida de archivos no está configurada en este entorno." },
      { status: 503 },
    );
  }

  const kind = request.headers.get(KIND_HEADER);
  if (kind !== "cover" && kind !== "document") {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const name = readName(request.headers.get(NAME_HEADER));
  const type = (request.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();

  if (kind === "cover" && !IMAGE_TYPES.includes(type as (typeof IMAGE_TYPES)[number])) {
    return NextResponse.json(
      { error: "La portada tiene que ser una imagen (JPG, PNG, GIF o WEBP)." },
      { status: 415 },
    );
  }

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength === 0) {
    return NextResponse.json({ error: `"${name}" está vacío.` }, { status: 400 });
  }
  // El navegador ya lo comprobó, pero es él quien elige el archivo: la regla
  // que manda es esta.
  if (body.byteLength > maxBytesFor(kind)) {
    return NextResponse.json({ error: tooBig(kind, name) }, { status: 413 });
  }

  try {
    // `uploadKey` inventa un UUID: el nombre que eligió el profesor nunca toca
    // la clave, así que no hay forma de escribir encima de otro objeto.
    const stored = await putFile(
      uploadKey(folderFor(kind), name),
      body,
      type || "application/octet-stream",
    );
    return NextResponse.json({
      key: stored.key,
      ticket: await signUploadTicket(stored.key, session.userId, kind),
      name,
    });
  } catch (err) {
    console.error("[subidas] no se pudo guardar el archivo:", err);
    return NextResponse.json(
      { error: `No pudimos guardar "${name}". Vuelve a intentarlo.` },
      { status: 502 },
    );
  }
}

function tooBig(kind: UploadKind, name: string): string {
  return kind === "cover"
    ? `La portada supera los ${maxMbFor(kind)} MB.`
    : `"${name}" supera los ${maxMbFor(kind)} MB.`;
}

/** El nombre original, o algo razonable si el encabezado viene roto. */
function readName(header: string | null): string {
  if (!header) return "archivo";
  try {
    return decodeURIComponent(header).slice(0, 300) || "archivo";
  } catch {
    return "archivo";
  }
}
