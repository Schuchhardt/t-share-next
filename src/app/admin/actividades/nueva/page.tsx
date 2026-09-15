import Link from "next/link";
import { ActivityForm } from "@/components/admin/activity-form";
import { getGrades, getSkills, getSubjects } from "@/lib/catalog";

export const metadata = { title: "Crear actividad" };

/**
 * Una actividad creada desde el panel.
 *
 * Los adjuntos no están aquí: se agregan en la pantalla de edición, a la que
 * `createAdminActivity` redirige apenas la actividad existe. Es la única forma
 * de colgarle documentos a algo que todavía no tiene id.
 */
export default async function AdminNuevaActividadPage() {
  const [subjects, grades, skills] = await Promise.all([getSubjects(), getGrades(), getSkills()]);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/actividades">← Actividades</Link>
      </p>
      <h1 className="mb-2 text-[26px] font-bold text-ink">Crear actividad</h1>
      <p className="mb-6 text-sm text-muted">
        Los documentos se agregan después de crearla, en su pantalla de edición.
      </p>

      <ActivityForm activity={null} subjects={subjects} grades={grades} skills={skills} />
    </>
  );
}
