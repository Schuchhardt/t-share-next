import type { ActivitySummary } from "@/lib/types";

/**
 * Display strings shared by the list row and the activity header.
 * Pure functions over the query-layer types, so they are cheap to unit test
 * and safe to use in a client component.
 */

/** Joins a list for reading: "a", "a y b", "a, b y c". */
export function joinEs(values: string[], conjunction = "y"): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0]!;
  return `${values.slice(0, -1).join(", ")} ${conjunction} ${values[values.length - 1]}`;
}

/**
 * The small caps line above a title: subject, grade and duration, skipping
 * whatever the activity does not have rather than printing an empty segment.
 */
export function metaLine(activity: Pick<ActivitySummary, "subjects" | "grades" | "durationMinutes">): string {
  const parts: string[] = [];
  if (activity.subjects.length) parts.push(activity.subjects.slice(0, 2).join(" · "));
  if (activity.grades.length) parts.push(activity.grades.slice(0, 2).join(" · "));
  if (activity.durationMinutes && activity.durationMinutes > 0) {
    parts.push(`${activity.durationMinutes} min`);
  }
  return parts.join(" · ").toUpperCase();
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The indigo line under a list row: what you get and how used it is. */
export function docsLine(
  activity: Pick<ActivitySummary, "documentCount" | "resourceTypes" | "downloadCount">,
): string {
  const parts: string[] = [];
  if (activity.documentCount > 0) {
    parts.push(plural(activity.documentCount, "documento", "documentos"));
  }
  if (activity.resourceTypes.length) parts.push(activity.resourceTypes.slice(0, 3).join(" · "));
  if (activity.downloadCount > 0) {
    parts.push(plural(activity.downloadCount, "descarga", "descargas"));
  }
  return parts.join(" · ") || "Sin documentos adjuntos";
}

/**
 * A readable name for a downloadable file.
 *
 * 762 of the 1 415 migrated resources have a URL stored in `nombre` — the old
 * upload form put the link in both fields — and a raw Canva or Drive URL is
 * not a label. Fall back to the resource type, then to the host.
 */
export function documentName(raw: string | null | undefined, kind: string | null): string {
  const name = raw?.trim();
  if (name && !/^https?:\/\//i.test(name)) return name;
  if (kind?.trim()) return kind.trim();
  if (name) {
    try {
      return new URL(name).hostname.replace(/^www\./, "");
    } catch {
      // Not a URL after all — better the raw string than nothing.
      return name;
    }
  }
  return "Documento";
}

/**
 * The label on a moment of the class. Almost every migrated instruction has an
 * empty `nombre`, so numbering them beats printing "Paso" four times.
 */
export function stepName(raw: string | null | undefined, index: number): string {
  return raw?.trim() || `Paso ${index + 1}`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : DATE_FORMAT.format(date);
}

export function formatDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) return "Sin definir";
  if (minutes < 60) return `${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hoursLabel = plural(hours, "hora", "horas");
  return rest ? `${hoursLabel} ${rest} min` : hoursLabel;
}
