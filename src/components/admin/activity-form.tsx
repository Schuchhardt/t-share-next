"use client";

import { useActionState } from "react";
import { BucketUpload } from "@/components/admin/bucket-upload";
import { Checkbox, Field, Messages, Panel, Select, Submit, TextArea } from "@/components/admin/ui";
import { createAdminActivity, updateAdminActivity } from "@/lib/admin/activity-actions";
import type { AdminActivityDetail } from "@/lib/admin/activities";
import type { AdminState } from "@/lib/admin/state";
import { MOMENTS, type CatalogItem, type Grade } from "@/lib/types";

/**
 * El formulario de una actividad, para crearla y para editarla.
 *
 * El autor se pide por correo y no con un desplegable: son casi tres mil
 * cuentas y ninguna lista de ese tamaño es usable. El server action lo resuelve
 * contra la tabla y falla con el correo delante si no existe.
 *
 * Los adjuntos no están aquí — se administran uno a uno en `ActivityDocuments`,
 * que vive al lado en la pantalla de edición. Meterlos en este formulario
 * habría significado reconstruir la lista entera en cada guardado.
 */

const EMPTY: AdminState = { error: null, notice: null };

export function ActivityForm({
  activity,
  subjects,
  grades,
  skills,
  defaultAuthorEmail,
}: {
  /** null cuando es una actividad nueva. */
  activity: AdminActivityDetail | null;
  subjects: CatalogItem[];
  grades: Grade[];
  skills: CatalogItem[];
  defaultAuthorEmail?: string;
}) {
  const [state, formAction] = useActionState(
    activity ? updateAdminActivity : createAdminActivity,
    EMPTY,
  );

  return (
    <form action={formAction} className="grid gap-5">
      {activity && <input type="hidden" name="id" value={activity.id} />}

      <Panel title="Ficha">
        <div className="grid gap-4">
          <Field name="title" label="Título" required defaultValue={activity?.title} />
          <TextArea
            name="learningObjective"
            label="Objetivo de aprendizaje"
            rows={2}
            defaultValue={activity?.learningObjective}
          />
          <TextArea
            name="description"
            label="Descripción"
            rows={4}
            defaultValue={activity?.description}
          />
          <TextArea
            name="evaluation"
            label="Evaluación"
            rows={3}
            defaultValue={activity?.evaluation}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              name="subjectId"
              label="Asignatura"
              required
              options={subjects}
              defaultValue={activity?.subjectId}
              placeholder="Elige una"
            />
            <Select
              name="gradeId"
              label="Nivel"
              required
              options={grades}
              defaultValue={activity?.gradeId}
              placeholder="Elige uno"
            />
            <Field
              name="durationMinutes"
              label="Duración (minutos)"
              type="number"
              defaultValue={activity?.durationMinutes}
            />
          </div>

          <Field
            name="authorEmail"
            label="Autor (correo)"
            type="email"
            required
            defaultValue={activity?.authorEmail ?? defaultAuthorEmail}
            hint="La cuenta a la que queda colgada la actividad. Tiene que existir."
          />
        </div>
      </Panel>

      <Panel title="Portada">
        <BucketUpload
          name="coverKey"
          prefix="actividades/portadas"
          label="Imagen"
          accept="image/*"
          currentKey={activity?.coverKey}
          previewUrl={activity?.coverPreviewUrl}
          removeName={activity ? "removeCover" : undefined}
        />
      </Panel>

      <Panel
        title="Momentos de la clase"
        description="Los que queden en blanco no se guardan."
      >
        <div className="grid gap-4">
          {MOMENTS.map((moment) => (
            <TextArea
              key={moment}
              name={`step_${moment}`}
              label={moment}
              rows={3}
              defaultValue={activity?.steps[moment] ?? ""}
            />
          ))}
        </div>
      </Panel>

      <Panel title="Materiales y habilidades">
        <div className="grid gap-4">
          <TextArea
            name="materials"
            label="Materiales"
            rows={4}
            defaultValue={activity?.materials.join("\n")}
            hint="Uno por línea."
          />

          {skills.length > 0 && (
            <div className="grid gap-2">
              <span className="text-[13px] font-bold text-ink">Habilidades</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {skills.map((skill) => (
                  <Checkbox
                    key={skill.id}
                    name="skillIds"
                    value={skill.id}
                    label={skill.name}
                    defaultChecked={activity?.skillIds.includes(skill.id) ?? false}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Messages error={state.error} notice={state.notice} />

      <div>
        <Submit pendingLabel={activity ? "Guardando…" : "Creando…"}>
          {activity ? "Guardar cambios" : "Crear actividad"}
        </Submit>
      </div>
    </form>
  );
}
