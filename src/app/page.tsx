import Link from "next/link";
import { Suspense } from "react";
import { ActivityRow } from "@/components/activity-row";
import { Allies } from "@/components/allies";
import { HowItWorks } from "@/components/how-it-works";
import { SearchBar } from "@/components/search-bar";
import { countActivities, getRecentActivities } from "@/lib/activities";
import { getSubjectsWithActivities } from "@/lib/catalog";
import { FILTER_KEYS } from "@/lib/filters";

/**
 * The landing page reads three small queries, all of which change rarely, so
 * it is statically rendered and refreshed in the background.
 */
export const revalidate = 300;

export default async function HomePage() {
  const [recent, subjects, total] = await Promise.all([
    getRecentActivities(4),
    // Only the ones with activities behind them: a chip that leads to an empty
    // results page is worse than one fewer chip.
    getSubjectsWithActivities(10),
    countActivities(),
  ]);

  return (
    <>
      <section className="max-w-[640px] pt-20 pb-10">
        <h1 className="mb-[18px] text-[38px] leading-[1.05] font-bold tracking-[-0.02em] text-pretty text-ink sm:text-[46px] lg:text-[54px]">
          Actividades de clase, listas para usar.
        </h1>
        <p className="max-w-[48ch] text-[17px] leading-[1.55] text-pretty text-muted sm:text-[19px]">
          Un repositorio de actividades hechas por profesores. Busca por nivel, asignatura u
          objetivo de aprendizaje, y descarga los documentos.
        </p>
      </section>

      <Suspense fallback={<div className="h-[59px] max-w-[700px]" />}>
        <SearchBar placeholder="Fracciones, comprensión lectora, 5° básico…" />
      </Suspense>

      <section className="mt-[18px] flex max-w-[700px] flex-wrap gap-2">
        {subjects.map((subject) => (
          <Link
            key={subject.id}
            href={`/actividades?${FILTER_KEYS.subject}=${subject.id}`}
            className="rounded-full bg-lav px-3.5 py-[7px] text-sm font-medium text-indigo no-underline transition-colors hover:bg-lav-hover hover:no-underline"
          >
            {subject.name}
          </Link>
        ))}
      </section>

      <section className="mt-20">
        <div className="section-rule flex items-baseline justify-between pb-2.5">
          <h2 className="eyebrow">Agregadas recientemente</h2>
          <Link href="/actividades" className="text-sm font-medium">
            Ver todas ({total})
          </Link>
        </div>
        {recent.map((activity) => (
          <ActivityRow key={activity.id} activity={activity} size="lg" />
        ))}
      </section>

      <HowItWorks />

      <Allies />
    </>
  );
}
