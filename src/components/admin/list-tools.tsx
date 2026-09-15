import Link from "next/link";
import type { Route } from "next";

/**
 * La barra de búsqueda y el paginador de las dos listas del panel.
 *
 * Los dos son GET: el estado de la lista vive en la URL, así que una búsqueda
 * se puede compartir, marcar y recargar sin volver a escribirla. Por eso el
 * formulario no usa un server action.
 */

export function AdminSearch({
  action,
  defaultValue,
  placeholder,
  children,
}: {
  action: Route;
  defaultValue: string;
  placeholder: string;
  /** Casillas y campos ocultos que la lista quiera conservar al buscar. */
  children?: React.ReactNode;
}) {
  return (
    <form action={action} className="mb-5 flex flex-wrap items-center gap-3">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="min-w-[240px] flex-1 rounded-sm border border-lav-border px-3 py-2 text-[15px]"
      />
      {children}
      <button
        type="submit"
        className="rounded-sm bg-indigo px-4 py-2 text-sm font-semibold text-white hover:bg-ink"
      >
        Buscar
      </button>
    </form>
  );
}

export function AdminPager({
  page,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => Route;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (lastPage <= 1) return null;

  return (
    <nav className="mt-5 flex items-center gap-4 text-sm" aria-label="Paginación">
      {page > 1 ? <Link href={hrefFor(page - 1)}>← Anterior</Link> : <span className="text-muted">← Anterior</span>}
      <span className="text-muted">
        Página {page} de {lastPage} · {total} en total
      </span>
      {page < lastPage ? (
        <Link href={hrefFor(page + 1)}>Siguiente →</Link>
      ) : (
        <span className="text-muted">Siguiente →</span>
      )}
    </nav>
  );
}

/** El aviso que dejan las acciones al redirigir con `?estado=`. */
export function StateNotice({ state }: { state: string | undefined }) {
  const messages: Record<string, string> = {
    borrada: "Listo, quedó borrada. Sigue en la base y se puede restaurar.",
    restaurada: "Listo, quedó restaurada.",
    eliminada: "Eliminada definitivamente.",
    confirmacion: "No se eliminó: la confirmación que escribiste no coincide.",
  };
  const message = state ? messages[state] : undefined;
  if (!message) return null;

  return (
    <p
      className={`mb-5 rounded-sm px-3 py-2 text-sm ${
        state === "confirmacion" ? "bg-[#fdecea] text-coral-ink" : "bg-mint text-mint-strong"
      }`}
    >
      {message}
    </p>
  );
}
