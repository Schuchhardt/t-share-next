import Link from "next/link";
import { UserForm } from "@/components/admin/user-form";
import { listRoles } from "@/lib/admin/users";

export const metadata = { title: "Crear cuenta" };

/**
 * Una cuenta creada a mano.
 *
 * Nace sin `must_change_password` a menos que se marque: la contraseña la
 * eligió quien la está creando, no la migración, así que forzar el cambio es
 * una decisión y no el valor por defecto.
 */
export default async function AdminNuevoUsuarioPage() {
  const roles = await listRoles();

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/usuarios">← Usuarios</Link>
      </p>
      <h1 className="mb-6 text-[26px] font-bold text-ink">Crear cuenta</h1>

      <UserForm user={null} roles={roles} />
    </>
  );
}
