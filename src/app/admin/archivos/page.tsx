import type { Route } from "next";
import Link from "next/link";
import { BucketUploader, ObjectRow } from "@/components/admin/file-manager";
import { hasStorageConfig } from "@/lib/env";
import { fileUrl, listObjects } from "@/lib/storage";
import { KNOWN_FOLDERS, normalisePrefix } from "@/lib/uploads";

/**
 * El bucket de S3, navegable.
 *
 * S3 no tiene carpetas: tiene claves con barras. Listar con `Delimiter: "/"`
 * devuelve un nivel — los prefijos comunes de aquí hacen de carpetas y el
 * resto son objetos — y así el explorador no tiene que traerse decenas de
 * miles de claves para mostrar diez.
 *
 * La paginación es por token opaco y no por número: S3 sabe seguir desde donde
 * quedó, pero no sabe saltar a la página siete. Por eso hay "siguiente" y
 * "volver al principio", y no una lista de números.
 */

export const metadata = { title: "Archivos" };

function href(prefix: string, cursor?: string | null): Route {
  const query = new URLSearchParams();
  if (prefix) query.set("prefix", prefix);
  if (cursor) query.set("cursor", cursor);
  const qs = query.toString();
  return (qs ? `/admin/archivos?${qs}` : "/admin/archivos") as Route;
}

/** "actividades/portadas/" → los tramos, cada uno con su prefijo acumulado. */
function crumbs(prefix: string): { label: string; prefix: string }[] {
  const parts = prefix.split("/").filter(Boolean);
  return parts.map((part, index) => ({
    label: part,
    prefix: `${parts.slice(0, index + 1).join("/")}/`,
  }));
}

export default async function AdminArchivosPage({ searchParams }: PageProps<"/admin/archivos">) {
  const sp = await searchParams;
  const prefix = normalisePrefix(typeof sp.prefix === "string" ? sp.prefix : "");
  const cursor = typeof sp.cursor === "string" ? sp.cursor : null;

  if (!hasStorageConfig()) {
    return (
      <>
        <h1 className="mb-4 text-[26px] font-bold text-ink">Archivos</h1>
        <p className="rounded-sm bg-[#fdecea] px-3 py-2 text-sm text-coral-ink">
          S3 no está configurado en este entorno: faltan <code>S3_BUCKET</code>,{" "}
          <code>S3_ACCESS_KEY_ID</code> o <code>S3_SECRET_ACCESS_KEY</code>.
        </p>
      </>
    );
  }

  let page;
  try {
    page = await listObjects(prefix, cursor);
  } catch (err) {
    return (
      <>
        <h1 className="mb-4 text-[26px] font-bold text-ink">Archivos</h1>
        <p className="rounded-sm bg-[#fdecea] px-3 py-2 text-sm text-coral-ink">
          El bucket no respondió: {err instanceof Error ? err.message : "error desconocido"}.
        </p>
      </>
    );
  }

  // Firmadas aquí: el bucket de producción es privado, así que una URL directa
  // respondería 403. Firmar es criptografía local, no un viaje a S3.
  const openUrls = await Promise.all(page.objects.map((object) => fileUrl({ key: object.key })));

  return (
    <>
      <h1 className="mb-2 text-[26px] font-bold text-ink">Archivos</h1>
      <p className="mb-4 text-[13px] text-muted">
        Subir y mover funcionan. <strong>Borrar puede no funcionar</strong>: las credenciales del
        bucket de producción no tienen <code>s3:DeleteObject</code>, así que S3 responde{" "}
        <code>AccessDenied</code> y el panel lo muestra tal cual en vez de decir que borró algo que
        sigue ahí. Para borrar de verdad hay que agregarle esa acción a la política del usuario IAM.
      </p>

      <nav className="mb-5 text-sm text-muted" aria-label="Ruta">
        <Link href={href("")}>bucket</Link>
        {crumbs(prefix).map((crumb) => (
          <span key={crumb.prefix}>
            {" / "}
            <Link href={href(crumb.prefix)}>{crumb.label}</Link>
          </span>
        ))}
      </nav>

      {!prefix && (
        <div className="mb-5 flex flex-wrap gap-2">
          {KNOWN_FOLDERS.map((folder) => (
            <Link
              key={folder}
              href={href(`${folder}/`)}
              className="rounded-sm border border-lav-border bg-lav px-3 py-1.5 text-[13px] font-semibold text-indigo no-underline hover:bg-lav-hover hover:no-underline"
            >
              {folder}
            </Link>
          ))}
        </div>
      )}

      <div className="mb-5">
        <BucketUploader prefix={prefix} />
      </div>

      {page.folders.length > 0 && (
        <ul className="mb-4 grid gap-1 text-sm">
          {page.folders.map((folder) => (
            <li key={folder}>
              <Link href={href(folder)}>📁 {folder.slice(prefix.length).replace(/\/$/, "")}</Link>
            </li>
          ))}
        </ul>
      )}

      <ul className="border-t border-ink">
        {page.objects.map((object, index) => (
          <ObjectRow key={object.key} object={object} openUrl={openUrls[index] ?? null} />
        ))}
      </ul>

      {page.objects.length === 0 && page.folders.length === 0 && (
        <p className="py-8 text-sm text-muted">Aquí no hay nada.</p>
      )}

      <nav className="mt-5 flex items-center gap-4 text-sm" aria-label="Paginación">
        {cursor && <Link href={href(prefix)}>← Volver al principio</Link>}
        {page.next ? (
          <Link href={href(prefix, page.next)}>Siguiente →</Link>
        ) : (
          <span className="text-muted">No hay más.</span>
        )}
      </nav>
    </>
  );
}
