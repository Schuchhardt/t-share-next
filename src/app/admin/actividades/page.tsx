import type { Route } from "next";
import Link from "next/link";
import { AdminPager, AdminSearch, StateNotice } from "@/components/admin/list-tools";
import { listActivities } from "@/lib/admin/activities";
import { formatDate } from "@/lib/format";

/**
 * Las actividades, incluidas las que el sitio ya no muestra.
 *
 * Igual que la lista de cuentas: el estado vive en la URL y las borradas se
 * piden aparte, porque son justamente las que no hay que ver todos los días.
 */

export const metadata = { title: "Actividades" };

export default async function AdminActividadesPage({
  searchParams,
}: PageProps<"/admin/actividades">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Number(typeof sp.page === "string" ? sp.page : 1) || 1;
  const onlyDeleted = sp.estado === "borradas";

  const results = await listActivities({ q, page, onlyDeleted });

  const hrefFor = (target: number): Route => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (onlyDeleted) query.set("estado", "borradas");
    if (target > 1) query.set("page", String(target));
    const qs = query.toString();
    return (qs ? `/admin/actividades?${qs}` : "/admin/actividades") as Route;
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[26px] font-bold text-ink">Actividades</h1>
        <Link
          href="/admin/actividades/nueva"
          className="rounded-sm bg-green px-4 py-2 text-sm font-semibold text-green-ink no-underline hover:bg-green-hover hover:no-underline"
        >
          Crear actividad
        </Link>
      </div>

      <StateNotice
        state={typeof sp.estado === "string" && sp.estado !== "borradas" ? sp.estado : undefined}
      />

      <AdminSearch
        action="/admin/actividades"
        defaultValue={q}
        placeholder="Título, objetivo o descripción"
      >
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
              <th className="py-2 pr-3 font-bold">Actividad</th>
              <th className="py-2 pr-3 font-bold">Autor</th>
              <th className="py-2 pr-3 font-bold">Docs</th>
              <th className="py-2 pr-3 font-bold">Descargas</th>
              <th className="py-2 font-bold">Publicada</th>
            </tr>
          </thead>
          <tbody>
            {results.items.map((activity) => (
              <tr key={activity.id} className="border-b border-line hover:bg-row-hover">
                <td className="py-2.5 pr-3">
                  <Link href={`/admin/actividades/${activity.id}`} className="font-semibold">
                    {activity.title}
                  </Link>
                  {activity.deletedAt && (
                    <span className="block text-xs text-coral-ink">borrada</span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-xs text-muted">
                  {activity.authorId ? (
                    <Link href={`/admin/usuarios/${activity.authorId}`}>{activity.authorName}</Link>
                  ) : (
                    activity.authorName
                  )}
                </td>
                <td className="py-2.5 pr-3">{activity.documentCount}</td>
                <td className="py-2.5 pr-3">{activity.downloadCount}</td>
                <td className="py-2.5 text-xs text-muted">{formatDate(activity.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {results.items.length === 0 && (
        <p className="py-8 text-sm text-muted">No hay actividades con esa búsqueda.</p>
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
