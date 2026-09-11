import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { T, db } from "@/lib/supabase";

/**
 * The one-use links this app mails out, replacing Laravel's `password_resets`
 * table. Two kinds live in it, told apart by the `purpose` column:
 *
 *  - `password_reset` — "¿Olvidaste tu contraseña?" opens /cambiar-clave.
 *  - `access_link` — the magic link offered after a second wrong password.
 *    It signs the teacher in and holds them on /cambiar-password.
 *
 * The row stores a SHA-256 of the token, never the token itself: the only
 * copy of the real value is the one in the teacher's inbox, so a leaked
 * database dump cannot be replayed into account takeovers. A plain hash is
 * enough here — unlike a password, the token is 256 bits of randomness, so
 * there is nothing to brute-force and nothing to salt.
 *
 * One use, and a purpose a link cannot leave: a reset token pasted into
 * /acceso is as unknown as a made-up string. Issuing one drops whatever
 * unused link of the same kind was outstanding, so a teacher who clicks
 * "recuperar" twice is not left guessing which of the two mails works.
 */

export const RESET_TTL_MINUTES = 60;
export const ACCESS_TTL_MINUTES = 30;

/** What a row is for. Stored in `tshare_password_resets.purpose`. */
export const PURPOSE = {
  reset: "password_reset",
  access: "access_link",
} as const;

export type Purpose = (typeof PURPOSE)[keyof typeof PURPOSE];

/** Hex SHA-256, which is what the `token_hash` column holds. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A URL-safe token with 256 bits of entropy. */
export function newResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Issues a token for the account and drops any earlier unused one of the same
 * kind. Returns the clear-text token — the only moment it exists outside the
 * email.
 */
async function createToken(
  userId: number,
  purpose: Purpose,
  ttlMinutes: number,
): Promise<string> {
  await db()
    .from(T.passwordResets)
    .delete()
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .is("used_at", null);

  const token = newResetToken();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();

  const { error } = await db().from(T.passwordResets).insert({
    user_id: userId,
    purpose,
    token_hash: hashResetToken(token),
    expires_at: expiresAt,
  });
  if (error) throw new Error(`create ${purpose}: ${error.message}`);

  return token;
}

export function createPasswordReset(userId: number): Promise<string> {
  return createToken(userId, PURPOSE.reset, RESET_TTL_MINUTES);
}

export function createAccessLink(userId: number): Promise<string> {
  return createToken(userId, PURPOSE.access, ACCESS_TTL_MINUTES);
}

export type ResetLookup =
  | { ok: true; userId: number; rowId: number }
  | { ok: false; reason: "unknown" | "used" | "expired" };

/**
 * Checks a token without spending it, so the "set a new password" screen can
 * tell a teacher the link is stale *before* they type a password into it.
 */
async function findToken(token: string, purpose: Purpose): Promise<ResetLookup> {
  if (!token || token.length > 200) return { ok: false, reason: "unknown" };

  const { data, error } = await db()
    .from(T.passwordResets)
    .select("id, user_id, expires_at, used_at, token_hash, purpose")
    .eq("token_hash", hashResetToken(token))
    .maybeSingle();
  if (error) throw new Error(`find ${purpose}: ${error.message}`);
  if (!data) return { ok: false, reason: "unknown" };

  const row = data as {
    id: number;
    user_id: number;
    expires_at: string;
    used_at: string | null;
    token_hash: string;
    // Rows written before the column existed are resets; the default in the
    // schema says the same thing, this covers a stub or an older dump.
    purpose?: string | null;
  };

  if ((row.purpose ?? PURPOSE.reset) !== purpose) return { ok: false, reason: "unknown" };

  // The lookup above already matched on the hash; comparing it again in
  // constant time keeps the equality check itself from leaking timing, which
  // matters once a database index is not the only thing answering.
  const given = Buffer.from(hashResetToken(token), "hex");
  const stored = Buffer.from(row.token_hash, "hex");
  if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
    return { ok: false, reason: "unknown" };
  }

  if (row.used_at) return { ok: false, reason: "used" };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { ok: false, reason: "expired" };

  return { ok: true, userId: row.user_id, rowId: row.id };
}

export function findPasswordReset(token: string): Promise<ResetLookup> {
  return findToken(token, PURPOSE.reset);
}

export function findAccessLink(token: string): Promise<ResetLookup> {
  return findToken(token, PURPOSE.access);
}

/**
 * True while an access link this app already mailed is still usable.
 *
 * It is what keeps a wrong password from turning into a mail flood: whoever
 * is at the keyboard can fail ten more times, and the inbox still holds one
 * link until it is used or ages out.
 */
export async function hasActiveAccessLink(userId: number): Promise<boolean> {
  const { count, error } = await db()
    .from(T.passwordResets)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("purpose", PURPOSE.access)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString());
  if (error) throw new Error(`check access link: ${error.message}`);
  return (count ?? 0) > 0;
}

/** Marks a link of either kind spent. Called only once it has done its job. */
export async function markTokenUsed(rowId: number): Promise<void> {
  const { error } = await db()
    .from(T.passwordResets)
    .update({ used_at: new Date().toISOString() })
    .eq("id", rowId);
  if (error) throw new Error(`consume token: ${error.message}`);
}
