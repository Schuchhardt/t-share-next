import { ConfirmSubmit, Panel } from "@/components/admin/ui";

/**
 * Borrar, restaurar y eliminar, que son tres cosas distintas.
 *
 * *Borrar* marca `deleted_at`: la fila sigue ahí y el sitio deja de mostrarla.
 * Es lo que hace el sitio y lo que casi siempre se quiere decir. *Eliminar*
 * borra la fila de verdad, con todo lo que el esquema cascadea detrás, y no
 * tiene vuelta atrás — por eso pide escribir algo a mano antes.
 *
 * Es un componente de servidor: las acciones no devuelven estado, van directo
 * al `action` del formulario, y lo único que necesita del navegador es el
 * `confirm()` del botón.
 */

export function DangerZone({
  id,
  deleted,
  /** Lo que hay que escribir para eliminar: el correo, o la palabra ELIMINAR. */
  confirmation,
  what,
  cascade,
  onDelete,
  onRestore,
  onPurge,
}: {
  id: number;
  deleted: boolean;
  confirmation: string;
  what: string;
  cascade: string;
  onDelete: (formData: FormData) => Promise<void>;
  onRestore: (formData: FormData) => Promise<void>;
  onPurge: (formData: FormData) => Promise<void>;
}) {
  return (
    <Panel
      tone="danger"
      title="Zona de riesgo"
      description={
        deleted
          ? `${what} está borrada: no aparece en el sitio, pero sigue en la base.`
          : `Borrar la saca del sitio sin perder nada. Se puede restaurar.`
      }
    >
      <div className="grid gap-5">
        <form action={deleted ? onRestore : onDelete}>
          <input type="hidden" name="id" value={id} />
          <ConfirmSubmit
            tone="plain"
            question={
              deleted
                ? `¿Restaurar ${what.toLowerCase()}?`
                : `¿Borrar ${what.toLowerCase()}? Se puede deshacer.`
            }
          >
            {deleted ? "Restaurar" : "Borrar"}
          </ConfirmSubmit>
        </form>

        <form action={onPurge} className="grid gap-2 border-t border-[#e2a19c] pt-4">
          <input type="hidden" name="id" value={id} />
          <p className="text-[13px] text-coral-ink">
            Eliminar definitivamente borra la fila y, con ella, {cascade}. No tiene vuelta atrás.
            Escribe <code className="font-bold">{confirmation}</code> para confirmar.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              name="confirm"
              placeholder={confirmation}
              autoComplete="off"
              className="rounded-sm border border-[#e2a19c] bg-white px-2 py-1.5 text-[13px]"
            />
            <ConfirmSubmit question={`Esto no se puede deshacer. ¿Eliminar ${what.toLowerCase()}?`}>
              Eliminar definitivamente
            </ConfirmSubmit>
          </div>
        </form>
      </div>
    </Panel>
  );
}
