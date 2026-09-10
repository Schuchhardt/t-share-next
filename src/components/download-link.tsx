"use client";

import { useTransition } from "react";
import { recordDownload } from "@/lib/activity-actions";

/**
 * A document link that also tells the server it was taken.
 *
 * The click is not intercepted — the browser follows the href as usual, and
 * the counter write happens alongside it. A failed count is not worth blocking
 * a download over, so the error is swallowed.
 */
export function DownloadLink({
  activityId,
  href,
  name,
  meta,
  signedIn,
}: {
  activityId: number;
  href: string | null;
  name: string;
  meta: string;
  signedIn: boolean;
}) {
  const [, startTransition] = useTransition();

  function count() {
    if (!signedIn || !href) return;
    startTransition(async () => {
      await recordDownload(activityId).catch(() => undefined);
    });
  }

  const body = (
    <>
      <span className="grid gap-0.5">
        <span className="text-[15px] font-medium">{name}</span>
        <span className="text-xs text-mint-meta">{meta}</span>
      </span>
      <span className="text-sm font-semibold text-mint-strong">
        {href ? "Descargar ↓" : "No disponible"}
      </span>
    </>
  );

  const className =
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-mint-border py-[11px] text-ink no-underline hover:no-underline";

  if (!href) {
    return (
      <span className={`${className} opacity-60`} aria-disabled="true">
        {body}
      </span>
    );
  }

  return (
    <a
      href={href}
      onClick={count}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {body}
    </a>
  );
}
