import "server-only";
import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
