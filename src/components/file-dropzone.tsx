"use client";

import { useEffect, useRef, useState } from "react";
import { fileLabel, previewKindForFile } from "@/lib/preview";
import { MAX_FILES, MAX_FILE_BYTES, maxMbFor } from "@/lib/uploads";

/**
 * The document picker on the upload form.
 *
 * The `<input type="file" name="files">` stays the source of truth — React
 * state only mirrors it for the list below. Dropping files and removing one
 * write back into the input through a `DataTransfer`, which is the only way to
 * assign a `FileList`. De ahí los saca `CreateActivityForm`, que los sube al
 * bucket antes de publicar; el `<form>` nunca los manda en su propio cuerpo.
 *
 * Each picked file carries its preview alongside it: an object URL when it is
 * an image, null otherwise. Minting it here rather than inside the row keeps
 * the URL's lifetime tied to the list that owns it, so removing a file can
 * revoke it on the spot instead of leaving the blob alive until reload.
 */

const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4";

/** A picked file and the object URL used to preview it, when it has one. */
type Picked = { file: File; url: string | null };

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** True when the two files are the same pick, so a re-drop does not duplicate. */
export function sameFile(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

export function FileDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const [overflow, setOverflow] = useState(0);

  // Written by `sync` below, never during render, so that leaving the page
  // releases whatever blobs the list still holds.
  const liveUrls = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      for (const url of liveUrls.current) URL.revokeObjectURL(url);
    };
  }, []);

  /** Pushes the list back into the input so the form submits exactly it. */
  function sync(next: Picked[]) {
    const transfer = new DataTransfer();
    for (const item of next) transfer.items.add(item.file);
    if (inputRef.current) inputRef.current.files = transfer.files;
    liveUrls.current = next.map((i) => i.url).filter((u): u is string => u !== null);
    setPicked(next);
  }

  function add(incoming: FileList | null) {
    if (!incoming) return;
    const accepted: File[] = [];
    const tooBig: string[] = [];
    for (const file of Array.from(incoming)) {
      if (file.size > MAX_FILE_BYTES) tooBig.push(file.name);
      else accepted.push(file);
    }
    const fresh = accepted
      .filter((f) => !picked.some((p) => sameFile(p.file, f)))
      .map((file) => ({
        file,
        url: previewKindForFile(file) === "image" ? URL.createObjectURL(file) : null,
      }));

    // Sobra decírselo aquí en vez de después de esperar la subida de doce
    // archivos para que el servidor lo rechace.
    const room = MAX_FILES - picked.length;
    const kept = fresh.slice(0, Math.max(room, 0));
    for (const extra of fresh.slice(kept.length)) {
      if (extra.url) URL.revokeObjectURL(extra.url);
    }
    setRejected(tooBig);
    setOverflow(fresh.length - kept.length);

    sync([...picked, ...kept]);
  }

  function remove(index: number) {
    const gone = picked[index];
    if (gone?.url) URL.revokeObjectURL(gone.url);
    sync(picked.filter((_, i) => i !== index));
  }

  return (
    <div className="grid gap-2.5">
      <span className="eyebrow">Documentos</span>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={`grid justify-items-center gap-2 rounded-md border-[1.5px] border-dashed border-indigo p-10 text-center transition-colors ${
          dragging ? "bg-lav" : "bg-white"
        }`}
      >
        <span className="text-base font-semibold text-ink">
          Arrastra guías, PPT o rúbricas aquí
        </span>
        <span className="text-sm text-muted">
          PDF, DOCX, PPTX, JPG · hasta {maxMbFor("document")} MB por archivo, {MAX_FILES} en total
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 rounded-sm border-[1.5px] border-indigo bg-transparent px-[18px] py-2.5 text-sm font-semibold text-indigo transition-colors hover:bg-lav"
        >
          Elegir archivos
        </button>
        <input
          ref={inputRef}
          type="file"
          name="files"
          multiple
          accept={ACCEPT}
          onChange={(e) => add(e.target.files)}
          className="sr-only"
          aria-label="Documentos de la actividad"
        />
      </div>

      {rejected.length > 0 && (
        <p role="alert" className="text-sm text-coral-ink">
          {rejected.join(", ")} {rejected.length === 1 ? "supera" : "superan"} los{" "}
          {maxMbFor("document")} MB.
        </p>
      )}

      {overflow > 0 && (
        <p role="alert" className="text-sm text-coral-ink">
          Solo caben {MAX_FILES} archivos por actividad; {overflow === 1 ? "quedó" : "quedaron"}{" "}
          {overflow} fuera.
        </p>
      )}

      {picked.length > 0 && (
        <ul className="grid gap-0">
          {picked.map((item, i) => (
            <li
              key={`${item.file.name}-${item.file.size}-${item.file.lastModified}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-2.5"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Thumb item={item} />
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate text-[15px] font-medium text-ink">
                    {item.file.name}
                  </span>
                  <span className="text-xs text-muted">{formatSize(item.file.size)}</span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="border-none bg-transparent p-0 text-sm font-medium text-indigo hover:underline"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The image itself when there is one, and the extension otherwise — a generic
 * paper icon would say less than "DOCX" does.
 */
function Thumb({ item }: { item: Picked }) {
  if (item.url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={item.url}
        alt=""
        className="size-11 shrink-0 rounded-sm border border-line object-cover"
      />
    );
  }

  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-sm bg-lav text-[10px] font-bold tracking-[0.04em] text-indigo">
      {fileLabel(item.file.name) ?? "DOC"}
    </span>
  );
}
