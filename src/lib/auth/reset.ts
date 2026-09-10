import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { T, db } from "@/lib/supabase";

/**
 * Password-reset tokens, replacing Laravel's `password_resets` table.
 *
 * The row stores a SHA-256 of the token, never the token itself: the only
 * copy of the real value is the one in the teacher's inbox, so a leaked
 * database dump cannot be replayed into account takeovers. A plain hash is
 * enough here — unlike a password, the token is 256 bits of randomness, so
 * there is nothing to brute-force and nothing to salt.
 *
 * One hour, one use. Asking again invalidates whatever was sent before, so a
 * teacher who clicks "recuperar" twice is not left guessing which of the two
 * mails works.
 */

export const RESET_TTL_MINUTES = 60;

/** Hex SHA-256, which is what the `token_hash` column holds. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A URL-safe token with 256 bits of entropy. */
export function newResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Issues a token for the account and drops any earlier unused one.
 * Returns the clear-text token — the only moment it exists outside the email.
 */
export async function createPasswordReset(userId: number): Promise<string> {
  await db().from(T.passwordResets).delete().eq("user_id", userId).is("used_at", null);

  const token = newResetToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000).toISOString();

  const { error } = await db().from(T.passwordResets).insert({
    user_id: userId,
    token_hash: hashResetToken(token),
    expires_at: expiresAt,
  });
  if (error) throw new Error(`create password reset: ${error.message}`);

  return token;
}

export type ResetLookup =
  | { ok: true; userId: number; rowId: number }
  | { ok: false; reason: "unknown" | "used" | "expired" };

/**
 * Checks a token without spending it, so the "set a new password" screen can
 * tell a teacher the link is stale *before* they type a password into it.
 */
export async function findPasswordReset(token: string): Promise<ResetLookup> {
  if (!token || token.length > 200) return { ok: false, reason: "unknown" };

  const { data, error } = await db()
    .from(T.passwordResets)
    .select("id, user_id, expires_at, used_at, token_hash")
    .eq("token_hash", hashResetToken(token))
    .maybeSingle();
  if (error) throw new Error(`find password reset: ${error.message}`);
  if (!data) return { ok: false, reason: "unknown" };

  const row = data as {
    id: number;
    user_id: number;
    expires_at: string;
    used_at: string | null;
    token_hash: string;
  };

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

/** Marks the token spent. Called only after the new password is written. */
export async function markPasswordResetUsed(rowId: number): Promise<void> {
  const { error } = await db()
    .from(T.passwordResets)
    .update({ used_at: new Date().toISOString() })
    .eq("id", rowId);
  if (error) throw new Error(`consume password reset: ${error.message}`);
}
