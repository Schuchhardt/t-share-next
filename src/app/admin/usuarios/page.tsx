import type { Route } from "next";
import Link from "next/link";
import { AdminPager, AdminSearch, StateNotice } from "@/components/admin/list-tools";
import { listUsers } from "@/lib/admin/users";
import { formatDate } from "@/lib/format";

/**
 * Las cuentas.
 *
 * La lista vive en la URL: `?q=`, `?page=` y `?estado=borradas`. Las cuentas
 * borradas no salen por defecto — son las que el sitio ya no muestra — y se
 * piden marcando la casilla.
 */

export const metadata = { title: "Usuarios" };

export default async function AdminUsuariosPage({ searchParams }: PageProps<"/admin/usuarios">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Number(typeof sp.page === "string" ? sp.page : 1) || 1;
  const onlyDeleted = sp.estado === "borradas";

  const results = await listUsers({ q, page, onlyDeleted });

  const hrefFor = (target: number): Route => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (onlyDeleted) query.set("estado", "borradas");
    if (target > 1) query.set("page", String(target));
    const qs = query.toString();
    return (qs ? `/admin/usuarios?${qs}` : "/admin/usuarios") as Route;
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[26px] font-bold text-ink">Usuarios</h1>
        <Link
          href="/admin/usuarios/nuevo"
          className="rounded-sm bg-green px-4 py-2 text-sm font-semibold text-green-ink no-underline hover:bg-green-hover hover:no-underline"
        >
          Crear cuenta
        </Link>
      </div>

      <StateNotice state={typeof sp.estado === "string" && sp.estado !== "borradas" ? sp.estado : undefined} />

      <AdminSearch action="/admin/usuarios" defaultValue={q} placeholder="Correo, nombre o apellido">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            name="estado"
            value="borradas"
            defaultChecked={onlyDeleted}
            className="size-4 accent-[var(--color-indigo)]"
          />
          Sólo borradas
        </label>
      </AdminSearch>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink text-left">
              <th className="py-2 pr-3 font-bold">Cuenta</th>
              <th className="py-2 pr-3 font-bold">Estado</th>
              <th className="py-2 pr-3 font-bold">Actividades</th>
              <th className="py-2 pr-3 font-bold">Último acceso</th>
              <th className="py-2 font-bold">Alta</th>
            </tr>
          </thead>
          <tbody>
            {results.items.map((user) => (
              <tr key={user.id} className="border-b border-line hover:bg-row-hover">
                <td className="py-2.5 pr-3">
                  <Link href={`/admin/usuarios/${user.id}`} className="font-semibold">
                    {user.name}
                  </Link>
                  <span className="block text-xs text-muted">{user.email}</span>
                </td>
                <td className="py-2.5 pr-3 text-xs text-muted">
                  {user.deletedAt ? "Borrada" : user.isActive ? "Activa" : "Inactiva"}
                  {user.mustChangePassword && <span className="block">Debe cambiar clave</span>}
                </td>
                <td className="py-2.5 pr-3">{user.activityCount}</td>
                <td className="py-2.5 pr-3 text-xs text-muted">
                  {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Nunca"}
                </td>
                <td className="py-2.5 text-xs text-muted">{formatDate(user.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {results.items.length === 0 && (
        <p className="py-8 text-sm text-muted">No hay cuentas con esa búsqueda.</p>
      )}

      <AdminPager
        page={results.page}
        total={results.total}
        pageSize={results.pageSize}
        hrefFor={hrefFor}
      />
    </>
  );
}
