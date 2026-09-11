"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { FileDropzone } from "@/components/file-dropzone";
import { ImagePicker } from "@/components/image-picker";
import { createActivity, type ActionResult } from "@/lib/activity-actions";
import { MOMENTS, type CatalogItem, type Grade } from "@/lib/types";
import { uploadPicked, type PickedUpload } from "@/lib/upload-client";
import { maxMbFor } from "@/lib/uploads";

/**
 * Publishing an activity.
 *
 * Publicar son dos pasos, y el orden importa. Los archivos no caben dentro del
 * server action, que acepta 1 MB de cuerpo: primero se suben de a uno a
 * `POST /api/subidas`, que los deja en el bucket, y recién después se manda el
 * formulario con las claves que devolvió.
 *
 * Los dos pasos viven dentro de la misma acción del `<form>`, de modo que
 * `useFormStatus` cubre la subida igual que el guardado: el botón queda
 * deshabilitado desde el primer byte hasta el redirect, y un archivo que no
 * sube deja la actividad sin publicar en vez de publicarla a medias.
 *
 * El precio es que el formulario ya no funciona sin JavaScript. Elegir un
 * archivo tampoco funcionaba sin él, así que lo que se pierde es publicar solo
 * texto con JS apagado.
 */

function Publish({ phase }: { phase: string | null }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-sm border-none bg-green px-6 py-[13px] text-[15px] font-bold text-green-ink transition-colors hover:bg-green-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (phase ?? "Publicando…") : "Publicar actividad"}
    </button>
  );
}

export function CreateActivityForm({
  subjects,
  grades,
  skills,
  resourceTypes,
  suggestedMaterials,
}: {
  subjects: CatalogItem[];
  grades: Grade[];
  skills: CatalogItem[];
  resourceTypes: CatalogItem[];
  suggestedMaterials: string[];
}) {
  const [phase, setPhase] = useState<string | null>(null);

  /**
   * Sube lo que el profesor eligió y, si todo llegó al bucket, publica.
   * Los `File` salen del FormData antes de mandarlo: ya están en S3, y
   * mandarlos otra vez es justamente lo que reventaba el límite de 1 MB.
   */
  async function publish(prev: ActionResult, formData: FormData): Promise<ActionResult> {
    const isFile = (v: FormDataEntryValue): v is File => v instanceof File && v.size > 0;
    const cover = formData.getAll("cover").filter(isFile);
    const documents = formData.getAll("files").filter(isFile);
    formData.delete("cover");
    formData.delete("files");

    const picked: PickedUpload[] = [
      ...cover.map((file) => ({ kind: "cover" as const, file })),
      ...documents.map((file) => ({ kind: "document" as const, file })),
    ];

    try {
      if (picked.length > 0) {
        setPhase(`Subiendo 1 de ${picked.length}…`);
        const uploaded = await uploadPicked(picked, (done, total) => {
          setPhase(done < total ? `Subiendo ${done + 1} de ${total}…` : "Publicando…");
        });
        if (!uploaded.ok) return { ok: false, error: uploaded.error };
        formData.set(
          "uploads",
          JSON.stringify({ cover: uploaded.cover, files: uploaded.files }),
        );
      }
      setPhase("Publicando…");
      return await createActivity(prev, formData);
    } catch (err) {
      // `createActivity` termina en un `redirect()`, que React propaga como
      // una excepción propia: esa tiene que seguir su camino.
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
      if (typeof err === "object" && err !== null && "digest" in err) throw err;
      return { ok: false, error: "No pudimos publicar la actividad. Vuelve a intentarlo." };
    } finally {
      setPhase(null);
    }
  }

  const [state, formAction] = useActionState<ActionResult, FormData>(publish, {
    ok: true,
    error: null,
  });

  return (
    <form action={formAction} className="grid max-w-[760px] gap-[34px]">
      <div className="grid gap-[18px] rounded-md bg-lav p-[26px]">
        <div className="grid gap-[7px]">
          <label htmlFor="title" className="text-sm font-bold text-ink">
            Título de la actividad
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={300}
            placeholder="Ej. Representar porcentajes con material concreto"
            className="field"
          />
        </div>

        <div className="grid gap-[7px]">
          <label htmlFor="learningObjective" className="text-sm font-bold text-ink">
            Objetivo de aprendizaje
          </label>
          <input
            id="learningObjective"
            name="learningObjective"
            placeholder="Ej. Representar porcentajes como fracción y decimal"
            className="field"
          />
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-[18px]">
          <div className="grid gap-[7px]">
            <label htmlFor="subjectId" className="text-sm font-bold text-ink">
              Asignatura
            </label>
            <select id="subjectId" name="subjectId" required defaultValue="" className="field">
              <option value="" disabled>
                Elige una…
              </option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-[7px]">
            <label htmlFor="gradeId" className="text-sm font-bold text-ink">
              Nivel
            </label>
            <select id="gradeId" name="gradeId" required defaultValue="" className="field">
              <option value="" disabled>
                Elige uno…
              </option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.level ? `${g.name} · ${g.level}` : g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-[7px]">
            <label htmlFor="durationMinutes" className="text-sm font-bold text-ink">
              Duración (min)
            </label>
            <input
              id="durationMinutes"
              name="durationMinutes"
              type="number"
              min={0}
              max={1000}
              step={5}
              placeholder="45"
              className="field"
            />
          </div>
        </div>

        <div className="grid gap-[7px]">
          <label htmlFor="description" className="text-sm font-bold text-ink">
            Descripción <span className="font-normal text-muted">— opcional</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            placeholder="En qué consiste la actividad y cómo se aplica en la sala."
            className="field resize-y"
          />
        </div>
      </div>

      <fieldset className="grid gap-[18px]">
        <legend className="eyebrow mb-2">Momentos de la clase</legend>
        {MOMENTS.map((moment) => (
          <div key={moment} className="grid gap-[7px]">
            <label htmlFor={`step_${moment}`} className="text-sm font-bold text-ink">
              {moment} <span className="font-normal text-muted">— opcional</span>
            </label>
            <textarea
              id={`step_${moment}`}
              name={`step_${moment}`}
              rows={2}
              className="field resize-y"
            />
          </div>
        ))}
      </fieldset>

      <div className="grid gap-[7px]">
        <label htmlFor="evaluation" className="text-sm font-bold text-ink">
          Evaluación <span className="font-normal text-muted">— opcional</span>
        </label>
        <textarea id="evaluation" name="evaluation" rows={3} className="field resize-y" />
      </div>

      <div className="grid gap-[7px]">
        <label htmlFor="materials" className="text-sm font-bold text-ink">
          Materiales <span className="font-normal text-muted">— uno por línea</span>
        </label>
        <textarea
          id="materials"
          name="materials"
          rows={3}
          placeholder={suggestedMaterials.slice(0, 3).join("\n") || "Plumones\nCartulina"}
          className="field resize-y"
        />
      </div>

      {skills.length > 0 && (
        <fieldset className="grid gap-[9px]">
          <legend className="text-sm font-bold text-ink">Habilidades que desarrolla</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-x-5 gap-y-2">
            {skills.map((skill) => (
              <label
                key={skill.id}
                className="flex cursor-pointer items-start gap-[9px] text-sm text-muted transition-colors hover:text-ink"
              >
                <input
                  type="checkbox"
                  name="skillIds"
                  value={skill.id}
                  className="mt-[3px] accent-indigo"
                />
                <span>{skill.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {resourceTypes.length > 0 && (
        <div className="grid max-w-[260px] gap-[7px]">
          <label htmlFor="resourceTypeId" className="text-sm font-bold text-ink">
            Tipo de los documentos
          </label>
          <select id="resourceTypeId" name="resourceTypeId" defaultValue="" className="field">
            <option value="">Sin especificar</option>
            {resourceTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <ImagePicker
        name="cover"
        label="Portada"
        alt="Vista previa de la portada"
        hint={`Opcional · JPG o PNG, hasta ${maxMbFor("cover")} MB`}
      />

      <FileDropzone />

      <div className="grid gap-3.5 border-t border-line pt-1.5">
        <p aria-live="polite" className="min-h-[1.25rem] text-sm text-coral-ink">
          {state.error}
        </p>
        <div className="flex flex-wrap items-center gap-3.5">
          <Publish phase={phase} />
          <span className="text-sm text-muted">
            Se publica con tu nombre y queda visible para todos los profesores.
          </span>
        </div>
      </div>
    </form>
  );
}
