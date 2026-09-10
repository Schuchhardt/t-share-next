"use client";

import { useState } from "react";

/**
 * The activity cover — `actividades.avatar` on the old table.
 *
 * Two sizes, because the old site used both: the card on the landing and in
 * the results list carried a small one, and the detail screen a large one.
 *
 * A client component for one reason: when the image does not load, the page
 * should look like the activity has no cover rather than show a broken frame.
 * Plenty of migrated rows point at objects that are no longer in the bucket,
 * and a signed URL that was minted just before its window closed fails the
 * same way. There is no server-side way to know in advance, so the browser
 * tells us.
 *
 * Plain `<img>`, not `next/image`: the signed URL rotates every few hours, so
 * the optimiser would key its cache on a URL that never repeats — a re-fetch
 * every render, cached nothing.
 */

const STYLES = {
  hero: "max-h-[420px] w-full rounded-md border border-line object-cover",
  thumb: "size-full object-cover",
} as const;

export function ActivityCover({
  src,
  title,
  variant = "hero",
}: {
  src: string;
  title: string;
  variant?: keyof typeof STYLES;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={variant === "thumb" ? "" : `Portada de ${title}`}
      // The thumbnail is decoration next to a title that already says the
      // same thing, so it carries no alt text of its own.
      aria-hidden={variant === "thumb" || undefined}
      // The hero is the first thing on the screen and has no reserved height,
      // so deferring it would leave the page collapsed until S3 answers.
      // Thumbnails are a list that mostly starts below the fold.
      loading={variant === "thumb" ? "lazy" : "eager"}
      onError={() => setFailed(true)}
      className={STYLES[variant]}
    />
  );
}
