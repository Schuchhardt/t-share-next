import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Direct access to Supabase from the test process.
 *
 * The links this app mails are the one thing a browser cannot reach on its
 * own: the table stores only a SHA-256, so the clear-text token exists just
 * inside the email. Rather than read a mailbox, these helpers do the two
 * halves separately — check that asking for a link *wrote a row of the right
 * kind*, and plant a row whose token the test already knows so it can open
 * /cambiar-clave and /acceso for real.
 *
 * `playwright.config.ts` loads .env.local before this module is imported.
 */

const TABLE = "tshare_password_resets";

let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  cached ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return cached;
}

export type Purpose = "password_reset" | "access_link";

/** The same digest `src/lib/auth/reset.ts` stores. */
export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Every link outstanding for an account, newest first. */
export async function linksFor(userId: number, purpose?: Purpose) {
  let query = db().from(TABLE).select("id, purpose, used_at, expires_at").eq("user_id", userId);
  if (purpose) query = query.eq("purpose", purpose);
  const { data, error } = await query.order("id", { ascending: false });
  if (error) throw new Error(`read links: ${error.message}`);
  return (data ?? []) as { id: number; purpose: string; used_at: string | null; expires_at: string }[];
}

/**
 * Plants a link and hands back the clear-text token — what the teacher would
 * have received. `minutesValid` goes negative to age one out.
 */
export async function plantLink(
  userId: number,
  purpose: Purpose,
  minutesValid = 30,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const { error } = await db()
    .from(TABLE)
    .insert({
      user_id: userId,
      purpose,
      token_hash: tokenHash(token),
      expires_at: new Date(Date.now() + minutesValid * 60_000).toISOString(),
    });
  if (error) throw new Error(`plant ${purpose}: ${error.message}`);
  return token;
}

/** Clears the slate, so a test can assert on what it alone caused. */
export async function clearLinks(userId: number): Promise<void> {
  const { error } = await db().from(TABLE).delete().eq("user_id", userId);
  if (error) throw new Error(`clear links: ${error.message}`);
}

/** Puts the wrong-password counter back, since it survives between tests. */
export async function resetLoginAttempts(userId: number): Promise<void> {
  const { error } = await db().from("tshare_users").update({ login_attempts: 0 }).eq("id", userId);
  if (error) throw new Error(`reset attempts: ${error.message}`);
}

/** Restores the password a fixture is seeded with, after a test changes it. */
export async function restorePassword(userId: number, hash: string): Promise<void> {
  const { error } = await db()
    .from("tshare_users")
    .update({ password_hash: hash, must_change_password: false })
    .eq("id", userId);
  if (error) throw new Error(`restore password: ${error.message}`);
}

export async function passwordHashOf(userId: number): Promise<string> {
  const { data, error } = await db()
    .from("tshare_users")
    .select("password_hash")
    .eq("id", userId)
    .single();
  if (error) throw new Error(`read hash: ${error.message}`);
  return (data as { password_hash: string }).password_hash;
}
