"use client";

import { useRef, useState } from "react";

/**
 * The document picker on the upload form.
 *
 * The `<input type="file" name="files">` stays the source of truth so the
 * surrounding form posts the files as part of its own multipart body — React
 * state only mirrors it for the list below. Dropping files and removing one
 * write back into the input through a `DataTransfer`, which is the only way to
 * assign a `FileList`.
 */

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4";

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
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  /** Pushes the list back into the input so the form submits exactly it. */
  function sync(next: File[]) {
    const transfer = new DataTransfer();
    for (const file of next) transfer.items.add(file);
    if (inputRef.current) inputRef.current.files = transfer.files;
    setFiles(next);
  }

  function add(incoming: FileList | null) {
    if (!incoming) return;
    const accepted: File[] = [];
    const tooBig: string[] = [];
    for (const file of Array.from(incoming)) {
      if (file.size > MAX_BYTES) tooBig.push(file.name);
      else accepted.push(file);
    }
    setRejected(tooBig);
    sync([...files, ...accepted.filter((f) => !files.some((p) => sameFile(p, f)))]);
  }

  function remove(index: number) {
    sync(files.filter((_, i) => i !== index));
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
        <span className="text-sm text-muted">PDF, DOCX, PPTX, JPG · hasta 25 MB por archivo</span>
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
          {rejected.join(", ")} {rejected.length === 1 ? "supera" : "superan"} los 25 MB.
        </p>
      )}

      {files.length > 0 && (
        <ul className="grid gap-0">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-2.5"
            >
              <span className="grid gap-0.5">
                <span className="truncate text-[15px] font-medium text-ink">{file.name}</span>
                <span className="text-xs text-muted">{formatSize(file.size)}</span>
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
