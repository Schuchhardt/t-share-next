import Link from "next/link";
import { notFound } from "next/navigation";
import { DangerZone } from "@/components/admin/danger-zone";
import { StateNotice } from "@/components/admin/list-tools";
import { UserForm } from "@/components/admin/user-form";
import { Panel } from "@/components/admin/ui";
import { listActivities } from "@/lib/admin/activities";
import { deleteUser, purgeUser, restoreUser } from "@/lib/admin/user-actions";
import { getAdminUser, listRoles } from "@/lib/admin/users";
import { formatDate } from "@/lib/format";

/**
 * Una cuenta: sus datos, sus actividades y la zona de riesgo.
 *
 * Las actividades salen aquí porque son lo que se pierde al eliminar la cuenta
 * de verdad — el esquema cascadea desde `tshare_users` — y nadie debería tener
 * que ir a otra pantalla a averiguar cuántas eran.
 */

export async function generateMetadata({ params }: PageProps<"/admin/usuarios/[id]">) {
  const user = await getAdminUser(Number((await params).id));
  return { title: user ? user.email : "Usuario" };
}

export default async function AdminUsuarioPage({
  params,
  searchParams,
}: PageProps<"/admin/usuarios/[id]">) {
  const id = Number((await params).id);
  const [user, roles, sp] = await Promise.all([
    getAdminUser(id),
    listRoles(),
    searchParams,
  ]);
  if (!user) notFound();

  const activities = await listActivities({ authorId: user.id, includeDeleted: true });

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/usuarios">← Usuarios</Link>
      </p>

      <h1 className="text-[26px] font-bold text-ink">{user.email}</h1>
      <p className="mb-6 text-[13px] text-muted">
        #{user.id} · alta {formatDate(user.createdAt)} ·{" "}
        {user.lastLoginAt ? `último acceso ${formatDate(user.lastLoginAt)}` : "nunca entró"}
        {user.loginAttempts > 0 && ` · ${user.loginAttempts} intentos fallidos`}
      </p>

      <StateNotice state={typeof sp.estado === "string" ? sp.estado : undefined} />
      {sp.creada === "1" && (
        <p className="mb-5 rounded-sm bg-mint px-3 py-2 text-sm text-mint-strong">
          Cuenta creada.
        </p>
      )}

      <div className="grid gap-5">
        <UserForm user={user} roles={roles} />

        <Panel
          title={`Actividades (${activities.total})`}
          description="Lo que publicó esta cuenta, incluido lo borrado."
        >
          {activities.items.length === 0 ? (
            <p className="text-sm text-muted">No publicó ninguna.</p>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {activities.items.map((activity) => (
                <li key={activity.id}>
                  <Link href={`/admin/actividades/${activity.id}`}>{activity.title}</Link>
                  {activity.deletedAt && <span className="text-xs text-muted"> · borrada</span>}
                </li>
              ))}
              {activities.total > activities.items.length && (
                <li className="text-xs text-muted">
                  y {activities.total - activities.items.length} más.
                </li>
              )}
            </ul>
          )}
        </Panel>

        <DangerZone
          id={user.id}
          deleted={Boolean(user.deletedAt)}
          confirmation={user.email}
          what="La cuenta"
          cascade={`sus ${activities.total} actividad${activities.total === 1 ? "" : "es"}, sus comentarios, sus guardados y sus descargas`}
          onDelete={deleteUser}
          onRestore={restoreUser}
          onPurge={purgeUser}
        />
      </div>
    </>
  );
}
