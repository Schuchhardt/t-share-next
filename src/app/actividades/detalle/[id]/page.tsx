import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityActions } from "@/components/activity-actions";
import { ActivityCover } from "@/components/activity-cover";
import { CommentThread } from "@/components/comment-thread";
import { DocumentList } from "@/components/document-list";
import { JsonLd } from "@/components/json-ld";
import { getActivity, getSavedActivityIds } from "@/lib/activities";
import { getComments } from "@/lib/comments";
import { getSession } from "@/lib/auth/session";
import { formatDate, formatDuration, joinEs, metaLine } from "@/lib/format";
import {
  activityDescription,
  activityJsonLd,
  activityTitle,
  breadcrumbJsonLd,
} from "@/lib/seo";
import type { ActivityDocument } from "@/lib/types";

/**
 * The activity is what gets shared, so this is the screen whose metadata
 * matters most.
 *
 * The Open Graph block is spelled out rather than inherited: without it a
 * pasted link would carry the site's own title and pitch, and every activity
 * in a WhatsApp group would preview as the same card. The image is not set
 * here on purpose — `opengraph-image.tsx` in this directory draws one per
 * activity and Next.js attaches it.
 */
export async function generateMetadata({
  params,
}: PageProps<"/actividades/detalle/[id]">): Promise<Metadata> {
  const { id } = await params;
  const activity = await getActivity(Number(id));
  if (!activity) {
    return { title: "Actividad no encontrada", robots: { index: false, follow: true } };
  }

  const description = activityDescription(activity);
  const path = `/actividades/detalle/${activity.id}`;

  return {
    title: activityTitle(activity),
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      locale: "es_CL",
      siteName: "T-share",
      url: path,
      title: activity.title,
      description,
      publishedTime: activity.createdAt,
      ...(activity.author ? { authors: [activity.author.name] } : {}),
    },
    twitter: { card: "summary_large_image", title: activity.title, description },
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

  const documents: ActivityDocument[] = [
    ...(activity.pdfUrl
      ? [
          {
            id: 0,
            name: "Actividad en PDF",
            url: activity.pdfUrl,
            kind: "PDF",
            preview: "pdf" as const,
            format: "PDF",
          },
        ]
      : []),
    ...activity.documents,
  ];

  const meta = metaLine(activity);

  return (
    <>
      {/* The ficha as structured data: objective, grade, subject and duration
          are exactly what a teacher searches for, and only this says so in a
          form a search engine reads. */}
      <JsonLd data={activityJsonLd(activity)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Actividades", path: "/actividades" },
          { name: activity.title, path: `/actividades/detalle/${activity.id}` },
        ])}
      />

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
          {activity.coverUrl && (
            <ActivityCover src={activity.coverUrl} title={activity.title} />
          )}

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
            <DocumentList
              activityId={activity.id}
              documents={documents}
              signedIn={Boolean(session)}
            />
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
