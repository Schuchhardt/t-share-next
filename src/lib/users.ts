import "server-only";
import { T, db, unwrap } from "@/lib/supabase";
import { fileUrl } from "@/lib/storage";
import type { Profile } from "@/lib/types";

/**
 * Reading and writing the teacher's own record.
 *
 * Authentication lives here rather than in Supabase Auth: the migrated
 * accounts already have a bcrypt hash, and moving 2 986 of them into
 * `auth.users` would have meant either asking everyone to reset before they
 * could sign in once, or copying hashes into a table this app does not own.
 */

export type AccountRow = {
  id: number;
  email: string;
  first_name: string;
  last_name: string | null;
  password_hash: string;
  must_change_password: boolean;
  /** Failed sign-ins since the last successful one. See `recordFailedLogin`. */
  login_attempts: number;
  deleted_at: string | null;
};

const ACCOUNT_COLUMNS =
  "id, email, first_name, last_name, password_hash, must_change_password, login_attempts, deleted_at";

export async function findAccountByEmail(email: string): Promise<AccountRow | null> {
  const { data, error } = await db()
    .from(T.users)
    .select(ACCOUNT_COLUMNS)
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`find account: ${error.message}`);
  return (data as AccountRow | null) ?? null;
}

export async function findAccountById(id: number): Promise<AccountRow | null> {
  const { data, error } = await db()
    .from(T.users)
    .select(ACCOUNT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`find account: ${error.message}`);
  return (data as AccountRow | null) ?? null;
}

export async function emailExists(email: string): Promise<boolean> {
  const { count, error } = await db()
    .from(T.users)
    .select("id", { count: "exact", head: true })
    .eq("email", email.trim().toLowerCase());
  if (error) throw new Error(`email lookup: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function createAccount(input: {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
}): Promise<AccountRow> {
  const now = new Date().toISOString();
  const row = unwrap(
    await db()
      .from(T.users)
      .insert({
        email: input.email.trim().toLowerCase(),
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim() || null,
        password_hash: input.passwordHash,
        // Set by this app, so there is nothing to migrate off.
        must_change_password: false,
        is_active: true,
        email_verified_at: null,
        created_at: now,
        updated_at: now,
      })
      .select(ACCOUNT_COLUMNS)
      .single(),
    "create account",
  ) as AccountRow;
  return row;
}

/** Writes a new hash and clears the migration flag in one statement. */
export async function setPassword(userId: number, passwordHash: string): Promise<void> {
  const { error } = await db()
    .from(T.users)
    .update({
      password_hash: passwordHash,
      must_change_password: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw new Error(`set password: ${error.message}`);
}

/**
 * Writes what the "Editar perfil" screen owns. Only the keys handed in are
 * touched, so leaving the photo alone means not passing it — a teacher who
 * only renames themselves keeps the avatar they had.
 */
export async function updateProfile(
  userId: number,
  fields: {
    firstName: string;
    lastName: string | null;
    avatarKey?: string;
    avatarUrl?: string | null;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {
    first_name: fields.firstName,
    last_name: fields.lastName,
    updated_at: new Date().toISOString(),
  };
  if (fields.avatarKey !== undefined) {
    patch.avatar_key = fields.avatarKey;
    patch.avatar_url = fields.avatarUrl ?? null;
  }

  const { error } = await db().from(T.users).update(patch).eq("id", userId);
  if (error) throw new Error(`update profile: ${error.message}`);
}

/**
 * Counts a wrong password and reports the new total.
 *
 * Read-modify-write rather than an atomic increment, which PostgREST cannot
 * express without a stored function. Two failures racing could count as one;
 * the number only decides whether to offer an access link, so a lost count
 * costs a teacher one more attempt, not a lock-out. `recordLogin` puts it
 * back to zero on the next success.
 */
export async function recordFailedLogin(account: AccountRow): Promise<number> {
  const attempts = (account.login_attempts ?? 0) + 1;
  const { error } = await db()
    .from(T.users)
    .update({ login_attempts: attempts })
    .eq("id", account.id);
  // Bookkeeping: a failed write must not turn a wrong password into a 500.
  if (error) console.warn(`record failed login: ${error.message}`);
  return attempts;
}

export async function recordLogin(userId: number): Promise<void> {
  const { error } = await db()
    .from(T.users)
    .update({ last_login_at: new Date().toISOString(), login_attempts: 0 })
    .eq("id", userId);
  // A failed bookkeeping write should not fail the sign-in.
  if (error) console.warn(`record login: ${error.message}`);
}

type ProfileRow = {
  id: number;
  first_name: string;
  last_name: string | null;
  email: string;
  bio: string | null;
  avatar_key: string | null;
  avatar_url: string | null;
  roles: { role: { name: string } | null }[];
  subjects: { subject: { name: string } | null }[];
};

export async function getProfile(userId: number): Promise<Profile | null> {
  const { data, error } = await db()
    .from(T.users)
    .select(
      `id, first_name, last_name, email, bio, avatar_key, avatar_url,
       roles:${T.userRoles} ( role:${T.roles} ( name ) ),
       subjects:${T.userSubjects} ( subject:${T.subjects} ( name ) )`,
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`profile: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as ProfileRow;

  const [uploaded, saved, followers, downloads] = await Promise.all([
    db()
      .from(T.activities)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null),
    db().from(T.savedActivities).select("id", { count: "exact", head: true }).eq("user_id", userId),
    db().from(T.follows).select("id", { count: "exact", head: true }).eq("followed_id", userId),
    db().from(T.activityDownloads).select("quantity").eq("user_id", userId),
  ]);

  const downloadRows = (downloads.data ?? []) as { quantity: number }[];

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    bio: row.bio,
    avatarUrl: await fileUrl({ key: row.avatar_key, url: row.avatar_url }),
    roles: row.roles.map((r) => r.role?.name).filter((n): n is string => Boolean(n)),
    subjects: row.subjects.map((s) => s.subject?.name).filter((n): n is string => Boolean(n)),
    uploadedCount: uploaded.count ?? 0,
    savedCount: saved.count ?? 0,
    followerCount: followers.count ?? 0,
    downloadCount: downloadRows.reduce((sum, r) => sum + (r.quantity ?? 0), 0),
  };
}
