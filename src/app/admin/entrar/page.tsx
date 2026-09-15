import { KeyForm } from "@/components/admin/key-form";
import { hasAdminConfig } from "@/lib/env";

/**
 * La puerta del panel: una llave, sin correo y sin cuenta.
 *
 * Es la única pantalla de /admin a la que el proxy deja llegar sin sesión, así
 * que es la única que ve cualquiera que pase por la URL. No nombra la variable
 * de entorno detrás de la llave ni dice que sea una: a quien administra el
 * sitio no le hace falta leerlo acá, y a cualquier otro le estaría diciendo
 * dónde buscar. Cuando no está configurada, la pantalla dice que el panel no
 * está disponible y nada más — que es también lo único que hace falta saber.
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
            Escribe la llave del panel. No es la contraseña de ninguna cuenta.
          </p>
          <KeyForm next={next} />
        </>
      ) : (
        <p className="rounded-sm bg-mint px-4 py-3 text-sm text-mint-strong">
          El panel no está disponible en este entorno.
        </p>
      )}
    </section>
  );
}
