"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { recordDownload } from "@/lib/activity-actions";
import type { ActivityDocument } from "@/lib/types";

/**
 * The documents panel on an activity, with a preview for the files a browser
 * can already render: images, PDFs and video.
 *
 * Images get a thumbnail in the row, so the panel is scannable without
 * opening anything; everything previewable also opens full size in a modal.
 * A file we cannot show inline — a DOCX, a PPTX, a Canva link — keeps the
 * plain download it always had, rather than opening a viewer that would just
 * hand the browser a download anyway.
 *
 * The images come from S3 under a signed URL that rotates every few hours, so
 * they are plain `<img>` rather than `next/image`: the optimiser would key its
 * cache on a URL that never repeats, paying for a re-fetch on every render and
 * caching nothing.
 */

type Previewing = { name: string; url: string; kind: "image" | "pdf" | "video" };

export function DocumentList({
  activityId,
  documents,
  signedIn,
}: {
  activityId: number;
  documents: ActivityDocument[];
  signedIn: boolean;
}) {
  const [, startTransition] = useTransition();
  const [previewing, setPreviewing] = useState<Previewing | null>(null);

  /** Bumps the counter alongside the download the browser is already doing. */
  const count = useCallback(() => {
    if (!signedIn) return;
    startTransition(async () => {
      await recordDownload(activityId).catch(() => undefined);
    });
  }, [activityId, signedIn]);

  if (documents.length === 0) {
    return <p className="py-2 text-sm text-mint-meta">Esta actividad no tiene archivos.</p>;
  }

  return (
    <>
      {documents.map((doc) => (
        <DocumentRow
          key={`${doc.id}-${doc.name}`}
          doc={doc}
          onDownload={count}
          onPreview={(p) => setPreviewing(p)}
        />
      ))}

      {previewing && <PreviewDialog item={previewing} onClose={() => setPreviewing(null)} />}
    </>
  );
}

/** The line under a document's name: its type and its format, deduplicated. */
export function describe(doc: Pick<ActivityDocument, "kind" | "format">): string {
  const parts: string[] = [];
  for (const part of [doc.kind, doc.format]) {
    const value = part?.trim();
    if (!value) continue;
    if (parts.some((p) => p.toLowerCase() === value.toLowerCase())) continue;
    parts.push(value);
  }
  return parts.join(" · ") || "Archivo";
}

function DocumentRow({
  doc,
  onDownload,
  onPreview,
}: {
  doc: ActivityDocument;
  onDownload: () => void;
  onPreview: (item: Previewing) => void;
}) {
  // A thumbnail that 404s or whose signature expired should collapse to the
  // normal row rather than leave a broken-image icon in the panel.
  const [thumbFailed, setThumbFailed] = useState(false);

  // "Guía · PDF", but never "PDF · PDF" — the resource type and the extension
  // say the same thing often enough to be worth collapsing.
  const meta = describe(doc);
  const canPreview = doc.url !== null && doc.preview !== null;
  const showThumb = canPreview && doc.preview === "image" && !thumbFailed;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-mint-border py-[11px]">
      <div className="flex min-w-0 items-center gap-2.5">
        {showThumb && (
          <button
            type="button"
            onClick={() =>
              onPreview({ name: doc.name, url: doc.url!, kind: "image" })
            }
            className="shrink-0 cursor-zoom-in overflow-hidden rounded-sm border border-mint-border bg-white p-0"
            aria-label={`Ver ${doc.name} en grande`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={doc.url!}
              alt=""
              width={44}
              height={44}
              loading="lazy"
              onError={() => setThumbFailed(true)}
              className="block size-11 object-cover"
            />
          </button>
        )}
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate text-[15px] font-medium text-ink">{doc.name}</span>
          <span className="text-xs text-mint-meta">{meta}</span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {canPreview && (
          <button
            type="button"
            onClick={() =>
              onPreview({
                name: doc.name,
                url: doc.url!,
                kind: doc.preview as "image" | "pdf" | "video",
              })
            }
            className="border-none bg-transparent p-0 text-sm font-semibold text-mint-strong hover:underline"
          >
            Ver
          </button>
        )}
        {doc.url ? (
          <a
            href={doc.url}
            onClick={onDownload}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-mint-strong no-underline hover:underline"
          >
            Descargar ↓
          </a>
        ) : (
          <span className="text-sm font-semibold text-mint-meta opacity-60">No disponible</span>
        )}
      </div>
    </div>
  );
}

/**
 * The full-size viewer. A native `<dialog>` brings the focus trap, the
 * backdrop and Escape with it, so there is no keyboard handling to get wrong
 * here — only the click-outside-to-close, which `<dialog>` leaves to us.
 *
 * Every way out calls `onClose` directly and the parent unmounts the dialog;
 * nothing here listens for the `close` event or closes the element by hand.
 * That is deliberate. `close()` fires its event on a later task, so a viewer
 * that closed itself on the way out — which is what the cleanup used to do —
 * had the event land after React had already re-run the effect and re-opened
 * it, reading as the user dismissing a viewer that had just appeared. In
 * development, where React mounts an effect twice on purpose, that happened
 * on the very first frame: the modal opened and vanished in the same tick.
 */
function PreviewDialog({ item, onClose }: { item: Previewing; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Already open when React re-runs this effect on a development remount,
    // and `showModal` on an open dialog throws.
    if (!dialog.open) dialog.showModal();

    // The page behind should not scroll while the viewer is up. Removing the
    // dialog from the DOM takes it out of the top layer on its own, so the
    // cleanup has nothing to do but put the scrollbar back.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <dialog
      ref={ref}
      // Escape. Letting the default run would close the element under React;
      // unmounting it is the same result and keeps one way out.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // The dialog element itself is the backdrop area around the panel.
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[min(1000px,92vw)] max-w-none rounded-md border border-line bg-white p-0 backdrop:bg-ink/60"
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
        <h2 className="truncate text-[15px] font-semibold text-ink">{item.name}</h2>
        <div className="flex shrink-0 items-center gap-4">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-indigo"
          >
            Abrir en otra pestaña
          </a>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent p-0 text-sm font-semibold text-muted hover:text-ink"
          >
            Cerrar ✕
          </button>
        </div>
      </div>

      <div className="grid max-h-[78vh] place-items-center overflow-auto bg-row-hover p-3">
        {item.kind === "image" && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.url}
            alt={item.name}
            className="max-h-[72vh] w-auto max-w-full object-contain"
          />
        )}
        {item.kind === "pdf" && (
          <iframe
            src={item.url}
            title={item.name}
            className="h-[72vh] w-full border-none bg-white"
          />
        )}
        {item.kind === "video" && (
          <video src={item.url} controls className="max-h-[72vh] w-full bg-black">
            Tu navegador no puede reproducir este video.{" "}
            <a href={item.url}>Descárgalo</a> para verlo.
          </video>
        )}
      </div>
    </dialog>
  );
}
