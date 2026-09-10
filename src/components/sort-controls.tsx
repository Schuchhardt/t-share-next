"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";

const OPTIONS = [
  { key: "recientes", label: "Más recientes" },
  { key: "populares", label: "Más usadas" },
] as const;

/**
 * Like the filter sidebar, the choice lives in the query string and switching
 * it costs a server round-trip, so the highlight moves optimistically.
 */
export function SortControls() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(params.get("sort") ?? "recientes");

  function pick(key: string) {
    const next = new URLSearchParams(params.toString());
    if (key === "recientes") next.delete("sort");
    else next.set("sort", key);
    // A different order starts again from the first page.
    next.delete("page");
    startTransition(() => {
      setCurrent(key);
      router.replace(`/actividades${next.size ? `?${next}` : ""}`, { scroll: false });
    });
  }

  return (
    <div className="flex gap-3.5">
      {OPTIONS.map((o) => {
        const active = current === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => pick(o.key)}
            aria-pressed={active}
            className={`border-none bg-transparent p-0 text-sm ${
              active ? "font-semibold text-ink" : "font-normal text-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
