import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityDocuments } from "@/components/admin/activity-documents";
import { ActivityForm } from "@/components/admin/activity-form";
import { DangerZone } from "@/components/admin/danger-zone";
import { StateNotice } from "@/components/admin/list-tools";
import {
  deleteAdminActivity,
  purgeAdminActivity,
  restoreAdminActivity,
} from "@/lib/admin/activity-actions";
import { getAdminActivity, listAllResourceTypes } from "@/lib/admin/activities";
import { getGrades, getSkills, getSubjects } from "@/lib/catalog";
import { formatDate } from "@/lib/format";

/**
 * Una actividad: la ficha, sus documentos y la zona de riesgo.
 *
 * Tres bloques que se guardan por separado. La ficha es un formulario, cada
 * documento es el suyo, y borrar es otra cosa más — así un enlace mal pegado
 * en un adjunto no impide corregir el título.
 */

export async function generateMetadata({ params }: PageProps<"/admin/actividades/[id]">) {
  const activity = await getAdminActivity(Number((await params).id));
  return { title: activity ? activity.title : "Actividad" };
}

export default async function AdminActividadPage({
  params,
  searchParams,
}: PageProps<"/admin/actividades/[id]">) {
  const id = Number((await params).id);
  const [activity, subjects, grades, skills, resourceTypes, sp] = await Promise.all([
    getAdminActivity(id),
    getSubjects(),
    getGrades(),
    getSkills(),
    listAllResourceTypes(),
    searchParams,
  ]);
  if (!activity) notFound();

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/actividades">← Actividades</Link>
      </p>

      <h1 className="text-[26px] font-bold text-ink">{activity.title}</h1>
      <p className="mb-6 text-[13px] text-muted">
        #{activity.id} · {formatDate(activity.createdAt)} · {activity.downloadCount} descargas ·{" "}
        {activity.savedCount} guardados ·{" "}
        {activity.deletedAt ? (
          <span className="text-coral-ink">borrada</span>
        ) : (
          <Link href={`/actividades/detalle/${activity.id}`}>ver en el sitio</Link>
        )}
      </p>

      <StateNotice state={typeof sp.estado === "string" ? sp.estado : undefined} />
      {sp.creada === "1" && (
        <p className="mb-5 rounded-sm bg-mint px-3 py-2 text-sm text-mint-strong">
          Actividad creada. Ahora puedes agregarle documentos.
        </p>
      )}

      <div className="grid gap-5">
        <ActivityForm
          activity={activity}
          subjects={subjects}
          grades={grades}
          skills={skills}
        />

        <ActivityDocuments
          activityId={activity.id}
          documents={activity.documents}
          resourceTypes={resourceTypes}
        />

        <DangerZone
          id={activity.id}
          deleted={Boolean(activity.deletedAt)}
          confirmation="ELIMINAR"
          what="La actividad"
          cascade="sus documentos, sus comentarios y sus guardados (los archivos quedan en el bucket)"
          onDelete={deleteAdminActivity}
          onRestore={restoreAdminActivity}
          onPurge={purgeAdminActivity}
        />
      </div>
    </>
  );
}
