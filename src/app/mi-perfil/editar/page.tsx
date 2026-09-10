import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordForm } from "@/components/password-form";
import { ProfileForm } from "@/components/profile-form";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/users";

export const metadata = { title: "Editar perfil" };

/** Per-teacher, so nothing here is cached across requests. */
export const dynamic = "force-dynamic";

/**
 * "Editar perfil", the screen the Angular site had under `/perfil/editar/:id`.
 *
 * It sits under `/mi-perfil` rather than at the old path because the old one
 * carried an id that only ever pointed at the signed-in teacher: the session
 * already says who this is, and a URL that takes someone else's id invites the
 * question of whether it would work.
 *
 * Two independent forms, each posting to its own action, so a failed password
 * change never throws away a name the teacher just typed.
 */
export default async function EditarPerfilPage() {
  const session = await getSession();
  if (!session) redirect("/entrar?next=/mi-perfil/editar");

  const profile = await getProfile(session.userId);
  if (!profile) redirect("/entrar");

  return (
    <div className="max-w-[660px]">
      <section className="pt-[30px]">
        <Link href="/mi-perfil" className="text-sm">
          ← Volver a mi perfil
        </Link>
      </section>

      <section className="section-rule pt-[22px] pb-8">
        <h1 className="mb-3 text-[30px] leading-[1.1] font-bold tracking-[-0.015em] text-ink sm:text-[36px]">
          Editar perfil
        </h1>
        <p className="text-[17px] text-pretty text-muted">
          Tu nombre y tu foto son lo que ven los demás profesores en las actividades que publicas.
        </p>
      </section>

      <section className="pt-[34px]">
        <ProfileForm profile={profile} />
      </section>

      <section className="mt-13 border-t border-line pt-9">
        <h2 className="eyebrow mb-2">Contraseña</h2>
        <p className="mb-6 max-w-[52ch] text-[15px] text-pretty text-muted">
          Te pedimos la actual para que una sesión prestada no pueda quedarse con tu cuenta.
        </p>
        <PasswordForm next="/mi-perfil?password=cambiada" />
      </section>
    </div>
  );
}
