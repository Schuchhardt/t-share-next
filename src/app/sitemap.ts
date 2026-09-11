import type { MetadataRoute } from "next";
import { getActivityIndex } from "@/lib/activities";
import { getSubjectsWithActivities } from "@/lib/catalog";
import { FILTER_KEYS } from "@/lib/filters";
import { absoluteUrl } from "@/lib/seo";

/**
 * The map a crawler starts from.
 *
 * Every activity is listed, because the results page only ever shows twenty at
 * a time and a crawler that paginates its way through 1 200 of them will give
 * up long before the end. The subject pages are in here too: they are the one
 * filtered URL worth indexing on its own — a real landing page for "actividades
 * de Matemática" — while search terms and page two carry `noindex`.
 *
 * Rebuilt hourly rather than per request: a sitemap that runs two queries is
 * cheap, but not cheap enough to hand to every bot that asks.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [activities, subjects] = await Promise.all([
    getActivityIndex(),
    // Every subject that has something behind it, not just the ten the landing
    // page shows.
    getSubjectsWithActivities(100),
  ]);

  const newest = activities.reduce<string | null>(
    (latest, a) => (!latest || a.updatedAt > latest ? a.updatedAt : latest),
    null,
  );
  const lastModified = newest ? new Date(newest) : new Date();

  return [
    { url: absoluteUrl("/"), lastModified, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/actividades"), lastModified, changeFrequency: "daily", priority: 0.9 },
    ...subjects.map((subject) => ({
      url: absoluteUrl(`/actividades?${FILTER_KEYS.subject}=${subject.id}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...activities.map((activity) => ({
      url: absoluteUrl(`/actividades/detalle/${activity.id}`),
      lastModified: new Date(activity.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: absoluteUrl("/terminos"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/privacidad"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
