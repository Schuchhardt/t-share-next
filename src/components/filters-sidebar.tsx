"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { FILTER_KEYS } from "@/lib/filters";
import type { CatalogItem, Grade } from "@/lib/types";

/**
 * The facets on /actividades.
 *
 * Every option comes from the database (`src/lib/catalog.ts`) and is
 * identified by its id, so the query string stays stable when a subject is
 * renamed and adding one in Supabase is enough to make it appear here.
 *
 * The query string is the source of truth for what is checked, and changing it
 * means a server round-trip for the new results. `useOptimistic` ticks the box
 * straight away and React reconciles it when the navigation lands, so the
 * checkbox never sits there looking ignored.
 */

export type FilterCatalog = {
  subjects: CatalogItem[];
  grades: Grade[];
  skills: CatalogItem[];
  resourceTypes: CatalogItem[];
};

export function FiltersSidebar({ catalog }: { catalog: FilterCatalog }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [pendingQuery, setPendingQuery] = useOptimistic(params.toString());
  const shown = new URLSearchParams(pendingQuery);

  const groups = [
    { name: "Asignatura", key: FILTER_KEYS.subject, options: catalog.subjects },
    {
      name: "Nivel",
      key: FILTER_KEYS.grade,
      options: catalog.grades.map((g) => ({
        id: g.id,
        name: g.level ? `${g.name} · ${g.level}` : g.name,
      })),
    },
    { name: "Habilidad", key: FILTER_KEYS.skill, options: catalog.skills },
    { name: "Tipo de recurso", key: FILTER_KEYS.type, options: catalog.resourceTypes },
  ];

  function toggle(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    const current = next.getAll(key);
    next.delete(key);
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    for (const v of updated) next.append(key, v);
    // Any facet change puts you back on the first page of results.
    next.delete("page");
    apply(next);
  }

  function apply(next: URLSearchParams) {
    startTransition(() => {
      setPendingQuery(next.toString());
      router.replace(`/actividades${next.size ? `?${next}` : ""}`, { scroll: false });
    });
  }

  function clear() {
    const next = new URLSearchParams();
    const q = params.get("q");
    const sort = params.get("sort");
    if (q) next.set("q", q);
    if (sort) next.set("sort", sort);
    apply(next);
  }

  const activeCount = Object.values(FILTER_KEYS).reduce(
    (sum, key) => sum + shown.getAll(key).length,
    0,
  );

  return (
    <div className="grid gap-[26px] md:sticky md:top-[86px]">
      <div className="section-rule flex items-baseline justify-between pb-2">
        <span className="eyebrow">Filtros{activeCount ? ` (${activeCount})` : ""}</span>
        <button
          type="button"
          onClick={clear}
          disabled={activeCount === 0}
          className="border-none bg-transparent p-0 text-[13px] text-indigo hover:underline disabled:cursor-default disabled:text-muted disabled:no-underline"
        >
          Limpiar
        </button>
      </div>

      {groups.map((group) => {
        const selected = shown.getAll(group.key);
        if (group.options.length === 0) return null;
        return (
          <fieldset key={group.key} className="grid gap-[9px]">
            <legend className="text-sm font-bold text-ink">{group.name}</legend>
            {group.options.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-start gap-[9px] text-sm text-muted transition-colors hover:text-ink"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(String(option.id))}
                  onChange={() => toggle(group.key, String(option.id))}
                  className="mt-[3px] accent-indigo"
                />
                <span>{option.name}</span>
              </label>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}
