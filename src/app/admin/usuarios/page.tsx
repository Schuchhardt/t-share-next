import type { Route } from "next";
import Link from "next/link";
import { BulkTable, type BulkRow } from "@/components/admin/bulk-table";
import { AdminPager, AdminSearch, BulkNotice, StateNotice } from "@/components/admin/list-tools";
import { listUsers } from "@/lib/admin/users";
import { archiveUsers, purgeUsers, restoreUsers } from "@/lib/admin/user-actions";
import { formatDate } from "@/lib/format";

/**
 * Las cuentas.
 *
 * La lista vive en la URL: `?q=`, `?page=` y `?estado=borradas`. Las cuentas
 * archivadas no salen por defecto — son las que el sitio ya no muestra — y se
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

  const rows: BulkRow[] = results.items.map((user) => ({
    id: user.id,
    // Con el número de actividades delante: es lo que se lleva un eliminado.
    name:
      user.activityCount > 0
        ? `${user.name} (${user.activityCount} ${user.activityCount === 1 ? "actividad" : "actividades"})`
        : user.name,
    archived: user.deletedAt !== null,
    cells: [
      <div key="cuenta">
        <Link href={`/admin/usuarios/${user.id}`} className="font-semibold">
          {user.name}
        </Link>
        <span className="block text-xs text-muted">{user.email}</span>
      </div>,
      <span key="estado" className="text-xs text-muted">
        {user.deletedAt ? "Archivada" : user.isActive ? "Activa" : "Inactiva"}
        {user.mustChangePassword && <span className="block">Debe cambiar clave</span>}
      </span>,
      user.activityCount,
      <span key="acceso" className="text-xs whitespace-nowrap text-muted">
        {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Nunca"}
      </span>,
      <span key="alta" className="text-xs whitespace-nowrap text-muted">{formatDate(user.createdAt)}</span>,
    ],
  }));

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
      <BulkNotice
        result={typeof sp.lote === "string" ? sp.lote : undefined}
        count={Number(typeof sp.n === "string" ? sp.n : 0) || 0}
        one="cuenta"
        many="cuentas"
      />

      <AdminSearch action="/admin/usuarios" defaultValue={q} placeholder="Correo, nombre o apellido">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            name="estado"
            value="borradas"
            defaultChecked={onlyDeleted}
            className="size-4 accent-[var(--color-indigo)]"
          />
          Sólo archivadas
        </label>
      </AdminSearch>

      <BulkTable
        headers={["Cuenta", "Estado", "Actividades", "Último acceso", "Alta"]}
        rows={rows}
        back={hrefFor(page)}
        one="cuenta"
        many="cuentas"
        cascade="todo lo que publicaron: sus actividades, comentarios y guardados"
        empty="No hay cuentas con esa búsqueda."
        onArchive={archiveUsers}
        onRestore={restoreUsers}
        onPurge={purgeUsers}
      />

      <AdminPager
        page={results.page}
        total={results.total}
        pageSize={results.pageSize}
        hrefFor={hrefFor}
      />
    </>
  );
}
