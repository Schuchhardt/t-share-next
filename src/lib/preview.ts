/**
 * What a stored file can be shown as without downloading it.
 *
 * The decision has to work off a string, because that is all a row gives us:
 * an S3 key (`actividades/pdf/1076-....pdf`), a signed URL with a query string
 * hanging off it, or — for 762 of the migrated resources — a Canva or Drive
 * link that lives in `nombre`. Only the extension is trustworthy; the stored
 * MIME type was never part of the old schema.
 *
 * Pure on purpose: the detail page decides on the server, the picker in the
 * upload form decides in the browser, and both go through here.
 */

export type PreviewKind = "image" | "pdf" | "video" | null;

/**
 * The lowercase extension of a key, filename or URL, without the dot.
 * Query strings and fragments are dropped first — a signed S3 URL ends in
 * `?X-Amz-Signature=…`, which is not part of the name.
 */
export function fileExtension(source: string | null | undefined): string | null {
  if (!source) return null;
  const path = source.split("#")[0]!.split("?")[0]!;
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : null;
}

const IMAGE = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp"]);
const VIDEO = new Set(["mp4", "webm", "ogv", "mov"]);

/**
 * How to show the file inline, or null when the only sensible action is a
 * download.
 *
 * SVG is deliberately left out: it is a document that can carry script, and an
 * uploaded one is teacher-supplied content we would rather hand to the browser
 * as a download than embed.
 */
export function previewKind(source: string | null | undefined): PreviewKind {
  const ext = fileExtension(source);
  if (!ext) return null;
  if (IMAGE.has(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (VIDEO.has(ext)) return "video";
  return null;
}

/**
 * The same decision for a file the teacher has just picked, where the browser
 * does report a MIME type. The type wins when it is one we know, because a
 * phone camera happily produces `image/jpeg` under a name with no extension.
 */
export function previewKindForFile(file: { name: string; type: string }): PreviewKind {
  const type = file.type.toLowerCase();
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return type === "image/svg+xml" ? null : "image";
  if (type.startsWith("video/")) return "video";
  return previewKind(file.name);
}

/** The short label shown next to a file, e.g. "PDF", "JPG". */
export function fileLabel(source: string | null | undefined): string | null {
  const ext = fileExtension(source);
  return ext ? ext.toUpperCase() : null;
}
