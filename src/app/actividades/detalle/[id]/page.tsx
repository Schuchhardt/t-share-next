import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityActions } from "@/components/activity-actions";
import { CommentThread } from "@/components/comment-thread";
import { DownloadLink } from "@/components/download-link";
import { getActivity, getSavedActivityIds } from "@/lib/activities";
import { getComments } from "@/lib/comments";
import { getSession } from "@/lib/auth/session";
import { formatDate, formatDuration, joinEs, metaLine } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/actividades/detalle/[id]">) {
  const { id } = await params;
  const activity = await getActivity(Number(id));
  if (!activity) return { title: "Actividad no encontrada" };
  return {
    title: activity.title,
    description: activity.learningObjective ?? activity.description ?? undefined,
  };
}

export default async function DetallePage({ params }: PageProps<"/actividades/detalle/[id]">) {
  const { id } = await params;
  const activityId = Number(id);
  const activity = await getActivity(activityId);
  if (!activity) notFound();

  const session = await getSession();
  const [saved, comments] = await Promise.all([
    session ? getSavedActivityIds(session.userId) : Promise.resolve([]),
    getComments(activityId),
  ]);

  const ficha = [
    activity.grades.length ? { k: "Nivel", v: joinEs(activity.grades) } : null,
    activity.subjects.length ? { k: "Asignatura", v: joinEs(activity.subjects) } : null,
    { k: "Duración", v: formatDuration(activity.durationMinutes) },
    activity.resourceTypes.length ? { k: "Tipo", v: activity.resourceTypes.join(", ") } : null,
    activity.units.length ? { k: "Unidad", v: joinEs(activity.units) } : null,
    { k: "Publicada", v: formatDate(activity.createdAt) },
  ].filter((row): row is { k: string; v: string } => row !== null);

  const documents = [
    ...(activity.pdfUrl
      ? [{ id: 0, name: "Actividad en PDF", url: activity.pdfUrl, kind: "PDF" }]
      : []),
    ...activity.documents,
  ];

  const meta = metaLine(activity);

  return (
    <>
      <section className="pt-[30px]">
        <Link href="/actividades" className="text-sm">
          ← Volver a resultados
        </Link>
      </section>

      <section className="section-rule pt-[22px] pb-8">
        {meta && (
          <div className="text-[13px] font-semibold tracking-[0.04em] text-muted">{meta}</div>
        )}
        <h1 className="mt-2.5 mb-3.5 max-w-[26ch] text-[30px] leading-[1.1] font-bold tracking-[-0.015em] text-pretty text-ink sm:text-[36px] lg:text-[42px]">
          {activity.title}
        </h1>
        <div className="flex flex-wrap items-center gap-[18px]">
          <span className="shrink-0 text-[15px] text-muted">
            {activity.author ? `Creada por ${activity.author.name}` : "Autor no disponible"}
          </span>
          <ActivityActions
            id={activity.id}
            title={activity.title}
            initialSaved={saved.includes(activity.id)}
            signedIn={Boolean(session)}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 items-start gap-13 pt-[34px] lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <div className="grid gap-[30px]">
          {activity.learningObjective && (
            <div className="grid gap-2">
              <span className="eyebrow">Objetivo de aprendizaje</span>
              <p className="text-[21px] leading-[1.45] font-medium text-pretty text-ink">
                {activity.learningObjective}
              </p>
            </div>
          )}

          {activity.description && (
            <div className="grid gap-2">
              <span className="eyebrow">Descripción</span>
              <p className="max-w-[66ch] text-base leading-[1.65] whitespace-pre-line text-pretty text-body">
                {activity.description}
              </p>
            </div>
          )}

          {activity.steps.length > 0 && (
            <div className="grid gap-2">
              <span className="eyebrow">Momentos de la clase</span>
              {activity.steps.map((step) => (
                <div
                  key={step.id}
                  className="grid grid-cols-[100px_minmax(0,1fr)] gap-4 border-b border-line py-3"
                >
                  <span className="text-sm font-semibold text-indigo">{step.name}</span>
                  <span className="text-[15px] leading-[1.6] whitespace-pre-line text-pretty text-body">
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activity.evaluation && (
            <div className="grid gap-2">
              <span className="eyebrow">Evaluación</span>
              <p className="max-w-[66ch] text-base leading-[1.65] whitespace-pre-line text-pretty text-body">
                {activity.evaluation}
              </p>
            </div>
          )}

          {activity.skills.length > 0 && (
            <div className="grid gap-2.5">
              <span className="eyebrow">Habilidades</span>
              <div className="flex flex-wrap gap-2">
                {activity.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-lav px-3.5 py-[7px] text-sm font-medium text-indigo"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          <CommentThread
            activityId={activity.id}
            comments={comments}
            signedIn={Boolean(session)}
          />
        </div>

        <aside className="grid gap-[26px] lg:sticky lg:top-[86px]">
          <div className="grid gap-2 rounded-md bg-mint p-5">
            <span className="eyebrow text-mint-label">Documentos</span>
            {documents.length === 0 && (
              <p className="py-2 text-sm text-mint-meta">Esta actividad no tiene archivos.</p>
            )}
            {documents.map((doc) => (
              <DownloadLink
                key={`${doc.id}-${doc.name}`}
                activityId={activity.id}
                href={doc.url}
                name={doc.name}
                meta={doc.kind ?? "Archivo"}
                signedIn={Boolean(session)}
              />
            ))}
          </div>

          <div className="grid gap-2">
            <span className="eyebrow">Ficha</span>
            {ficha.map((row) => (
              <div
                key={row.k}
                className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-t border-line py-2 text-sm"
              >
                <span className="text-muted">{row.k}</span>
                <span className="text-ink">{row.v}</span>
              </div>
            ))}
          </div>

          {activity.materials.length > 0 && (
            <div className="grid gap-2">
              <span className="eyebrow">Materiales</span>
              {activity.materials.map((material) => (
                <div key={material} className="border-t border-line py-2 text-sm text-body">
                  {material}
                </div>
              ))}
            </div>
          )}
        </aside>
      </section>
    </>
  );
}
