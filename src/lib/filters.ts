import type { ActivityFilters } from "@/lib/types";

/**
 * Reading the /actividades query string.
 *
 * Facets are carried as catalogue ids under Spanish keys, so a URL survives a
 * subject being renamed and stays readable to a teacher who shares it.
 * Anything unparseable is dropped rather than rejected — a hand-edited URL
 * should still show results.
 */

export const FILTER_KEYS = {
  subject: "asignatura",
  grade: "nivel",
  skill: "habilidad",
  type: "tipo",
} as const;

export type SearchParams = Record<string, string | string[] | undefined>;

/** A query param can arrive absent, single or repeated — normalise to a list. */
function list(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function one(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

function ids(value: string | string[] | undefined): number[] {
  const seen = new Set<number>();
  for (const raw of list(value)) {
    const n = Number(raw);
    if (Number.isInteger(n) && n > 0) seen.add(n);
  }
  return [...seen];
}

export function readFilters(params: SearchParams): ActivityFilters {
  const page = Number(one(params.page));
  return {
    q: one(params.q).trim(),
    subjectIds: ids(params[FILTER_KEYS.subject]),
    gradeIds: ids(params[FILTER_KEYS.grade]),
    skillIds: ids(params[FILTER_KEYS.skill]),
    resourceTypeIds: ids(params[FILTER_KEYS.type]),
    sort: one(params.sort) === "populares" ? "populares" : "recientes",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}
