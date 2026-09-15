import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { hasStorageConfig } from "@/lib/env";
import { objectExists, putFile, uploadKey } from "@/lib/storage";
import {
  MAX_ADMIN_FILE_BYTES,
  MODE_HEADER,
  NAME_HEADER,
  PREFIX_HEADER,
  normalisePrefix,
  safeFileName,
  type AdminUploadMode,
} from "@/lib/uploads";
import { fileExtension } from "@/lib/preview";

/**
 * Escribe en el bucket para el panel de administración.
 *
 * Es hermana de `/api/subidas`, la del formulario del profesor, y cambian tres
 * cosas: la autoriza `tshare_admin` y no la sesión de un profesor; la carpeta
 * llega en un encabezado en vez de estar fijada a dos; y no devuelve ticket
 * firmado — el ticket existe para que un formulario manipulado no pueda colgar
 * de una actividad un objeto ajeno, y quien tiene la llave del panel puede
 * tocar cualquier objeto del bucket de todas formas.
 *
 * El cuerpo es el archivo tal cual. Con `multipart` se irían varios cientos de
 * kilobytes del presupuesto de 6 MB de la función en el sobre.
 *
 * La cookie del panel es `sameSite=strict`, así que un POST desde otro sitio
 * llega sin ella y esto responde 401.
 */

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Tu sesión del panel expiró." }, { status: 401 });
  }
  if (!hasStorageConfig()) {
    return NextResponse.json(
      { error: "S3 no está configurado en este entorno." },
      { status: 503 },
    );
  }

  const prefix = normalisePrefix(decodeHeader(request.headers.get(PREFIX_HEADER)));
  if (!prefix) {
    return NextResponse.json({ error: "Elige una carpeta." }, { status: 400 });
  }

  const name = safeFileName(decodeHeader(request.headers.get(NAME_HEADER)) || "archivo");
  const mode: AdminUploadMode = request.headers.get(MODE_HEADER) === "name" ? "name" : "uuid";
  const type = (request.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength === 0) {
    return NextResponse.json({ error: `"${name}" está vacío.` }, { status: 400 });
  }
  if (body.byteLength > MAX_ADMIN_FILE_BYTES) {
    return NextResponse.json(
      {
        error:
          `"${name}" supera los ${Math.round(MAX_ADMIN_FILE_BYTES / (1024 * 1024))} MB, ` +
          "que es lo que acepta la función. Un archivo más grande hay que subirlo a S3 por fuera.",
      },
      { status: 413 },
    );
  }

  try {
    const key = mode === "name" ? await freeKey(prefix, name) : uploadKey(prefix.slice(0, -1), name);
    const stored = await putFile(key, body, type || "application/octet-stream");
    return NextResponse.json({ key: stored.key, name, size: body.byteLength });
  } catch (err) {
    console.error("[admin/subidas] no se pudo guardar el archivo:", err);
    return NextResponse.json(
      {
        error: `No pudimos guardar "${name}": ${err instanceof Error ? err.message : "S3 lo rechazó."}`,
      },
      { status: 502 },
    );
  }
}

/** El nombre viaja percent-encoded porque un encabezado HTTP no admite la ñ. */
function decodeHeader(header: string | null): string {
  if (!header) return "";
  try {
    return decodeURIComponent(header);
  } catch {
    return "";
  }
}

/**
 * La clave pedida, o la misma con un sufijo, si ya hay un objeto ahí.
 *
 * Conservar el nombre original y sobrescribir en silencio sería la peor
 * combinación posible: dos archivos distintos con el mismo nombre y uno de
 * ellos perdido sin que nadie lo pida. Después de diez intentos se rinde y
 * deja que el nombre lo invente un UUID.
 */
async function freeKey(prefix: string, name: string): Promise<string> {
  const ext = fileExtension(name);
  const stem = ext ? name.slice(0, -(ext.length + 1)) : name;

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate =
      attempt === 0
        ? `${prefix}${name}`
        : `${prefix}${stem}-${attempt}${ext ? `.${ext}` : ""}`;
    if (!(await objectExists(candidate))) return candidate;
  }
  return uploadKey(prefix.slice(0, -1), name);
}
