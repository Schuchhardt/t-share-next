import { KeyForm } from "@/components/admin/key-form";
import { hasAdminConfig } from "@/lib/env";

/**
 * La puerta del panel: una llave, sin correo y sin cuenta.
 *
 * Es la única pantalla de /admin a la que el proxy deja llegar sin sesión. Si
 * `ADMIN_KEY` no está puesta lo dice aquí en vez de dejar que alguien pruebe
 * llaves contra un panel que no existe.
 */
export default async function AdminEntrarPage({ searchParams }: PageProps<"/admin/entrar">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const enabled = hasAdminConfig();

  return (
    <section className="mx-auto max-w-[420px] pt-10">
      <h1 className="mb-2 text-[26px] font-bold text-ink">Panel de administración</h1>

      {enabled ? (
        <>
          <p className="mb-6 text-sm text-muted">
            Escribe la llave del panel. Es la variable de entorno <code>ADMIN_KEY</code>, no la
            contraseña de ninguna cuenta.
          </p>
          <KeyForm next={next} />
        </>
      ) : (
        <p className="rounded-sm bg-mint px-4 py-3 text-sm text-mint-strong">
          El panel no está habilitado en este entorno. Pon <code>ADMIN_KEY</code> en las variables
          de entorno (o en <code>.env.local</code>) y vuelve a levantar la aplicación.
        </p>
      )}
    </section>
  );
}
