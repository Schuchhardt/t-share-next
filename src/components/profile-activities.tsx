"use client";

import Link from "next/link";
import { useState } from "react";
import { ActivityRow } from "@/components/activity-row";
import type { ActivitySummary, Profile } from "@/lib/types";
import { fullName } from "@/lib/types";

const TABS = [
  { key: "subidas", label: "Subidas" },
  { key: "guardadas", label: "Guardadas" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ProfileActivities({
  profile,
  uploaded,
  saved,
}: {
  profile: Profile;
  uploaded: ActivitySummary[];
  saved: ActivitySummary[];
}) {
  const [tab, setTab] = useState<TabKey>("subidas");
  const list = tab === "subidas" ? uploaded : saved;

  const eyebrow = [profile.roles[0] ?? "Profesor/a", profile.subjects[0]]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <section className="section-rule flex flex-wrap items-end justify-between gap-[22px] pt-13 pb-[26px]">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="mt-2 mb-1.5 text-[30px] leading-[1.1] font-bold tracking-[-0.015em] text-ink sm:text-[34px] lg:text-[40px]">
            {fullName(profile)}
          </h1>
          <p className="text-[15px] text-muted">
            {uploaded.length} {uploaded.length === 1 ? "actividad subida" : "actividades subidas"} ·{" "}
            {saved.length} guardadas · {profile.downloadCount} descargas
            {profile.followerCount > 0 && ` · ${profile.followerCount} seguidores`}
          </p>
        </div>
        <Link
          href="/actividades/crear"
          className="rounded-sm bg-green px-5 py-[11px] text-[15px] font-semibold text-green-ink no-underline transition-colors hover:bg-green-hover hover:text-green-ink hover:no-underline"
        >
          Subir actividad
        </Link>
      </section>

      <section className="flex gap-6 pt-[18px]" role="tablist" aria-label="Mis actividades">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={`border-b-2 bg-transparent py-2 text-base transition-colors ${
                active
                  ? "border-green font-semibold text-ink"
                  : "border-transparent font-normal text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </section>

      <section>
        {list.map((activity) => (
          <ActivityRow key={activity.id} activity={activity} showObjective={false} />
        ))}

        {list.length === 0 && (
          <div className="py-14 text-base text-muted">
            {tab === "guardadas"
              ? "Todavía no guardas actividades. "
              : "Todavía no subes actividades. "}
            <Link href="/actividades" className="text-base">
              Explorar el repositorio
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
