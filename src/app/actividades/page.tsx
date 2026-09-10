import Link from "next/link";
import { Suspense } from "react";
import { ActivityRow } from "@/components/activity-row";
import { FiltersSidebar } from "@/components/filters-sidebar";
import { Pagination } from "@/components/pagination";
import { SearchBar } from "@/components/search-bar";
import { SortControls } from "@/components/sort-controls";
import { PAGE_SIZE, searchActivities } from "@/lib/activities";
import { getFilterCatalog } from "@/lib/catalog";
import { readFilters } from "@/lib/filters";

export const metadata = { title: "Actividades" };

/** Results depend on the query string, so they are rendered per request. */
export const dynamic = "force-dynamic";

export default async function ActividadesPage({ searchParams }: PageProps<"/actividades">) {
  const sp = await searchParams;
  const filters = readFilters(sp);

  const [catalog, results] = await Promise.all([getFilterCatalog(), searchActivities(filters)]);
  const lastPage = Math.max(1, Math.ceil(results.total / PAGE_SIZE));

  return (
    <>
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
