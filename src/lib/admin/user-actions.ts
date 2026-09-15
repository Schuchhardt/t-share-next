"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/session";
import { done, failed, type AdminState } from "@/lib/admin/state";
import { hashPassword } from "@/lib/auth/password";
import { checkPasswordStrength } from "@/lib/auth/strength";
import { storedUrlFor } from "@/lib/storage";
import { T, db, unwrap } from "@/lib/supabase";

/**
 * El CRUD de usuarios del panel.
 *
 * Todo lo que hay aquí empieza por `requireAdmin()`. El proxy ya redirige a
 * quien no entró al panel, pero un server action se puede invocar con un POST
 * a mano desde cualquier parte: el proxy es comodidad, esta línea es la
 * autorización.
 *
 * Borrar es marcar `deleted_at`, no quitar la fila. Las actividades cuelgan de
 * su autor con `on delete cascade`, así que un borrado de verdad se lleva por
 * delante todo lo que esa persona publicó — y eso, en un repositorio que vive
 * de lo publicado, casi nunca es lo que se quiso decir. `purgeUser` existe
 * para cuando sí lo es, y avisa de lo que se lleva.
 */

const emailField = z
  .string()
  .trim()
  .min(1, "Escribe el correo.")
  .max(320)
  .email("Ese correo no parece válido.")
  .transform((value) => value.toLowerCase());

const userSchema = z.object({
  email: emailField,
  firstName: z.string().trim().min(1, "Escribe el nombre.").max(120),
  lastName: z.string().trim().max(120),
  bio: z.string().trim().max(2000),
  isActive: z.boolean(),
  mustChangePassword: z.boolean(),
});

/** Una casilla marcada llega como "on"; una desmarcada no llega. */
function checked(formData: FormData, name: string): boolean {
  return formData.get(name) !== null;
}

function roleIdsFrom(formData: FormData): number[] {
  return formData
    .getAll("roleIds")
    .map((value) => Number(value))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function fieldsFrom(formData: FormData) {
  return userSchema.safeParse({
    email: formData.get("email"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") ?? "",
    bio: formData.get("bio") ?? "",
    isActive: checked(formData, "isActive"),
    mustChangePassword: checked(formData, "mustChangePassword"),
  });
}

/** Reemplaza los roles de una cuenta por exactamente los que vinieron. */
async function setRoles(userId: number, roleIds: number[]): Promise<void> {
  const removed = await db().from(T.userRoles).delete().eq("user_id", userId);
  if (removed.error) throw new Error(`roles: ${removed.error.message}`);
  if (roleIds.length === 0) return;
  const added = await db()
    .from(T.userRoles)
    .insert(roleIds.map((role_id) => ({ user_id: userId, role_id })));
  if (added.error) throw new Error(`roles: ${added.error.message}`);
}

/** True cuando ese correo ya lo tiene otra cuenta (la columna es `citext`,
 * así que la comparación no depende de las mayúsculas). */
async function emailTaken(email: string, exceptId?: number): Promise<boolean> {
  let query = db().from(T.users).select("id", { count: "exact", head: true }).eq("email", email);
  if (exceptId) query = query.neq("id", exceptId);
  const { count, error } = await query;
  if (error) throw new Error(`email lookup: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function createUser(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();

  const parsed = fieldsFrom(formData);
  if (!parsed.success) return failed(parsed.error.issues[0]?.message ?? "Revisa el formulario.");

  const password = String(formData.get("password") ?? "");
  const weak = checkPasswordStrength(password, parsed.data.email);
  if (weak) return failed(weak);

  let userId: number;
  try {
    if (await emailTaken(parsed.data.email)) return failed("Ya hay una cuenta con ese correo.");

    const now = new Date().toISOString();
    const created = unwrap(
      await db()
        .from(T.users)
        .insert({
          email: parsed.data.email,
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName || null,
          bio: parsed.data.bio || null,
          password_hash: await hashPassword(password),
          must_change_password: parsed.data.mustChangePassword,
          is_active: parsed.data.isActive,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single(),
      "create user",
    ) as { id: number };
    userId = created.id;

    await setRoles(userId, roleIdsFrom(formData));
  } catch (err) {
    return failed(err instanceof Error ? err.message : "No pudimos crear la cuenta.");
  }

  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios/${userId}?creada=1`);
}

export async function updateUser(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();

  const userId = Number(formData.get("id"));
  if (!Number.isInteger(userId) || userId <= 0) return failed("Usuario inválido.");

  const parsed = fieldsFrom(formData);
  if (!parsed.success) return failed(parsed.error.issues[0]?.message ?? "Revisa el formulario.");

  // Opcional: en blanco significa "no la toques".
  const password = String(formData.get("password") ?? "");
  if (password) {
    const weak = checkPasswordStrength(password, parsed.data.email);
    if (weak) return failed(weak);
  }

  // La foto ya está en el bucket — la subió `/api/admin/subidas` antes de que
  // se enviara el formulario. Aquí sólo viaja su clave.
  const avatarKey = String(formData.get("avatarKey") ?? "").trim();
  const removeAvatar = checked(formData, "removeAvatar");

  try {
    if (await emailTaken(parsed.data.email, userId)) {
      return failed("Ese correo ya lo tiene otra cuenta.");
    }

    const patch: Record<string, unknown> = {
      email: parsed.data.email,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName || null,
      bio: parsed.data.bio || null,
      is_active: parsed.data.isActive,
      must_change_password: parsed.data.mustChangePassword,
      updated_at: new Date().toISOString(),
    };
    if (password) {
      patch.password_hash = await hashPassword(password);
      // Una clave puesta desde el panel es provisional por definición: la sabe
      // alguien que no es el dueño de la cuenta.
      patch.must_change_password = true;
      patch.login_attempts = 0;
    }
    if (removeAvatar) {
      patch.avatar_key = null;
      patch.avatar_url = null;
    } else if (avatarKey) {
      patch.avatar_key = avatarKey;
      patch.avatar_url = storedUrlFor(avatarKey);
    }

    const { error } = await db().from(T.users).update(patch).eq("id", userId);
    if (error) throw new Error(error.message);

    await setRoles(userId, roleIdsFrom(formData));
  } catch (err) {
    return failed(err instanceof Error ? err.message : "No pudimos guardar los cambios.");
  }

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${userId}`);
  revalidatePath("/mi-perfil");
  return done(password ? "Listo. La contraseña quedó cambiada." : "Listo, la cuenta quedó guardada.");
}

/** Marca la cuenta como borrada. Sus actividades siguen en pie. */
export async function deleteUser(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = Number(formData.get("id"));
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("Usuario inválido.");

  const { error } = await db()
    .from(T.users)
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", userId);
  if (error) throw new Error(`delete user: ${error.message}`);

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${userId}`);
  redirect(`/admin/usuarios/${userId}?estado=borrada`);
}

export async function restoreUser(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = Number(formData.get("id"));
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("Usuario inválido.");

  const { error } = await db()
    .from(T.users)
    .update({ deleted_at: null, is_active: true })
    .eq("id", userId);
  if (error) throw new Error(`restore user: ${error.message}`);

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${userId}`);
  redirect(`/admin/usuarios/${userId}?estado=restaurada`);
}

/**
 * Borra la fila de verdad, con todo lo que cuelga de ella.
 *
 * El esquema cascadea desde `tshare_users`: las actividades de esa persona,
 * sus comentarios, sus guardados y sus descargas se van con ella. Por eso el
 * formulario pide escribir el correo entero antes de dejar apretar el botón, y
 * por eso esto lo comprueba otra vez.
 */
export async function purgeUser(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = Number(formData.get("id"));
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("Usuario inválido.");

  const confirmation = String(formData.get("confirm") ?? "").trim().toLowerCase();
  const { data, error: readError } = await db()
    .from(T.users)
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (readError) throw new Error(`purge user: ${readError.message}`);
  if (!data) throw new Error("Esa cuenta ya no existe.");

  if (confirmation !== (data as { email: string }).email.toLowerCase()) {
    redirect(`/admin/usuarios/${userId}?estado=confirmacion`);
  }

  const { error } = await db().from(T.users).delete().eq("id", userId);
  if (error) throw new Error(`purge user: ${error.message}`);

  revalidatePath("/admin/usuarios");
  revalidatePath("/actividades");
  redirect("/admin/usuarios?estado=eliminada");
}
