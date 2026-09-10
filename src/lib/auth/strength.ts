/**
 * The rule every screen that sets a password shares.
 *
 * Kept apart from `password.ts` on purpose: that module pulls in bcrypt, and
 * this one has to run in the browser too. The forms check it before they post,
 * so a password that cannot be accepted is rejected on the spot instead of
 * after a round trip — and the actions check it again, because a client-side
 * rule is a courtesy, not a guarantee.
 *
 * Deliberately modest: length does more for a teacher's account than a symbol
 * quota does.
 */

export type PasswordProblem = string | null;

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

/**
 * Everything the password half of a form can be wrong about, in the order a
 * teacher would want to hear it: is the new one acceptable, and did they type
 * it the same way twice.
 */
export function checkNewPassword(
  password: string,
  confirm: string,
  email?: string,
): PasswordProblem {
  if (!password) return "Escribe la contraseña nueva.";
  const weak = checkPasswordStrength(password, email);
  if (weak) return weak;
  if (password !== confirm) return "Las contraseñas no coinciden.";
  return null;
}
