"use client";

import { useActionState } from "react";
import { BucketUpload } from "@/components/admin/bucket-upload";
import { Field, Messages, Panel, Select, Submit } from "@/components/admin/ui";
import {
  addActivityDocument,
  deleteActivityDocument,
  updateActivityDocument,
} from "@/lib/admin/activity-actions";
import type { AdminDocument } from "@/lib/admin/activities";
import type { AdminState } from "@/lib/admin/state";
import type { CatalogItem } from "@/lib/types";

/**
 * Los adjuntos de una actividad, uno a uno.
 *
 * Cada fila es su propio formulario y su propia acción. Podrían ser un solo
 * formulario gigante que mande la lista entera, y sería peor: un error en el
 * último documento haría fallar el guardado de los diez, y borrar uno
 * obligaría a mandar los otros nueve para decir que siguen ahí.
 *
 * Un documento es un archivo del bucket o un enlace de fuera — el catálogo
 * heredado tiene de los dos, con 762 filas que guardan un enlace de Canva.
 */

const EMPTY: AdminState = { error: null, notice: null };

export function ActivityDocuments({
  activityId,
  documents,
  resourceTypes,
}: {
  activityId: number;
  documents: AdminDocument[];
  resourceTypes: CatalogItem[];
}) {
  return (
    <Panel
      title={`Documentos (${documents.length})`}
      description="Cada uno se guarda y se borra por su cuenta."
    >
      <div className="grid gap-4">
        {documents.map((document) => (
          <DocumentRow
            key={document.id}
            activityId={activityId}
            document={document}
            resourceTypes={resourceTypes}
          />
        ))}

        {documents.length === 0 && (
          <p className="text-sm text-muted">Esta actividad no tiene documentos.</p>
        )}

        <NewDocument activityId={activityId} resourceTypes={resourceTypes} />
      </div>
    </Panel>
  );
}

function DocumentRow({
  activityId,
  document,
  resourceTypes,
}: {
  activityId: number;
  document: AdminDocument;
  resourceTypes: CatalogItem[];
}) {
  const [saveState, save] = useActionState(updateActivityDocument, EMPTY);
  const [deleteState, remove] = useActionState(deleteActivityDocument, EMPTY);

  return (
    <div className="rounded-sm border border-line p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <strong className="text-sm text-ink">{document.displayName}</strong>
        <span className="text-xs text-muted">
          {document.format ?? "enlace"} · #{document.id}
          {document.openUrl && (
            <>
              {" · "}
              <a href={document.openUrl} target="_blank" rel="noreferrer">
                abrir
              </a>
            </>
          )}
        </span>
      </div>

      <form action={save} className="grid gap-3">
        <input type="hidden" name="id" value={document.id} />
        <input type="hidden" name="activityId" value={activityId} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="name" label="Nombre" defaultValue={document.name} />
          <Select
            name="resourceTypeId"
            label="Tipo"
            options={resourceTypes}
            defaultValue={document.resourceTypeId}
            placeholder="Sin tipo"
          />
        </div>

        <Field
          name="externalUrl"
          label="Enlace externo"
          defaultValue={document.externalUrl}
          hint="Para los documentos que viven fuera del bucket (Canva, Drive…)."
        />

        <BucketUpload
          name="fileKey"
          prefix="actividades/recursos"
          label="Reemplazar el archivo"
          currentKey={document.fileKey}
          hint="En blanco deja el archivo que ya tiene."
        />

        <Messages error={saveState.error} notice={saveState.notice} />

        <div>
          <Submit tone="plain">Guardar documento</Submit>
        </div>
      </form>

      <form action={remove} className="mt-3 border-t border-line pt-3">
        <input type="hidden" name="id" value={document.id} />
        <input type="hidden" name="activityId" value={activityId} />

        {document.fileKey && (
          <label className="mb-2 flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              name="alsoFile"
              className="size-4 accent-[var(--color-indigo)]"
            />
            Borrar también el archivo del bucket
          </label>
        )}

        <Messages error={deleteState.error} notice={deleteState.notice} />

        <div className="mt-2">
          <Submit tone="danger" pendingLabel="Eliminando…">
            Eliminar documento
          </Submit>
        </div>
      </form>
    </div>
  );
}

function NewDocument({
  activityId,
  resourceTypes,
}: {
  activityId: number;
  resourceTypes: CatalogItem[];
}) {
  const [state, add] = useActionState(addActivityDocument, EMPTY);

  return (
    <form action={add} className="grid gap-3 rounded-sm border border-dashed border-lav-border p-4">
      <strong className="text-sm text-ink">Agregar documento</strong>
      <input type="hidden" name="activityId" value={activityId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="name" label="Nombre" placeholder="Guía de trabajo" />
        <Select
          name="resourceTypeId"
          label="Tipo"
          options={resourceTypes}
          placeholder="Sin tipo"
        />
      </div>

      <BucketUpload name="fileKey" prefix="actividades/recursos" label="Archivo" />

      <Field
        name="externalUrl"
        label="…o un enlace externo"
        placeholder="https://"
        hint="Sube un archivo o pega un enlace: uno de los dos."
      />

      <Messages error={state.error} notice={state.notice} />

      <div>
        <Submit pendingLabel="Agregando…">Agregar</Submit>
      </div>
    </form>
  );
}
