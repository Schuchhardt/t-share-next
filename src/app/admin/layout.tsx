import type { Metadata } from "next";
import Link from "next/link";
import { adminSignOut } from "@/lib/admin/actions";
import { getAdminSession } from "@/lib/admin/session";

/**
 * El panel de administración.
 *
 * Cuelga del layout de la aplicación, así que arriba sigue estando la cabecera
 * del sitio. Es a propósito: el panel se maneja con la misma sesión de
 * navegador que el sitio y conviene ver cuál de los dos se está mirando.
 *
 * La barra de abajo sólo aparece cuando hay sesión de panel, para que
 * /admin/entrar — la única pantalla de aquí a la que se llega sin haber
 * entrado — no ofrezca enlaces que van a rebotar contra el proxy.
 */

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel T-share" },
  // Nada de esto tiene sentido en un índice, y menos aún en uno público.
  robots: { index: false, follow: false, nocache: true },
};

/** El panel lee y escribe la base en cada visita; no hay nada que prerenderizar. */
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/actividades", label: "Actividades" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/archivos", label: "Archivos" },
] as const;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await getAdminSession();

  return (
    <div className="pt-8 pb-20">
      {admin && (
        <div className="section-rule mb-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-2.5">
          <nav className="flex flex-wrap gap-4" aria-label="Panel">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-semibold">
                {item.label}
              </Link>
            ))}
          </nav>

          <form action={adminSignOut}>
            <button
              type="submit"
              className="border-none bg-transparent p-0 text-sm text-muted hover:text-ink"
            >
              Salir del panel
            </button>
          </form>
        </div>
      )}

      {children}
    </div>
  );
}
