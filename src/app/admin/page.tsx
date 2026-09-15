import Link from "next/link";
import { countActivitiesForAdmin, countUsersForAdmin } from "@/lib/admin/activities";
import { hasStorageConfig } from "@/lib/env";

/**
 * El resumen: cuántas filas hay y por dónde se entra a cada cosa.
 *
 * Los contadores son cuatro `count` con `head: true`, así que no traen filas;
 * sirven para notar de un vistazo que algo se borró en masa.
 */

export const metadata = { title: "Resumen" };

function Card({
  href,
  title,
  live,
  deleted,
}: {
  href: "/admin/actividades" | "/admin/usuarios";
  title: string;
  live: number;
  deleted: number;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border border-line p-5 no-underline transition-colors hover:bg-row-hover hover:no-underline"
    >
      <span className="eyebrow">{title}</span>
      <p className="mt-2 text-[32px] leading-none font-bold text-ink">{live}</p>
      <p className="mt-2 text-[13px] text-muted">
        {deleted > 0 ? `${deleted} borrada${deleted === 1 ? "" : "s"}` : "ninguna borrada"}
      </p>
    </Link>
  );
}

export default async function AdminHomePage() {
  const [activities, users] = await Promise.all([
    countActivitiesForAdmin(),
    countUsersForAdmin(),
  ]);

  return (
    <>
      <h1 className="mb-6 text-[26px] font-bold text-ink">Panel</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          href="/admin/actividades"
          title="Actividades"
          live={activities.live}
          deleted={activities.deleted}
        />
        <Card href="/admin/usuarios" title="Cuentas" live={users.live} deleted={users.deleted} />
      </div>

      <div className="mt-6 grid gap-3 rounded-md border border-line p-5">
        <h2 className="text-[15px] font-bold text-ink">Archivos</h2>
        {hasStorageConfig() ? (
          <p className="text-sm text-muted">
            El bucket de S3 se navega en <Link href="/admin/archivos">/admin/archivos</Link>: subir,
            mover y borrar objetos, arrastrando las filas que los nombran.
          </p>
        ) : (
          <p className="text-sm text-coral-ink">
            S3 no está configurado en este entorno: faltan <code>S3_BUCKET</code>,{" "}
            <code>S3_ACCESS_KEY_ID</code> o <code>S3_SECRET_ACCESS_KEY</code>. Sin eso no se puede
            subir ni ver ningún archivo.
          </p>
        )}
      </div>
    </>
  );
}
