import "server-only";
import { fileUrl } from "@/lib/storage";
import { T, db, unwrap } from "@/lib/supabase";
import type { CatalogItem, Paged } from "@/lib/types";

/**
 * Los usuarios vistos desde el panel.
 *
 * `src/lib/users.ts` es lo que un profesor puede leer y escribir de sí mismo:
 * su nombre, su foto, su contraseña. Esto es otra cosa — todas las cuentas,
 * incluidas las borradas, con las columnas de estado que el sitio no muestra
 * (activa, verificada, forzada a cambiar la clave) y sin el supuesto de que
 * quien lee es el dueño de la fila. Por eso vive aparte y no como más
 * funciones del otro módulo.
 */

export const ADMIN_PAGE_SIZE = 25;

export type AdminUserListItem = {
  id: number;
  email: string;
  name: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  deletedAt: string | null;
  activityCount: number;
};

export type AdminUserDetail = {
  id: number;
  email: string;
  firstName: string;
  lastName: string | null;
  bio: string | null;
  isActive: boolean;
  isVerified: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  loginAttempts: number;
  deletedAt: string | null;
  avatarKey: string | null;
  avatarUrl: string | null;
  /** Lo que el `<img>` del panel puede mostrar: firmada si el bucket es privado. */
  avatarPreviewUrl: string | null;
  roleIds: number[];
  activityCount: number;
};

const LIST_COLUMNS =
  "id, email, first_name, last_name, is_active, must_change_password, created_at, last_login_at, deleted_at";

/** El nombre completo, o el correo cuando la cuenta no tiene ninguno. */
function displayName(row: { first_name: string | null; last_name: string | null; email: string }): string {
  return [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.email;
}

/**
 * Cuántas actividades vivas publicó cada uno de estos ids.
 *
 * Una consulta para toda la página en vez de una por fila. PostgREST no hace
 * `group by`, así que cuenta aquí: son como mucho 25 ids y sus actividades.
 */
async function activityCounts(userIds: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (userIds.length === 0) return counts;
  const rows = unwrap(
    await db()
      .from(T.activities)
      .select("user_id")
      .in("user_id", userIds)
      .is("deleted_at", null),
    "activity counts",
  ) as { user_id: number }[];
  for (const row of rows) counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  return counts;
}

/**
 * Le quita a un término lo que PostgREST leería como sintaxis. Una coma corta
 * la lista de un `or=` y un paréntesis cierra el grupo: sin esto, buscar
 * "Pérez, Ana" no devuelve nada raro — devuelve un error.
 */
function safeTerm(term: string): string {
  return term.replace(/[,()\\%*]/g, " ").trim();
}

export async function listUsers(options: {
  q?: string;
  page?: number;
  /** Por defecto las cuentas borradas no salen; el panel deja pedirlas. */
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
}): Promise<Paged<AdminUserListItem>> {
  const page = Math.max(1, options.page ?? 1);

  let query = db().from(T.users).select(LIST_COLUMNS, { count: "exact" });

  if (options.onlyDeleted) query = query.not("deleted_at", "is", null);
  else if (!options.includeDeleted) query = query.is("deleted_at", null);

  const term = safeTerm(options.q ?? "");
  if (term) {
    query = query.or(
      `email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`,
    );
  }

  const from = (page - 1) * ADMIN_PAGE_SIZE;
  const result = await query
    .order("id", { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1);
  if (result.error) throw new Error(`list users: ${result.error.message}`);

  const rows = (result.data ?? []) as {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
    is_active: boolean;
    must_change_password: boolean;
    created_at: string;
    last_login_at: string | null;
    deleted_at: string | null;
  }[];

  const counts = await activityCounts(rows.map((r) => r.id));

  return {
    items: rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: displayName(row),
      isActive: row.is_active,
      mustChangePassword: row.must_change_password,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
      deletedAt: row.deleted_at,
      activityCount: counts.get(row.id) ?? 0,
    })),
    total: result.count ?? rows.length,
    page,
    pageSize: ADMIN_PAGE_SIZE,
  };
}

export async function getAdminUser(id: number): Promise<AdminUserDetail | null> {
  if (!Number.isInteger(id) || id <= 0) return null;

  const { data, error } = await db()
    .from(T.users)
    .select(
      `id, email, first_name, last_name, bio, is_active, is_verified, must_change_password,
       created_at, last_login_at, login_attempts, deleted_at, avatar_key, avatar_url,
       roles:${T.userRoles} ( role_id )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`user ${id}: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
    bio: string | null;
    is_active: boolean;
    is_verified: boolean;
    must_change_password: boolean;
    created_at: string;
    last_login_at: string | null;
    login_attempts: number;
    deleted_at: string | null;
    avatar_key: string | null;
    avatar_url: string | null;
    roles: { role_id: number }[];
  };

  const counts = await activityCounts([row.id]);

  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name ?? "",
    lastName: row.last_name,
    bio: row.bio,
    isActive: row.is_active,
    isVerified: row.is_verified,
    mustChangePassword: row.must_change_password,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    loginAttempts: row.login_attempts ?? 0,
    deletedAt: row.deleted_at,
    avatarKey: row.avatar_key,
    avatarUrl: row.avatar_url,
    avatarPreviewUrl: await fileUrl({ key: row.avatar_key, url: row.avatar_url }),
    roleIds: row.roles.map((r) => r.role_id),
    activityCount: counts.get(row.id) ?? 0,
  };
}

/** Los roles del catálogo, para las casillas del formulario. */
export async function listRoles(): Promise<CatalogItem[]> {
  const rows = unwrap(
    await db().from(T.roles).select("id, name").is("deleted_at", null).order("id"),
    "roles",
  ) as { id: number; name: string }[];
  return rows.map((r) => ({ id: r.id, name: r.name.trim() }));
}

/** El id del usuario con ese correo, o null. Con él el panel resuelve el autor
 * de una actividad sin tener que ofrecer un desplegable de tres mil nombres. */
export async function findUserIdByEmail(email: string): Promise<number | null> {
  const { data, error } = await db()
    .from(T.users)
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`find user: ${error.message}`);
  return data ? (data as { id: number }).id : null;
}
