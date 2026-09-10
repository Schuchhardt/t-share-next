import "server-only";
import { cache } from "react";
import { T, db, unwrap } from "@/lib/supabase";
import type { CatalogItem, Grade } from "@/lib/types";

/**
 * The filter vocabulary, read from the database rather than hard-coded.
 *
 * Everything the sidebar, the upload form and the activity ficha offer comes
 * from here, so adding a subject or a resource type in Supabase is enough to
 * make it appear in the UI.
 *
 * Each list is wrapped in React's `cache`, so a request that renders the
 * sidebar and the form only reads each table once.
 */

export const getSubjects = cache(async (): Promise<CatalogItem[]> => {
  const rows = unwrap(
    await db()
      .from(T.subjects)
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),
    "subjects",
  ) as { id: number; name: string }[];

  // The catalogue holds a few names that differ only by a trailing space
  // ("Matemática" and "Matemática "), which would read as duplicates.
  const seen = new Set<string>();
  return rows
    .map((r) => ({ id: r.id, name: r.name.trim() }))
    .filter((r) => {
      if (!r.name || seen.has(r.name.toLowerCase())) return false;
      seen.add(r.name.toLowerCase());
      return true;
    });
});

export const getGrades = cache(async (): Promise<Grade[]> => {
  const rows = unwrap(
    await db()
      .from(T.grades)
      .select("id, name, description")
      .is("deleted_at", null)
      .order("id"),
    "grades",
  ) as { id: number; name: string; description: string | null }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name.trim(),
    level: r.description?.trim() || null,
  }));
});

export const getSkills = cache(async (): Promise<CatalogItem[]> => {
  const rows = unwrap(
    await db().from(T.skills).select("id, name").order("id"),
    "skills",
  ) as { id: number; name: string }[];
  return rows.map((r) => ({ id: r.id, name: r.name.trim() }));
});

export const getResourceTypes = cache(async (): Promise<CatalogItem[]> => {
  const rows = unwrap(
    await db().from(T.resourceTypes).select("id, name").is("deleted_at", null).order("id"),
    "resource types",
  ) as { id: number; name: string }[];
  return rows.map((r) => ({ id: r.id, name: r.name.trim() }));
});

/** Materials the upload form suggests. */
export const getSuggestedMaterials = cache(async (): Promise<CatalogItem[]> => {
  const rows = unwrap(
    await db().from(T.suggestedMaterials).select("id, name").order("name"),
    "suggested materials",
  ) as { id: number; name: string }[];
  return rows.map((r) => ({ id: r.id, name: r.name.trim() })).filter((r) => r.name);
});

/**
 * Everything the filter sidebar needs, in one call.
 */
export const getFilterCatalog = cache(async () => {
  const [subjects, grades, skills, resourceTypes] = await Promise.all([
    getSubjects(),
    getGrades(),
    getSkills(),
    getResourceTypes(),
  ]);
  return { subjects, grades, skills, resourceTypes };
});
