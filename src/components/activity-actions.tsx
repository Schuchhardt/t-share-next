"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toggleSaved } from "@/lib/activity-actions";

/**
 * Save and share on the activity header.
 *
 * Saving is a server action against `tshare_saved_activities`, so it follows
 * the teacher between devices — the old localStorage store only knew about one
 * browser. The button flips optimistically and rolls back if the write fails.
 */
export function ActivityActions({
  id,
  title,
  initialSaved,
  signedIn,
}: {
  id: number;
  title: string;
  initialSaved: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function flash(message: string) {
    setNote(message);
    setTimeout(() => setNote(null), 2500);
  }

  function save() {
    if (!signedIn) {
      router.push(`/entrar?next=${encodeURIComponent(`/actividades/detalle/${id}`)}`);
      return;
    }
    startTransition(async () => {
      setOptimisticSaved(!saved);
      const result = await toggleSaved(id);
      if (result.ok) setSaved(!saved);
      else flash("No pudimos guardar la actividad.");
    });
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Dismissed, or the share sheet is unavailable — fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      flash("Enlace copiado");
    } catch {
      flash("No se pudo copiar el enlace");
    }
  }

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={save}
        disabled={pending}
        aria-pressed={optimisticSaved}
        className={`rounded-sm border-[1.5px] px-4 py-[9px] text-sm font-semibold transition-colors disabled:opacity-70 ${
          optimisticSaved
            ? "border-coral bg-coral text-coral-ink"
            : "border-indigo bg-transparent text-indigo hover:bg-lav"
        }`}
      >
        {optimisticSaved ? "Guardada ✓" : "Guardar"}
      </button>

      <button
        type="button"
        onClick={share}
        className="rounded-sm border-[1.5px] border-indigo bg-transparent px-4 py-[9px] text-sm font-semibold text-indigo transition-colors hover:bg-lav"
      >
        Compartir
      </button>

      <span aria-live="polite" className="text-sm text-muted">
        {note}
      </span>
    </div>
  );
}
