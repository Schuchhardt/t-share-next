import "server-only";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, hasStorageConfig } from "@/lib/env";

/**
 * File storage, still on the S3 bucket the Laravel app wrote to.
 *
 * The bucket is not part of the migration, so two shapes of reference coexist
 * and every table that holds a file carries both columns:
 *
 *   * `*_key` — an S3 object key, e.g. `actividades/pdf/1076-....pdf`. That is
 *     what the old app stored, and those objects are private, so reading one
 *     means signing a temporary URL (Laravel did the same with
 *     `Storage::disk('s3')->temporaryUrl(...)`).
 *   * `*_url` — an absolute URL. New uploads write this, so the common path
 *     costs no signing round-trip.
 *
 * `fileUrl()` resolves whichever is present.
 *
 * Las subidas nuevas entran por `POST /api/subidas`, que llama a `putFile()` y
 * guarda solo la clave: el navegador no habla con S3 directamente porque el
 * bucket no tiene CORS habilitado.
 */

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6;

let cached: S3Client | null = null;

function s3(): S3Client {
  cached ??= new S3Client({
    region: env.s3Region,
    credentials: {
      accessKeyId: env.s3AccessKeyId,
      secretAccessKey: env.s3SecretAccessKey,
    },
  });
  return cached;
}

/** Where a newly uploaded file lands, mirroring the old app's layout. */
export function uploadKey(folder: string, originalName: string): string {
  const ext = originalName.includes(".") ? originalName.split(".").pop()!.toLowerCase() : "bin";
  const safeExt = /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
  // `crypto.randomUUID` is available in the Node runtime Next.js uses here.
  return `${folder}/${crypto.randomUUID()}.${safeExt}`;
}

export type StoredFile = { key: string; url: string | null };

/**
 * Writes a file and returns both references. `url` is filled in only when the
 * bucket is fronted by a public base URL; otherwise reads go through a signed
 * URL, exactly like the migrated rows.
 */
export async function putFile(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<StoredFile> {
  await s3().send(
    new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return { key, url: env.s3PublicBaseUrl ? `${env.s3PublicBaseUrl}/${key}` : null };
}

/**
 * La URL absoluta con la que se guarda un objeto recién subido, o null cuando
 * el bucket es privado y hay que firmar cada lectura. Es lo mismo que devuelve
 * `putFile`, para las subidas que ya no pasan por el servidor.
 */
export function storedUrlFor(key: string): string | null {
  return env.s3PublicBaseUrl ? `${env.s3PublicBaseUrl}/${key}` : null;
}

/**
 * Resolves a stored file to something an `<a href>` or `<img src>` can use.
 * Returns null when the row has neither reference, or when S3 is not
 * configured — callers render a placeholder rather than a broken link.
 */
export async function fileUrl(
  file: { key?: string | null; url?: string | null } | null | undefined,
): Promise<string | null> {
  if (!file) return null;
  if (file.url) return file.url;
  if (!file.key) return null;
  if (!hasStorageConfig()) return null;

  if (env.s3PublicBaseUrl) return `${env.s3PublicBaseUrl}/${file.key}`;

  try {
    return await getSignedUrl(
      s3(),
      new GetObjectCommand({ Bucket: env.s3Bucket, Key: file.key }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
  } catch {
    // A missing object or a credential problem should not take a page down.
    return null;
  }
}

// ---------------------------------------------------------------------------
// El bucket como carpeta — sólo lo usa el panel de administración
// ---------------------------------------------------------------------------

/**
 * Lo que S3 devuelve de un objeto cuando se lo lista, que es menos de lo que
 * tiene: no hay forma de saber el tipo sin pedirlo objeto por objeto.
 */
export type StoredObject = {
  key: string;
  size: number;
  lastModified: string | null;
};

export type ObjectPage = {
  /** Las "carpetas" que cuelgan del prefijo. S3 no tiene carpetas: son los
   * prefijos comunes hasta la primera barra, que es lo mismo a efectos de
   * navegar. */
  folders: string[];
  objects: StoredObject[];
  /** Con qué pedir la página siguiente, o null cuando no hay más. */
  next: string | null;
};

/** Cuántos objetos trae una página del explorador. */
const LIST_PAGE_SIZE = 100;

/**
 * Un tramo del bucket.
 *
 * Con `Delimiter: "/"` S3 devuelve el nivel y no el árbol entero, que en este
 * bucket son decenas de miles de objetos. La paginación es por token opaco
 * (`ContinuationToken`) y no por número de página: no hay forma de saltar a la
 * página siete sin haber pasado por las seis anteriores.
 */
export async function listObjects(prefix: string, cursor?: string | null): Promise<ObjectPage> {
  const result = await s3().send(
    new ListObjectsV2Command({
      Bucket: env.s3Bucket,
      Prefix: prefix || undefined,
      Delimiter: "/",
      MaxKeys: LIST_PAGE_SIZE,
      ContinuationToken: cursor || undefined,
    }),
  );

  return {
    folders: (result.CommonPrefixes ?? [])
      .map((p) => p.Prefix)
      .filter((p): p is string => Boolean(p)),
    objects: (result.Contents ?? [])
      // Una clave que termina en "/" es la carpeta misma, creada por alguna
      // consola; como objeto no es nada y no se puede abrir.
      .filter((o) => o.Key && o.Key !== prefix && !o.Key.endsWith("/"))
      .map((o) => ({
        key: o.Key!,
        size: o.Size ?? 0,
        lastModified: o.LastModified ? o.LastModified.toISOString() : null,
      })),
    next: result.IsTruncated ? (result.NextContinuationToken ?? null) : null,
  };
}

/** True cuando el objeto existe. Un error de permisos cuenta como que no. */
export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3().send(new HeadObjectCommand({ Bucket: env.s3Bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Borra un objeto. Revienta si el bucket no da permiso, que es lo que hay que
 * mostrarle a quien lo intentó.
 *
 * Y lo normal es que no lo dé: el usuario IAM de producción
 * (`arn:aws:iam::…:user/S3`) tiene `PutObject`, `GetObject`, `ListBucket` y
 * `CopyObject`, pero no `DeleteObject` — comprobado contra el bucket. Quien
 * quiera borrar de verdad desde el panel tiene que agregarle esa acción a la
 * política; hasta entonces el panel enseña el `AccessDenied` tal cual en vez
 * de decir que borró algo que sigue ahí.
 */
export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: key }));
}

/**
 * Copia un objeto dentro del mismo bucket.
 *
 * Es la mitad de "renombrar" que S3 sabe hacer; la otra mitad es borrar el
 * original, y va aparte a propósito, porque en este bucket falla. Quien llama
 * decide qué hacer con eso: `renameStoredObject` deja las filas apuntando a la
 * copia — que existe y es correcta — y avisa de que la vieja quedó.
 */
export async function copyObject(from: string, to: string): Promise<void> {
  await s3().send(
    new CopyObjectCommand({
      Bucket: env.s3Bucket,
      // El origen va con el bucket delante y percent-encoded: una clave con un
      // espacio o un signo de más rompe la copia si se manda tal cual.
      CopySource: `${env.s3Bucket}/${encodeURIComponent(from).replace(/%2F/g, "/")}`,
      Key: to,
    }),
  );
}
