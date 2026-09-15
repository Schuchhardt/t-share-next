import { ConfirmSubmit, Panel } from "@/components/admin/ui";

/**
 * Archivar, restaurar y eliminar, que son tres cosas distintas.
 *
 * *Archivar* marca `deleted_at`: la fila sigue ahí y el sitio deja de
 * mostrarla. Es lo que hace el sitio y lo que casi siempre se quiere decir.
 * *Eliminar* borra la fila de verdad, con todo lo que el esquema cascadea
 * detrás, y no tiene vuelta atrás — por eso el modal dice qué se lleva antes
 * de preguntar.
 *
 * Se llamaba "borrar", que a un botón de distancia de "eliminar" no decía cuál
 * de las dos era la que no tiene vuelta.
 *
 * Es un componente de servidor: las acciones no devuelven estado y van directo
 * al `action` del formulario. Lo único que viene del navegador es el modal que
 * abre `ConfirmSubmit` antes de enviarlo.
 */

export function DangerZone({
  id,
  deleted,
  what,
  cascade,
  onDelete,
  onRestore,
  onPurge,
}: {
  id: number;
  deleted: boolean;
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
          ? `${what} está archivada: no aparece en el sitio, pero sigue en la base.`
          : `Archivar la saca del sitio sin perder nada. Se puede restaurar.`
      }
    >
      <div className="grid gap-5">
        <form action={deleted ? onRestore : onDelete}>
          <input type="hidden" name="id" value={id} />
          <ConfirmSubmit
            tone="plain"
            question={
              deleted ? `¿Restaurar ${what.toLowerCase()}?` : `¿Archivar ${what.toLowerCase()}?`
            }
            detail={
              deleted
                ? "Vuelve a aparecer en el sitio."
                : "Sale del sitio pero sigue en la base: se puede restaurar."
            }
          >
            {deleted ? "Restaurar" : "Archivar"}
          </ConfirmSubmit>
        </form>

        <form action={onPurge} className="grid gap-2 border-t border-[#e2a19c] pt-4">
          <input type="hidden" name="id" value={id} />
          <p className="text-[13px] text-coral-ink">
            Eliminar definitivamente borra la fila y, con ella, {cascade}. No tiene vuelta atrás.
          </p>
          <div>
            <ConfirmSubmit
              question={`¿Eliminar ${what.toLowerCase()} definitivamente?`}
              detail={`Se borra la fila de la base, y con ella ${cascade}. No tiene vuelta atrás.`}
            >
              Eliminar definitivamente
            </ConfirmSubmit>
          </div>
        </form>
      </div>
    </Panel>
  );
}
