"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

/**
 * Previous / next for the results list. Rendered as links rather than buttons
 * so a page is shareable and the browser's back button behaves.
 */
export function Pagination({ page, lastPage }: { page: number; lastPage: number }) {
  const params = useSearchParams();

  function href(target: number): string {
    const next = new URLSearchParams(params.toString());
    if (target <= 1) next.delete("page");
    else next.set("page", String(target));
    return `/actividades${next.size ? `?${next}` : ""}`;
  }

  const linkClass =
    "rounded-sm border-[1.5px] border-lav-border px-4 py-2 text-sm font-semibold text-indigo no-underline transition-colors hover:border-indigo hover:no-underline";

  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 pt-7">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={linkClass}>
          ← Anteriores
        </Link>
      ) : (
        <span />
      )}

      <span className="text-sm text-muted">
        {page} / {lastPage}
      </span>

      {page < lastPage ? (
        <Link href={href(page + 1)} rel="next" className={linkClass}>
          Siguientes →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
