"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { Messages, Submit } from "@/components/admin/ui";
import { deleteStoredObject, renameStoredObject } from "@/lib/admin/file-actions";
import { uploadToBucket } from "@/lib/admin/upload-client";
import type { AdminState } from "@/lib/admin/state";
import type { StoredObject } from "@/lib/storage";
import { MAX_ADMIN_FILE_BYTES } from "@/lib/uploads";
import { formatSize } from "@/components/file-dropzone";

/**
 * El bucket como si fuera una carpeta: subir, renombrar y borrar.
 *
 * Renombrar en S3 es copiar y borrar, y borrar deja colgando a la fila que
 * nombraba esa clave. Las dos acciones arrastran las filas que apuntaban ahí
 * (`src/lib/admin/files.ts`), así que mover una portada la sigue mostrando en
 * su actividad y borrarla la deja sin portada — no con una portada rota.
 */

const EMPTY: AdminState = { error: null, notice: null };
const MAX_MB = Math.round(MAX_ADMIN_FILE_BYTES / (1024 * 1024));

/**
 * Sube varios archivos conservando su nombre, uno detrás de otro.
 *
 * En serie y no en paralelo a propósito: cada uno gasta el presupuesto entero
 * de la función, y diez a la vez es la forma más rápida de que fallen diez.
 */
export function BucketUploader({ prefix }: { prefix: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<string[]>([]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setLines([]);

    const results: string[] = [];
    for (const file of Array.from(files)) {
      const result = await uploadToBucket(file, prefix, "name");
      results.push(result.ok ? `✓ ${result.key}` : `✗ ${result.error}`);
      setLines([...results]);
    }

    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="rounded-sm border border-dashed border-lav-border p-4">
      <strong className="text-sm text-ink">Subir a {prefix || "la raíz del bucket"}</strong>
      <p className="mt-1 mb-3 text-xs text-muted">
        Conserva el nombre del archivo. Si esa clave ya existe, se le agrega un sufijo en vez de
        sobrescribirla. Hasta {MAX_MB} MB por archivo — más que eso no cabe en la función y hay que
        subirlo a S3 por fuera.
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        disabled={busy || !prefix}
        onChange={(event) => upload(event.target.files)}
        className="text-[13px] text-body file:mr-3 file:rounded-sm file:border file:border-lav-border file:bg-lav file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-indigo disabled:opacity-50"
      />

      {!prefix && (
        <p className="mt-2 text-xs text-coral-ink">
          Entra a una carpeta antes de subir: el bucket no guarda archivos sueltos en la raíz.
        </p>
      )}

      {lines.length > 0 && (
        <ul className="mt-3 grid gap-1 text-xs break-all text-muted">
          {lines.map((line) => (
            <li key={line} className={line.startsWith("✗") ? "text-coral-ink" : "text-mint-strong"}>
              {line}
            </li>
          ))}
        </ul>
      )}

      {busy && <p className="mt-2 text-xs text-muted">Subiendo…</p>}
    </div>
  );
}

export function ObjectRow({
  object,
  openUrl,
}: {
  object: StoredObject;
  /** Firmada en el servidor, porque el bucket de producción es privado. */
  openUrl: string | null;
}) {
  const [renameState, rename] = useActionState(renameStoredObject, EMPTY);
  const [deleteState, remove] = useActionState(deleteStoredObject, EMPTY);
  const [renaming, setRenaming] = useState(false);

  return (
    <li className="border-b border-line py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <code className="text-[13px] break-all text-ink">{object.key.split("/").pop()}</code>
        <span className="text-xs text-muted">
          {formatSize(object.size)}
          {object.lastModified && ` · ${object.lastModified.slice(0, 10)}`}
          {openUrl && (
            <>
              {" · "}
              <a href={openUrl} target="_blank" rel="noreferrer">
                abrir
              </a>
            </>
          )}
          {" · "}
          <button
            type="button"
            onClick={() => setRenaming((value) => !value)}
            className="border-none bg-transparent p-0 text-xs text-indigo underline"
          >
            {renaming ? "cancelar" : "mover"}
          </button>
        </span>
      </div>

      {renaming && (
        <form action={rename} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="key" value={object.key} />
          <label className="grid flex-1 gap-1">
            <span className="text-xs text-muted">Clave nueva</span>
            <input
              name="newKey"
              defaultValue={object.key}
              className="w-full rounded-sm border border-lav-border px-2 py-1.5 text-[13px]"
            />
          </label>
          <Submit tone="plain" pendingLabel="Moviendo…">
            Mover
          </Submit>
        </form>
      )}

      <form action={remove} className="mt-2 flex flex-wrap items-center gap-3">
        <input type="hidden" name="key" value={object.key} />
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" name="confirm" className="size-4 accent-[var(--color-indigo)]" />
          Borrar aunque lo use alguna actividad
        </label>
        <Submit tone="danger" pendingLabel="Borrando…">
          Borrar
        </Submit>
      </form>

      <Messages error={renameState.error ?? deleteState.error} notice={renameState.notice ?? deleteState.notice} />
    </li>
  );
}
