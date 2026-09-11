"use client";

import { useEffect, useRef, useState } from "react";
import { formatSize } from "@/components/file-dropzone";
import { previewKindForFile } from "@/lib/preview";
import { MAX_COVER_BYTES, maxMbFor } from "@/lib/uploads";

/**
 * Picking one image, with the image itself as the preview.
 *
 * Used twice: the activity cover on the upload form — step 2 of the Angular
 * form, which only showed the chosen file's name — and the profile photo,
 * where the old "Editar perfil" screen showed a "Sin imagen" placeholder.
 *
 * The `<input type="file">` stays the source of truth so the surrounding form
 * posts the file in its own multipart body. The preview is an object URL
 * minted when the file is chosen and revoked as soon as it is replaced or
 * cleared, so at most one blob is alive at a time.
 *
 * `currentUrl` is what the account already has: it fills the frame until a new
 * file is chosen, and "Quitar" falls back to it rather than to the empty
 * state — this component picks a replacement, it does not delete.
 */

type Picked = { file: File; url: string };

export function ImagePicker({
  name,
  label,
  hint,
  alt,
  currentUrl = null,
  round = false,
}: {
  /** The field name the form posts under. */
  name: string;
  label: string;
  /** Shown while nothing is picked, next to the button. */
  hint: string;
  /** Alt text for the preview. */
  alt: string;
  currentUrl?: string | null;
  /** Profile photos are round; activity covers are not. */
  round?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Written only from the handlers below, so leaving the page releases the blob.
  const liveUrl = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (liveUrl.current) URL.revokeObjectURL(liveUrl.current);
    };
  }, []);

  /** Drops the current pick, the preview blob and the file on the input. */
  function clear() {
    if (liveUrl.current) URL.revokeObjectURL(liveUrl.current);
    liveUrl.current = null;
    if (inputRef.current) inputRef.current.value = "";
    setPicked(null);
  }

  function pick(chosen: File | undefined) {
    if (!chosen) return;

    if (previewKindForFile(chosen) !== "image") {
      setError("Tiene que ser una imagen: JPG, PNG, GIF o WEBP.");
      clear();
      return;
    }
    if (chosen.size > MAX_COVER_BYTES) {
      setError(`"${chosen.name}" supera los ${maxMbFor("cover")} MB.`);
      clear();
      return;
    }

    if (liveUrl.current) URL.revokeObjectURL(liveUrl.current);
    const url = URL.createObjectURL(chosen);
    liveUrl.current = url;
    setError(null);
    setPicked({ file: chosen, url });
  }

  const showing = picked?.url ?? currentUrl;

  return (
    <div className="grid gap-2.5">
      <span className="eyebrow">{label}</span>

      <div className="flex flex-wrap items-center gap-4">
        <div
          className={`grid size-[104px] shrink-0 place-items-center overflow-hidden border-[1.5px] border-dashed border-indigo bg-white ${
            round ? "rounded-full" : "rounded-md"
          }`}
        >
          {showing ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={showing} alt={alt} className="size-full object-cover" />
          ) : (
            <span className="px-2 text-center text-xs text-muted">Sin imagen</span>
          )}
        </div>

        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-sm border-[1.5px] border-indigo bg-transparent px-[18px] py-2.5 text-sm font-semibold text-indigo transition-colors hover:bg-lav"
            >
              {showing ? "Cambiar imagen" : "Elegir imagen"}
            </button>
            {picked && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  clear();
                }}
                className="border-none bg-transparent p-0 text-sm font-medium text-indigo hover:underline"
              >
                {currentUrl ? "Deshacer" : "Quitar"}
              </button>
            )}
          </div>
          <span className="text-sm text-muted">
            {picked ? `${picked.file.name} · ${formatSize(picked.file.size)}` : hint}
          </span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={(e) => pick(e.target.files?.[0])}
        className="sr-only"
        aria-label={label}
      />

      {error && (
        <p role="alert" className="text-sm text-coral-ink">
          {error}
        </p>
      )}
    </div>
  );
}
