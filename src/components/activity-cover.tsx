"use client";

import { useState } from "react";

/**
 * The activity cover — `actividades.avatar` on the old table.
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
export function ActivityCover({ src, title }: { src: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={`Portada de ${title}`}
      onError={() => setFailed(true)}
      className="max-h-[420px] w-full rounded-md border border-line object-cover"
    />
  );
}
