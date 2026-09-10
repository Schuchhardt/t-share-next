/**
 * The shapes the screens read.
 *
 * These are the app's own vocabulary, not the database's: the query layer in
 * `src/lib/activities.ts` and `src/lib/catalog.ts` maps `tshare_*` rows onto
 * them, so a schema change stops at that boundary. Field names stay English,
 * matching the schema; user-facing wording stays Spanish and lives in the
 * components.
 */

export type CatalogItem = {
  id: number;
  name: string;
};

/** A grade is an age band; some also carry the school level as a subtitle. */
export type Grade = CatalogItem & {
  level: string | null;
};

export type Author = {
  id: number;
  name: string;
  avatarUrl: string | null;
};

/** One downloadable file attached to an activity. */
export type ActivityDocument = {
  id: number;
  name: string;
  /** Resolved to something a browser can open, or null when there is no file. */
  url: string | null;
  /** "Guía", "Video"… — absent for materials and instructions. */
  kind: string | null;
};

export type ActivityStep = {
  id: number;
  name: string;
  text: string;
};

export type ActivitySummary = {
  id: number;
  title: string;
  learningObjective: string | null;
  durationMinutes: number | null;
  createdAt: string;
  author: Author | null;
  subjects: string[];
  grades: string[];
  resourceTypes: string[];
  documentCount: number;
  savedCount: number;
  downloadCount: number;
};

export type ActivityDetail = ActivitySummary & {
  description: string | null;
  evaluation: string | null;
  rating: number | null;
  coverUrl: string | null;
  pdfUrl: string | null;
  skills: string[];
  units: string[];
  steps: ActivityStep[];
  materials: string[];
  documents: ActivityDocument[];
};

export type ActivityFilters = {
  q: string;
  subjectIds: number[];
  gradeIds: number[];
  skillIds: number[];
  resourceTypeIds: number[];
  sort: "recientes" | "populares";
  page: number;
};

export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type Profile = {
  id: number;
  firstName: string;
  lastName: string | null;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
  roles: string[];
  subjects: string[];
  uploadedCount: number;
  savedCount: number;
  downloadCount: number;
  followerCount: number;
};

export function fullName(user: { firstName: string; lastName?: string | null }): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${second}`.toUpperCase();
}
