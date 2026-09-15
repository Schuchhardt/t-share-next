"use client";

import { useActionState } from "react";
import { BucketUpload } from "@/components/admin/bucket-upload";
import { Checkbox, Field, Messages, Panel, Submit, TextArea } from "@/components/admin/ui";
import { createUser, updateUser } from "@/lib/admin/user-actions";
import type { AdminState } from "@/lib/admin/state";
import type { AdminUserDetail } from "@/lib/admin/users";
import type { CatalogItem } from "@/lib/types";

/**
 * El formulario de una cuenta, que sirve para crearla y para editarla.
 *
 * Es el mismo formulario porque son los mismos campos; lo único que cambia es
 * la acción y si la contraseña es obligatoria. Separarlos habría significado
 * mantener dos veces la lista de casillas de roles.
 */

const EMPTY: AdminState = { error: null, notice: null };

export function UserForm({
  user,
  roles,
}: {
  /** null cuando es una cuenta nueva. */
  user: AdminUserDetail | null;
  roles: CatalogItem[];
}) {
  const [state, formAction] = useActionState(user ? updateUser : createUser, EMPTY);

  return (
    <form action={formAction} className="grid gap-5">
      {user && <input type="hidden" name="id" value={user.id} />}

      <Panel title="Datos de la cuenta">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="email"
            label="Correo"
            type="email"
            required
            defaultValue={user?.email}
            autoComplete="off"
          />
          <Field
            name="password"
            label={user ? "Contraseña nueva" : "Contraseña"}
            type="password"
            required={!user}
            autoComplete="new-password"
            hint={
              user
                ? "En blanco no la toca. Si la escribes, la cuenta queda obligada a cambiarla al entrar."
                : "Al menos 10 caracteres, con una letra y un número."
            }
          />
          <Field name="firstName" label="Nombre" required defaultValue={user?.firstName} />
          <Field name="lastName" label="Apellido" defaultValue={user?.lastName} />
        </div>

        <div className="mt-4 grid gap-4">
          <TextArea name="bio" label="Descripción" rows={3} defaultValue={user?.bio} />

          <div className="grid gap-2">
            <Checkbox
              name="isActive"
              label="Cuenta activa"
              defaultChecked={user ? user.isActive : true}
            />
            <Checkbox
              name="mustChangePassword"
              label="Obligar a cambiar la contraseña al entrar"
              defaultChecked={user?.mustChangePassword ?? false}
            />
          </div>
        </div>
      </Panel>

      {roles.length > 0 && (
        <Panel title="Roles" description="Lo que el perfil muestra bajo el nombre.">
          <div className="grid gap-2 sm:grid-cols-3">
            {roles.map((role) => (
              <Checkbox
                key={role.id}
                name="roleIds"
                value={role.id}
                label={role.name}
                defaultChecked={user?.roleIds.includes(role.id) ?? false}
              />
            ))}
          </div>
        </Panel>
      )}

      {user && (
        <Panel title="Foto de perfil">
          <BucketUpload
            name="avatarKey"
            prefix="users/avatars"
            label="Imagen"
            accept="image/*"
            currentKey={user.avatarKey}
            previewUrl={user.avatarPreviewUrl}
            removeName="removeAvatar"
          />
        </Panel>
      )}

      <Messages error={state.error} notice={state.notice} />

      <div>
        <Submit pendingLabel={user ? "Guardando…" : "Creando…"}>
          {user ? "Guardar cambios" : "Crear cuenta"}
        </Submit>
      </div>
    </form>
  );
}
