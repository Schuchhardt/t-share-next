"use client";

import { useState } from "react";
import { ConfirmSubmit, Submit } from "@/components/admin/ui";

/**
 * Las dos listas del panel, con lo que se puede hacer sobre las filas.
 *
 * Cada fila trae sus dos botones directos — archivar, que es marcar
 * `deleted_at` y sacarla del sitio sin perder nada, y eliminar, que se lleva la
 * fila de verdad — y la barra de arriba hace lo mismo sobre todo lo marcado.
 * Las tres operaciones son las mismas acciones de servidor: una fila es un lote
 * de uno.
 *
 * La selección vive acá y no en el DOM porque los formularios no se pueden
 * anidar: si la tabla entera fuera un formulario, el botón de una fila mandaría
 * también las casillas marcadas de las demás. Marcado y fila quedan separados
 * — la barra arma sus propios campos ocultos con lo seleccionado, y cada fila
 * tiene su formulario con un solo id.
 *
 * Las celdas llegan ya dibujadas desde la página, que es un componente de
 * servidor: acá no hay nada que sepa qué es una actividad o una cuenta.
 */

export type BulkRow = {
  id: number;
  /** Para nombrarla en el diálogo de confirmación. */
  name: string;
  archived: boolean;
  cells: React.ReactNode[];
};

export function BulkTable({
  headers,
  rows,
  back,
  one,
  many,
  cascade,
  empty,
  minWidth = 940,
  onArchive,
  onRestore,
  onPurge,
}: {
  headers: string[];
  rows: BulkRow[];
  /** La lista tal como está ahora, para volver a ella con la búsqueda intacta. */
  back: string;
  one: string;
  many: string;
  /** Lo que se lleva por delante un eliminado, dicho en el diálogo. */
  cascade: string;
  empty: string;
  minWidth?: number;
  onArchive: (formData: FormData) => Promise<void>;
  onRestore: (formData: FormData) => Promise<void>;
  onPurge: (formData: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const chosen = new Set(selected);
  const count = selected.length;
  const noun = count === 1 ? one : many;
  const allShown = rows.length > 0 && count === rows.length;

  // La lista por omisión no muestra archivadas y la de archivadas no muestra
  // otra cosa, así que cada vista ofrece la mitad que tiene sentido ahí.
  const someLive = rows.some((row) => !row.archived);
  const someArchived = rows.some((row) => row.archived);

  function toggle(id: number) {
    setSelected((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );
  }

  return (
    <>
      <div className="mb-3 grid gap-2.5 rounded-sm border border-line bg-white px-3 py-2.5">
        <form className="flex flex-wrap items-center gap-2.5">
          {selected.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <input type="hidden" name="back" value={back} />

          <span className="mr-1 text-sm text-muted">
            {count === 0 ? "Marca filas para actuar sobre varias" : `${count} ${noun}`}
          </span>

          {someLive && (
            <Submit
              tone="plain"
              formAction={onArchive}
              disabled={count === 0}
              pendingLabel="Archivando…"
            >
              Archivar selección
            </Submit>
          )}
          {someArchived && (
            <Submit
              tone="plain"
              formAction={onRestore}
              disabled={count === 0}
              pendingLabel="Restaurando…"
            >
              Restaurar selección
            </Submit>
          )}

          <span className="border-l border-line pl-2.5">
            <ConfirmSubmit
              formAction={onPurge}
              disabled={count === 0}
              question={`¿Eliminar ${count} ${noun} definitivamente?`}
              detail={`Se ${count === 1 ? "borra la fila" : "borran las filas"} de la base, y con ${
                count === 1 ? "ella" : "ellas"
              } ${cascade}. No tiene vuelta atrás.`}
            >
              Eliminar selección
            </ConfirmSubmit>
          </span>
        </form>

        {count > 0 && (
          <p className="text-xs text-muted">
            Archivar saca {count === 1 ? "la fila" : "las filas"} del sitio y se puede deshacer.
            Eliminar no.
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-ink text-left">
              <th className="w-8 py-2 pr-3">
                <input
                  type="checkbox"
                  checked={allShown}
                  ref={(box) => {
                    if (box) box.indeterminate = count > 0 && !allShown;
                  }}
                  onChange={() => setSelected(allShown ? [] : rows.map((row) => row.id))}
                  aria-label="Marcar todas las de esta página"
                  className="size-4 accent-[var(--color-indigo)]"
                />
              </th>
              {headers.map((header) => (
                <th key={header} className="py-2 pr-3 font-bold">
                  {header}
                </th>
              ))}
              <th className="py-2 font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-line hover:bg-row-hover ${
                  chosen.has(row.id) ? "bg-lav" : ""
                }`}
              >
                <td className="py-2.5 pr-3 align-top">
                  <input
                    type="checkbox"
                    checked={chosen.has(row.id)}
                    onChange={() => toggle(row.id)}
                    aria-label={`Marcar ${row.name}`}
                    className="mt-1 size-4 accent-[var(--color-indigo)]"
                  />
                </td>
                {/* El orden de las celdas es el de las columnas: fijo. */}
                {row.cells.map((cell, index) => (
                  <td key={index} className="py-2.5 pr-3 align-top">
                    {cell}
                  </td>
                ))}
                <td className="py-2.5 align-top">
                  <span className="flex gap-1.5">
                    <RowAction
                      action={row.archived ? onRestore : onArchive}
                      id={row.id}
                      back={back}
                      question={row.archived ? `¿Restaurar ${row.name}?` : `¿Archivar ${row.name}?`}
                      detail={
                        row.archived
                          ? "Vuelve a aparecer en el sitio."
                          : "Sale del sitio pero sigue en la base: se puede restaurar."
                      }
                      tone="plain"
                    >
                      {row.archived ? "Restaurar" : "Archivar"}
                    </RowAction>
                    <RowAction
                      action={onPurge}
                      id={row.id}
                      back={back}
                      question={`¿Eliminar ${row.name} definitivamente?`}
                      detail={`Se borra la fila de la base, y con ella ${cascade}. No tiene vuelta atrás.`}
                    >
                      Eliminar
                    </RowAction>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && <p className="py-8 text-sm text-muted">{empty}</p>}
    </>
  );
}

/** Un botón de fila: su propio formulario, con un solo id adentro. */
function RowAction({
  action,
  id,
  back,
  question,
  detail,
  tone = "danger",
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  id: number;
  back: string;
  question: string;
  detail?: string;
  tone?: "plain" | "danger";
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="ids" value={id} />
      <input type="hidden" name="back" value={back} />
      <ConfirmSubmit tone={tone} compact question={question} detail={detail}>
        {children}
      </ConfirmSubmit>
    </form>
  );
}
