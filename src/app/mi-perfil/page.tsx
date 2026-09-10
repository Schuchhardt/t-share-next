import { redirect } from "next/navigation";
import { ProfileActivities } from "@/components/profile-activities";
import { getActivitiesByAuthor, getSavedActivities } from "@/lib/activities";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/users";

export const metadata = { title: "Mis actividades" };

/** Everything here is per-teacher, so nothing is cached across requests. */
export const dynamic = "force-dynamic";

export default async function MiPerfilPage({ searchParams }: PageProps<"/mi-perfil">) {
  const session = await getSession();
  if (!session) redirect("/entrar?next=/mi-perfil");

  // Set by `changePassword` when the profile screen sends it back here.
  const sp = await searchParams;
  const notice = sp.password === "cambiada" ? "Listo, tu contraseña quedó cambiada." : null;

  const [profile, uploaded, saved] = await Promise.all([
    getProfile(session.userId),
    getActivitiesByAuthor(session.userId),
    getSavedActivities(session.userId),
  ]);

  if (!profile) redirect("/entrar");

  return (
    <ProfileActivities profile={profile} uploaded={uploaded} saved={saved} notice={notice} />
  );
}
