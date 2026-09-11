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
