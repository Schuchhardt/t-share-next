import bcrypt from "bcryptjs";

/**
 * Password hashing.
 *
 * The 2 986 migrated accounts carry the hash Laravel wrote, which uses the
 * `$2y$` bcrypt prefix. `$2y$` and `$2a$` describe the same algorithm — PHP
 * picked its own identifier back when a C implementation had a sign-extension
 * bug — so the stored hash verifies fine once the prefix is normalised, which
 * is what lets a teacher sign in with the password they already know.
 *
 * They only get to do that once: `tshare_users.must_change_password` is true
 * for every migrated row, so the first successful sign-in is followed by a
 * forced reset, and the new hash is written by this app at `COST` below.
 */

const COST = 12;

/** True for a hash written by the old PHP app rather than by this one. */
export function isLegacyHash(hash: string): boolean {
  return hash.startsWith("$2y$");
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  // bcryptjs recognises $2a$/$2b$/$2x$/$2y$, but normalising keeps the
  // behaviour explicit rather than relying on that.
  const normalised = hash.startsWith("$2y$") ? `$2a$${hash.slice(4)}` : hash;
  try {
    return await bcrypt.compare(password, normalised);
  } catch {
    // A truncated or non-bcrypt value in the column is a failed login, not a
    // 500.
    return false;
  }
}

export type PasswordProblem = string | null;

/**
 * The rule the change-password and sign-up forms share. Deliberately modest —
 * length does more for a teacher's account than a symbol quota does.
 */
export function checkPasswordStrength(password: string, email?: string): PasswordProblem {
  if (password.length < 10) return "La contraseña debe tener al menos 10 caracteres.";
  if (password.length > 200) return "La contraseña es demasiado larga.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Incluye al menos una letra y un número.";
  }
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length > 2 && password.toLowerCase().includes(local)) {
    return "La contraseña no puede contener tu correo.";
  }
  return null;
}
