"use client";

import { useRef, useState } from "react";
import { uploadToBucket } from "@/lib/admin/upload-client";
import { MAX_ADMIN_FILE_BYTES, type AdminUploadMode } from "@/lib/uploads";
import { Label } from "@/components/admin/ui";

/**
 * Elegir un archivo y dejarlo en el bucket antes de enviar el formulario.
 *
 * El `<input type="file">` no llega nunca al server action: sube por
 * `/api/admin/subidas` en cuanto se elige, y lo que viaja con el formulario es
 * el `<input type="hidden">` con la clave. Es la misma razón que en el
 * formulario del profesor — un server action acepta 1 MB de cuerpo — y además
 * deja ver aquí mismo si S3 aceptó el archivo, en vez de enterarse al guardar.
 *
 * Vacío significa "no lo toques": un formulario de edición enviado sin elegir
 * archivo deja la fila con el que ya tenía.
 */

const MAX_MB = Math.round(MAX_ADMIN_FILE_BYTES / (1024 * 1024));

export function BucketUpload({
  name,
  prefix,
  label,
  accept,
  mode = "uuid",
  currentKey,
  previewUrl,
  removeName,
  hint,
}: {
  /** El campo oculto donde queda la clave. */
  name: string;
  prefix: string;
  label: string;
  accept?: string;
  mode?: AdminUploadMode;
  currentKey?: string | null;
  previewUrl?: string | null;
  /** Cuando se pasa, aparece la casilla para dejar la fila sin archivo. */
  removeName?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [key, setKey] = useState("");

  async function pick(file: File | undefined) {
    if (!file) return;
    setStatus("uploading");
    setMessage(`Subiendo "${file.name}"…`);

    const result = await uploadToBucket(file, prefix, mode);
    if (!result.ok) {
      setStatus("error");
      setMessage(result.error);
      setKey("");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setKey(result.key);
    setStatus("done");
    setMessage(`Listo: ${result.key}`);
  }

  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>

      {previewUrl && !key && (
        // Sin `next/image`: la URL es firmada y cambia cada seis horas, así que
        // el optimizador no podría cachearla y sólo añadiría un salto más.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt=""
          className="h-24 w-auto rounded-sm border border-line object-cover"
        />
      )}
      {currentKey && !key && (
        <code className="text-xs break-all text-muted">{currentKey}</code>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(event) => pick(event.target.files?.[0])}
        className="text-[13px] text-body file:mr-3 file:rounded-sm file:border file:border-lav-border file:bg-lav file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-indigo"
      />
      <input type="hidden" name={name} value={key} />

      <span
        className={`text-xs ${
          status === "error" ? "text-coral-ink" : status === "done" ? "text-mint-strong" : "text-muted"
        }`}
      >
        {message ?? hint ?? `Hasta ${MAX_MB} MB. Se sube al elegirlo.`}
      </span>

      {removeName && (
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            name={removeName}
            className="size-4 accent-[var(--color-indigo)]"
          />
          Quitar el archivo que tiene (no lo borra del bucket)
        </label>
      )}
    </div>
  );
}
