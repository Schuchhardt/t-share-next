import { redirect } from "next/navigation";
import { CreateActivityForm } from "@/components/create-activity-form";
import { getSession } from "@/lib/auth/session";
import { getGrades, getResourceTypes, getSkills, getSubjects, getSuggestedMaterials } from "@/lib/catalog";

export const metadata = { title: "Subir una actividad" };

export default async function CrearActividadPage() {
  const session = await getSession();
  if (!session) redirect("/entrar?next=/actividades/crear");

  const [subjects, grades, skills, resourceTypes, suggested] = await Promise.all([
    getSubjects(),
    getGrades(),
    getSkills(),
    getResourceTypes(),
    getSuggestedMaterials(),
  ]);

  return (
    <>
      <section className="max-w-[660px] pt-13 pb-[30px]">
        <h1 className="mb-3 text-[30px] leading-[1.1] font-bold tracking-[-0.015em] text-ink sm:text-[36px] lg:text-[42px]">
          Subir una actividad
        </h1>
        <p className="max-w-[52ch] text-[17px] text-pretty text-muted">
          Todo en una sola página, sin pasos. Lo único obligatorio es el título, la asignatura y el
          nivel.
        </p>
      </section>

      <CreateActivityForm
        subjects={subjects}
        grades={grades}
        skills={skills}
        resourceTypes={resourceTypes}
        suggestedMaterials={suggested.map((m) => m.name)}
      />
    </>
  );
}
