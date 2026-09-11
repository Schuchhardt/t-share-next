import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityRow } from "@/components/activity-row";
import { FiltersSidebar } from "@/components/filters-sidebar";
import { Pagination } from "@/components/pagination";
import { SearchBar } from "@/components/search-bar";
import { SortControls } from "@/components/sort-controls";
import { PAGE_SIZE, searchActivities } from "@/lib/activities";
import { getFilterCatalog } from "@/lib/catalog";
import { FILTER_KEYS, readFilters } from "@/lib/filters";
import { joinEs } from "@/lib/format";
import { clamp, social } from "@/lib/seo";
import type { ActivityFilters, CatalogItem } from "@/lib/types";

/** The names behind the ids in the query string, in the order they were asked for. */
function named(catalog: CatalogItem[], ids: number[]): string[] {
  return ids
    .map((id) => catalog.find((item) => item.id === id)?.name)
    .filter((name): name is string => Boolean(name));
}

/**
 * The same URL the visitor is on, rebuilt from the filters that were actually
 * understood — so a canonical never carries a typo'd parameter, an unknown id
 * or the same facet twice, which is what turns one results page into a
 * thousand near-duplicates in an index.
 *
 * `page` is kept: page two is its own URL, and pointing it at page one would
 * tell Google the rest of the catalogue does not exist.
 */
function canonicalFor(filters: ActivityFilters): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  for (const [key, ids] of [
    [FILTER_KEYS.subject, filters.subjectIds],
    [FILTER_KEYS.grade, filters.gradeIds],
    [FILTER_KEYS.skill, filters.skillIds],
    [FILTER_KEYS.type, filters.resourceTypeIds],
  ] as const) {
    for (const id of [...ids].sort((a, b) => a - b)) query.append(key, String(id));
  }
  if (filters.sort === "populares") query.set("sort", "populares");
  if (filters.page > 1) query.set("page", String(filters.page));
  const qs = query.toString();
  return qs ? `/actividades?${qs}` : "/actividades";
}

/** "Actividades de Matemática para 5° básico" — the heading and the title tag. */
function headingFor(subjects: string[], grades: string[], term: string): string {
  if (term) return `Actividades sobre "${term}"`;
  const parts = ["Actividades"];
  if (subjects.length) parts.push(`de ${joinEs(subjects)}`);
  if (grades.length) parts.push(`para ${joinEs(grades)}`);
  return parts.join(" ");
}

/**
 * A filtered results page is worth indexing when it reads as a category — one
 * subject, or one grade. A search term, a stack of facets or a page two is a
 * view of the same catalogue, so those say `noindex, follow`: they stay out of
 * the index while the crawler keeps walking through to the activities.
 */
export async function generateMetadata({
  searchParams,
}: PageProps<"/actividades">): Promise<Metadata> {
  const filters = readFilters(await searchParams);
  const catalog = await getFilterCatalog();

  const subjects = named(catalog.subjects, filters.subjectIds);
  const grades = named(catalog.grades, filters.gradeIds);
  const facets =
    filters.subjectIds.length +
    filters.gradeIds.length +
    filters.skillIds.length +
    filters.resourceTypeIds.length;
  const indexable = !filters.q && filters.page === 1 && facets <= 1;

  const heading = headingFor(subjects, grades, filters.q);
  const description = filters.q
    ? clamp(`Actividades de clase que hablan de "${filters.q}", con sus documentos para descargar.`)
    : clamp(
        `${heading} hechas por profesores: objetivo de aprendizaje, momentos de la clase y ` +
          "documentos listos para descargar.",
      );
  const canonical = canonicalFor(filters);

  return {
    title: heading === "Actividades" ? "Actividades" : heading,
    description,
    alternates: { canonical },
    // Absent rather than undefined, so an indexable page keeps the site-wide
    // rule from the layout instead of resetting it.
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
    ...social({ path: canonical, title: heading, description }),
  };
}

/** Results depend on the query string, so they are rendered per request. */
export const dynamic = "force-dynamic";

export default async function ActividadesPage({ searchParams }: PageProps<"/actividades">) {
  const sp = await searchParams;
  const filters = readFilters(sp);

  const [catalog, results] = await Promise.all([getFilterCatalog(), searchActivities(filters)]);
  const lastPage = Math.max(1, Math.ceil(results.total / PAGE_SIZE));
  const heading = headingFor(
    named(catalog.subjects, filters.subjectIds),
    named(catalog.grades, filters.gradeIds),
    filters.q,
  );

  return (
    <>
      {/* The design has no headline here — the search box is the headline —
          but the page still needs to say what it is, to a crawler and to a
          screen reader arriving at a filtered URL. */}
      <h1 className="sr-only">{heading}</h1>

      <section className="pt-9 pb-[26px]">
        <Suspense fallback={<div className="h-[49px] max-w-[700px]" />}>
          <SearchBar variant="compact" />
        </Suspense>
      </section>

      <section className="grid grid-cols-1 items-start gap-13 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <Suspense fallback={null}>
          <FiltersSidebar catalog={catalog} />
        </Suspense>

        <div>
          <div className="section-rule flex flex-wrap items-baseline justify-between gap-3 pb-2.5">
            <span className="text-sm font-semibold text-muted">
              {results.total} {results.total === 1 ? "actividad" : "actividades"}
              {lastPage > 1 && ` · página ${results.page} de ${lastPage}`}
            </span>
            <Suspense fallback={null}>
              <SortControls />
            </Suspense>
          </div>

          {results.items.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))}

          {results.items.length === 0 && (
            <div className="py-13 text-base text-muted">
              No hay actividades con esos filtros.{" "}
              <Link href="/actividades" className="text-base">
                Limpiar filtros
              </Link>
            </div>
          )}

          {lastPage > 1 && (
            <Suspense fallback={null}>
              <Pagination page={results.page} lastPage={lastPage} />
            </Suspense>
          )}
        </div>
      </section>
    </>
  );
}
