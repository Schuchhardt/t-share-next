import type { Route } from "next";
import Link from "next/link";
import { BulkTable, type BulkRow } from "@/components/admin/bulk-table";
import { AdminPager, AdminSearch, BulkNotice, StateNotice } from "@/components/admin/list-tools";
import { listActivities } from "@/lib/admin/activities";
import {
  archiveAdminActivities,
  purgeAdminActivities,
  restoreAdminActivities,
} from "@/lib/admin/activity-actions";
import { formatDate } from "@/lib/format";

/**
 * Las actividades, incluidas las que el sitio ya no muestra.
 *
 * Igual que la lista de cuentas: el estado vive en la URL y las archivadas se
 * piden aparte, porque son justamente las que no hay que ver todos los días.
 *
 * La tabla la dibuja `BulkTable`, que es cliente: acá se arman las celdas y se
 * le pasan ya hechas, junto con las tres acciones que puede disparar.
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

  const rows: BulkRow[] = results.items.map((activity) => ({
    id: activity.id,
    name: `«${activity.title}»`,
    archived: activity.deletedAt !== null,
    cells: [
      <div key="titulo">
        <Link href={`/admin/actividades/${activity.id}`} className="font-semibold">
          {activity.title}
        </Link>
        {activity.deletedAt && <span className="block text-xs text-coral-ink">archivada</span>}
      </div>,
      <span key="autor" className="text-xs text-muted">
        {activity.authorId ? (
          <Link href={`/admin/usuarios/${activity.authorId}`}>{activity.authorName}</Link>
        ) : (
          activity.authorName
        )}
      </span>,
      activity.documentCount,
      activity.downloadCount,
      <span key="alta" className="text-xs whitespace-nowrap text-muted">{formatDate(activity.createdAt)}</span>,
    ],
  }));

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
      <BulkNotice
        result={typeof sp.lote === "string" ? sp.lote : undefined}
        count={Number(typeof sp.n === "string" ? sp.n : 0) || 0}
        one="actividad"
        many="actividades"
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
          Sólo archivadas
        </label>
      </AdminSearch>

      <BulkTable
        headers={["Actividad", "Autor", "Docs", "Descargas", "Publicada"]}
        rows={rows}
        back={hrefFor(page)}
        one="actividad"
        many="actividades"
        cascade="sus documentos, comentarios y guardados"
        empty="No hay actividades con esa búsqueda."
        onArchive={archiveAdminActivities}
        onRestore={restoreAdminActivities}
        onPurge={purgeAdminActivities}
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
