"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * `hero` is the large landing-page field; `compact` is the one that sits above
 * the results list. Both submit to /actividades, preserving any active filters.
 */
export function SearchBar({
  variant = "hero",
  placeholder = "Buscar actividades…",
}: {
  variant?: "hero" | "compact";
  placeholder?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [syncedQ, setSyncedQ] = useState(urlQ);

  // Keep the field in step when the URL changes underneath us (back button, a
  // filter click that rewrites the query string) without reaching for an
  // effect: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (urlQ !== syncedQ) {
    setSyncedQ(urlQ);
    setQ(urlQ);
  }

  function submit() {
    const next = new URLSearchParams(params.toString());
    const term = q.trim();
    if (term) next.set("q", term);
    else next.delete("q");
    router.push(`/actividades${next.size ? `?${next}` : ""}`);
  }

  const hero = variant === "hero";

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex max-w-[700px] overflow-hidden rounded-md border-[1.5px] border-indigo bg-white"
    >
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar actividades"
        className={`min-w-0 flex-1 border-none bg-transparent text-ink placeholder:text-muted ${
          hero ? "px-5 py-[17px] text-[17px]" : "px-[18px] py-[13px] text-base"
        }`}
      />
      <button
        type="submit"
        className={`shrink-0 border-none bg-indigo font-semibold text-white transition-colors hover:bg-ink ${
          hero ? "px-7 text-base" : "px-[22px] text-[15px]"
        }`}
      >
        Buscar
      </button>
    </form>
  );
}
