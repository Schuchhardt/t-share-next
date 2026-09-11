import "server-only";
import { env } from "@/lib/env";
import { joinEs, metaLine } from "@/lib/format";
import { SITE, SOCIAL } from "@/lib/site";
import type { ActivityDetail } from "@/lib/types";

/**
 * Everything a crawler reads: canonical URLs, the descriptions that end up in
 * a result snippet, and the structured data behind them.
 *
 * The origin comes from `APP_URL`, the same value the emails build their links
 * from — one canonical origin per deployment, rather than a second constant
 * that can drift from it. In production it has to be `https://t-share.org`;
 * locally it is the dev server, so canonicals and Open Graph URLs point at
 * whatever is actually serving the page.
 */

export function siteUrl(): string {
  return env.appUrl;
}

export const SITE_TITLE = "T-share · Actividades de clase, listas para usar";
export const SITE_TAGLINE = "Actividades de clase, listas para usar.";
export const SITE_DESCRIPTION =
  "Un repositorio de actividades hechas por profesores. Busca por nivel, asignatura u " +
  "objetivo de aprendizaje, y descarga los documentos.";

/** The site's own card, drawn by `src/app/opengraph-image.tsx`. */
const SITE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "T-share — Actividades de clase, listas para usar.",
};

/**
 * The Open Graph and Twitter blocks for a page that has no social image of
 * its own.
 *
 * Spelled out rather than inherited on purpose: a page that sets any single
 * `openGraph` field replaces its layout's whole object, which quietly takes
 * the site card, the locale and the site name with it — a pasted link then
 * previews as a bare line of text. Anything that overrides one field here
 * overrides all of them.
 */
export function social(page: { path: string; title: string; description: string }) {
  return {
    openGraph: {
      type: "website" as const,
      locale: "es_CL",
      siteName: "T-share",
      url: page.path,
      title: page.title,
      description: page.description,
      images: [SITE_IMAGE],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: page.title,
      description: page.description,
      images: [SITE_IMAGE.url],
    },
  };
}

/** An absolute URL for a path that already starts at the site root. */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** ISO 8601 for schema.org's `timeRequired`: 45 → "PT45M", 90 → "PT1H30M". */
export function isoDuration(minutes: number | null): string | undefined {
  if (!minutes || minutes <= 0) return undefined;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `PT${hours ? `${hours}H` : ""}${rest ? `${rest}M` : ""}`;
}

/**
 * A one-paragraph summary for `<meta name="description">`.
 *
 * Google shows around 160 characters, and a snippet cut mid-word reads as
 * broken, so this trims at the last space that fits.
 */
export function clamp(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[.,;:·\-]$/, "")}…`;
}

/**
 * What an activity's snippet says.
 *
 * The objective is what a teacher searches for, so it leads; the description
 * is the fallback, and the ficha line is what is left when a migrated row has
 * neither — better than an empty snippet, which lets Google invent one.
 */
export function activityDescription(activity: ActivityDetail): string {
  const text = activity.learningObjective?.trim() || activity.description?.trim();
  if (text) return clamp(text);

  const parts = [
    activity.subjects.length ? joinEs(activity.subjects) : null,
    activity.grades.length ? `para ${joinEs(activity.grades)}` : null,
  ].filter(Boolean);
  return clamp(
    `Actividad de clase${parts.length ? ` de ${parts.join(" ")}` : ""}, con sus documentos ` +
      "listos para descargar en T-share.",
  );
}

/** The title tag of an activity, with its ficha as the qualifier. */
export function activityTitle(activity: ActivityDetail): string {
  const meta = metaLine(activity);
  return meta ? `${activity.title} — ${meta.toLowerCase()}` : activity.title;
}

/**
 * The organisation behind the site, referenced by `@id` from the other graphs
 * so every page describes the same entity rather than a copy of it.
 */
export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: "T-share",
    legalName: SITE.company,
    url: siteUrl(),
    logo: absoluteUrl("/brand/tshare-logo.svg"),
    email: SITE.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.address,
      addressLocality: "Santiago",
      addressCountry: "CL",
    },
    sameAs: SOCIAL.map((s) => s.href),
  };
}

/**
 * The site itself, with the search box it offers. `potentialAction` is what
 * lets a search engine offer the repository's own search in a result.
 */
export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: "T-share",
    url: siteUrl(),
    inLanguage: "es-CL",
    publisher: { "@id": absoluteUrl("/#organization") },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/actividades?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * One activity as a `LearningResource` — the schema.org type search engines
 * use for teaching material, and the one that can carry the ficha: the grade
 * band, the subject, the objective and how long the class takes.
 *
 * No `aggregateRating`: the migrated `rating` column has no vote count behind
 * it, and a rating without one is exactly what earns a structured-data
 * penalty.
 */
export function activityJsonLd(activity: ActivityDetail): Record<string, unknown> {
  const url = absoluteUrl(`/actividades/detalle/${activity.id}`);
  const teaches = [activity.learningObjective?.trim(), ...activity.skills].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    "@id": `${url}#activity`,
    url,
    name: activity.title,
    description: activityDescription(activity),
    inLanguage: "es-CL",
    isAccessibleForFree: true,
    datePublished: activity.createdAt,
    audience: { "@type": "EducationalAudience", educationalRole: "teacher" },
    ...(activity.grades.length ? { educationalLevel: activity.grades } : {}),
    ...(activity.subjects.length
      ? { about: activity.subjects.map((name) => ({ "@type": "Thing", name })) }
      : {}),
    ...(activity.resourceTypes.length ? { learningResourceType: activity.resourceTypes } : {}),
    ...(teaches.length ? { teaches } : {}),
    ...(isoDuration(activity.durationMinutes)
      ? { timeRequired: isoDuration(activity.durationMinutes) }
      : {}),
    ...(activity.author ? { author: { "@type": "Person", name: activity.author.name } } : {}),
    publisher: { "@id": absoluteUrl("/#organization") },
    ...(activity.downloadCount > 0
      ? {
          interactionStatistic: {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/DownloadAction",
            userInteractionCount: activity.downloadCount,
          },
        }
      : {}),
  };
}

/** The trail shown under a result: Inicio › Actividades › this one. */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: absoluteUrl(step.path),
    })),
  };
}
