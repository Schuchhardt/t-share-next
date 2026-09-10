"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FileDropzone } from "@/components/file-dropzone";
import { ImagePicker } from "@/components/image-picker";
import { createActivity } from "@/lib/activity-actions";
import type { CatalogItem, Grade } from "@/lib/types";

/**
 * Publishing an activity.
 *
 * The whole form posts to one server action, files included: the dropzone
 * keeps its `<input type="file">` inside the form, so the browser submits the
 * files as part of the same multipart body and `createActivity` streams them
 * to S3. That keeps the upload and the row in one request — a separate upload
 * endpoint would leave orphan objects behind whenever the row failed to save.
 */

const MOMENTS = ["Inicio", "Desarrollo", "Cierre"] as const;

function Publish() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-sm border-none bg-green px-6 py-[13px] text-[15px] font-bold text-green-ink transition-colors hover:bg-green-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Publicando…" : "Publicar actividad"}
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
  const [state, formAction] = useActionState(createActivity, { ok: true, error: null });

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

      <ImagePicker />

      <FileDropzone />

      <div className="grid gap-3.5 border-t border-line pt-1.5">
        <p aria-live="polite" className="min-h-[1.25rem] text-sm text-coral-ink">
          {state.error}
        </p>
        <div className="flex flex-wrap items-center gap-3.5">
          <Publish />
          <span className="text-sm text-muted">
            Se publica con tu nombre y queda visible para todos los profesores.
          </span>
        </div>
      </div>
    </form>
  );
}
