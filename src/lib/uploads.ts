/**
 * Lo que el navegador y el servidor tienen que saber de una subida.
 *
 * Los archivos ya no viajan dentro del server action: uno acepta 1 MB de
 * cuerpo por defecto, y una guía en PDF nunca cabía — publicar con adjuntos
 * moría con "Body exceeded 1 MB limit" y el profesor perdía el formulario
 * entero. Ahora van de a uno a `POST /api/subidas`, que es una ruta normal y
 * no tiene ese tope, y el formulario manda después solo las referencias.
 *
 * El techo que queda es el de la plataforma: la función de Netlify que corre
 * la ruta acepta 6 MB de payload, y como el binario viaja en base64 eso deja
 * unos 4,5 MB reales. De ahí salen los números de abajo, con margen para el
 * encabezado. Subirlos más no es cosa de cambiar la constante: hay que dejar
 * que el navegador escriba directo en S3, y para eso el bucket necesita una
 * regla CORS que hoy no tiene.
 *
 * Este módulo es puro y lo importan los dos lados, para que el aviso que ve el
 * profesor y la regla que aplica el servidor no puedan separarse.
 */

export const MAX_FILES = 12;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
/** La portada es decoración, no un recurso; no necesita el cupo completo. */
export const MAX_COVER_BYTES = 3 * 1024 * 1024;

/** Lo que puede ser una portada o una foto de perfil. */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

/** Qué se sube: cambia la carpeta y el tamaño máximo. */
export type UploadKind = "cover" | "document";

export function maxBytesFor(kind: UploadKind): number {
  return kind === "cover" ? MAX_COVER_BYTES : MAX_FILE_BYTES;
}

/** En megabytes enteros, que es como se le dice al profesor. */
export function maxMbFor(kind: UploadKind): number {
  return Math.round(maxBytesFor(kind) / (1024 * 1024));
}

/** La carpeta del bucket, tal como la dejó la app Laravel. */
export function folderFor(kind: UploadKind): string {
  return kind === "cover" ? "actividades/portadas" : "actividades/recursos";
}

/** La ruta que recibe un archivo y lo deja en el bucket. */
export const UPLOAD_ENDPOINT = "/api/subidas";

/** Encabezados con los que la ruta sabe qué está recibiendo. */
export const KIND_HEADER = "x-upload-kind";
export const NAME_HEADER = "x-upload-name";

/**
 * Un archivo ya guardado en el bucket. `ticket` es la firma que prueba que esa
 * clave se la entregamos nosotros a este profesor: sin ella, el formulario
 * podría mandar la clave de cualquier objeto del bucket y colgarlo de su
 * actividad.
 */
export type UploadedFile = {
  key: string;
  ticket: string;
  name: string;
};

// ---------------------------------------------------------------------------
// El panel de administración
// ---------------------------------------------------------------------------

/**
 * La ruta por la que el panel escribe en el bucket.
 *
 * Es otra que la del profesor porque acepta otra cosa: cualquier carpeta, y no
 * sólo `actividades/portadas` o `actividades/recursos`; cualquier tipo de
 * archivo, y no sólo imágenes para la portada; y la autoriza la llave del
 * panel, no la sesión de nadie.
 */
export const ADMIN_UPLOAD_ENDPOINT = "/api/admin/subidas";

/** La carpeta del bucket donde dejar el archivo, percent-encoded. */
export const PREFIX_HEADER = "x-upload-prefix";

/** Cómo nombrar el objeto. Ver `AdminUploadMode`. */
export const MODE_HEADER = "x-upload-mode";

/**
 * `uuid` inventa el nombre, que es lo correcto para lo que sube alguien de
 * fuera: el nombre elegido nunca toca la clave y no hay forma de escribir
 * encima de otro objeto. `name` conserva el nombre original — el explorador de
 * archivos lo usa, porque ahí el nombre es justamente lo que se está
 * administrando — y la ruta le busca un sufijo libre si esa clave ya existe.
 */
export type AdminUploadMode = "uuid" | "name";

/**
 * El mismo techo que el resto: lo pone la plataforma, no la aplicación. La
 * función de Netlify acepta 6 MB de payload y el binario viaja en base64, así
 * que quedan unos 4,5 MB reales. Un archivo más grande que esto hay que
 * subirlo a S3 por fuera.
 */
export const MAX_ADMIN_FILE_BYTES = MAX_FILE_BYTES;

/**
 * Los atajos del explorador de archivos: las carpetas donde está de verdad lo
 * que el sitio muestra, contadas contra las columnas `*_key` de la base.
 *
 * `actividades/avatars` son las portadas que escribió Laravel (823 filas) y
 * `actividades/portadas` las que escribe esta aplicación (9): son dos carpetas
 * para lo mismo, y por eso están las dos. El bucket tiene alguna carpeta más
 * — `pruebas`, `backup-migracion` — a la que se llega navegando desde la raíz,
 * pero ninguna fila las nombra.
 */
export const KNOWN_FOLDERS = [
  "actividades/pdf",
  "actividades/avatars",
  "actividades/recursos",
  "actividades/portadas",
  "users/avatars",
] as const;

/**
 * Una clave de S3 utilizable: sin barra inicial, sin tramos vacíos y sin `..`.
 * Devuelve null cuando no queda nada aprovechable.
 */
export function normaliseKey(raw: string): string | null {
  const parts = raw
    .trim()
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..");
  const key = parts.join("/");
  return key.length > 0 && key.length <= 900 ? key : null;
}

/** Lo mismo para un prefijo: igual que una clave, pero terminado en barra. */
export function normalisePrefix(raw: string): string {
  const key = normaliseKey(raw);
  return key ? `${key}/` : "";
}

/**
 * Un nombre de archivo que puede vivir en una clave de S3: sin barras, sin
 * caracteres de control y sin espacios de sobra. El acento se conserva — el
 * bucket lo acepta y el nombre es lo que el profesor va a ver.
 */
export function safeFileName(raw: string): string {
  const name = raw
    .split("/")
    .pop()!
    .replace(/\p{Cc}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return name.slice(0, 200) || "archivo";
}
