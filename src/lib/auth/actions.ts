"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { hashPassword, isLegacyHash, verifyPassword } from "@/lib/auth/password";
import { safeNext } from "@/lib/auth/next-path";
import { checkPasswordStrength } from "@/lib/auth/strength";
import {
  createPasswordReset,
  findPasswordReset,
  markPasswordResetUsed,
} from "@/lib/auth/reset";
import {
  clearSessionCookie,
  getSession,
  requireSession,
  setSessionCookie,
} from "@/lib/auth/session";
import { notifyPasswordReset, notifyWelcome } from "@/lib/notifications";
import {
  createAccount,
  emailExists,
  findAccountByEmail,
  findAccountById,
  recordLogin,
  setPassword,
  type AccountRow,
} from "@/lib/users";

/**
 * Sign-in, sign-up and the forced password change.
 *
 * The migration story lives in `signIn` below: a teacher signs in with the
 * password they had on the old site, the Laravel `$2y$` hash verifies, and the
 * session is created — but `mustChangePassword` rides along on it, so the
 * middleware sends them straight to /cambiar-password and keeps them there
 * until this app has written its own hash.
 */

export type FormState = {
  error: string | null;
  /** A confirmation to show in place of an error, e.g. "revisa tu correo". */
  notice?: string | null;
};

/** What every action returns when the form itself is wrong. */
function fail(message: string): FormState {
  return { error: message };
}

/** What an action returns when it worked but stays on the same screen. */
function done(message: string): FormState {
  return { error: null, notice: message };
}

const emailField = z
  .string()
  .trim()
  .min(1, "Escribe tu correo.")
  .max(320)
  .email("Ese correo no parece válido.");

const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Escribe tu contraseña."),
  next: z.string().nullish(),
});

function displayName(account: AccountRow): string {
  return [account.first_name, account.last_name].filter(Boolean).join(" ").trim() || account.email;
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos.");

  const { email, password } = parsed.data;
  const account = await findAccountByEmail(email);

  // One message for "no such account" and "wrong password", so the form does
  // not become a way to discover which addresses are registered.
  const invalid = fail("Correo o contraseña incorrectos.");
  if (!account || account.deleted_at) return invalid;
  if (!(await verifyPassword(password, account.password_hash))) return invalid;

  // A hash this app wrote means the account is already migrated, whatever the
  // column says.
  const mustChange = account.must_change_password || isLegacyHash(account.password_hash);

  await setSessionCookie({
    userId: account.id,
    email: account.email,
    name: displayName(account),
    mustChangePassword: mustChange,
  });
  await recordLogin(account.id);

  redirect(mustChange ? "/cambiar-password" : safeNext(parsed.data.next));
}

const signUpSchema = z
  .object({
    firstName: z.string().trim().min(1, "Escribe tu nombre.").max(120),
    lastName: z.string().trim().max(120).default(""),
    email: emailField,
    password: z.string(),
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: "Las contraseñas no coinciden.",
    path: ["passwordConfirm"],
  });

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") ?? "",
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos.");

  const { firstName, lastName, email, password } = parsed.data;

  const weak = checkPasswordStrength(password, email);
  if (weak) return fail(weak);

  if (await emailExists(email)) {
    return fail("Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.");
  }

  const account = await createAccount({
    email,
    firstName,
    lastName,
    passwordHash: await hashPassword(password),
  });

  await setSessionCookie({
    userId: account.id,
    email: account.email,
    name: displayName(account),
    mustChangePassword: false,
  });

  // The old app sent this from `UserController@store`. `after` keeps SendGrid
  // off the critical path — it still runs when the redirect below throws.
  after(() => notifyWelcome({ email: account.email, name: firstName }));

  redirect("/actividades");
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Escribe tu contraseña actual."),
    password: z.string(),
    // `formData.get` answers null for a field the form does not have, and the
    // forced screen has no `next`. Optional alone would reject that null.
    passwordConfirm: z.string(),
    next: z.string().nullish(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: "Las contraseñas no coinciden.",
    path: ["passwordConfirm"],
  });

/**
 * The screen every migrated account passes through once. It asks for the old
 * password again so a borrowed session cannot silently take over the account.
 */
export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
    next: formData.get("next"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos.");

  const account = await findAccountById(session.userId);
  if (!account) return fail("No encontramos tu cuenta.");

  // The new password is judged first, and deliberately so. This screen asks a
  // teacher to *choose* something; if the choice is unusable, saying "tu
  // contraseña actual no es correcta" points at the wrong field and hides the
  // real problem — which is exactly what happens when the old password was
  // mistyped or filled in by a password manager. The rule leaks nothing: it is
  // the same one the form already applies in the browser.
  const weak = checkPasswordStrength(parsed.data.password, account.email);
  if (weak) return fail(weak);

  if (!(await verifyPassword(parsed.data.currentPassword, account.password_hash))) {
    return fail("Tu contraseña actual no es correcta.");
  }

  if (await verifyPassword(parsed.data.password, account.password_hash)) {
    return fail("Elige una contraseña distinta de la anterior.");
  }

  await setPassword(session.userId, await hashPassword(parsed.data.password));
  await setSessionCookie({ ...session, mustChangePassword: false });

  // The forced screen sends everyone to the repository; the profile sends them
  // back to the profile. `safeNext` keeps a crafted value same-origin.
  redirect(safeNext(parsed.data.next));
}

// ---------------------------------------------------------------------------
// Recuperación de contraseña
// ---------------------------------------------------------------------------

/**
 * Always the same answer, whether or not the address is registered — the form
 * is public, so a different message for "no such account" would turn it into a
 * way to test which teachers have an account here.
 */
const RESET_SENT =
  "Si existe una cuenta con ese correo, te enviamos un enlace para cambiar la contraseña. Revisa también la carpeta de spam.";

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = z.object({ email: emailField }).safeParse({ email: formData.get("email") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa tu correo.");

  const account = await findAccountByEmail(parsed.data.email);
  if (account && !account.deleted_at) {
    const token = await createPasswordReset(account.id);
    await notifyPasswordReset(
      { email: account.email, name: account.first_name || displayName(account) },
      token,
    );
  }

  return done(RESET_SENT);
}

const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string(),
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: "Las contraseñas no coinciden.",
    path: ["passwordConfirm"],
  });

/**
 * Sets the new password from an emailed link. The token is spent only once the
 * hash is written, so a failure halfway through leaves the link usable.
 *
 * Nobody is signed in here, and this deliberately does not sign them in: the
 * teacher lands on /entrar and proves the new password works.
 */
export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos.");

  const lookup = await findPasswordReset(parsed.data.token);
  if (!lookup.ok) {
    return fail(
      lookup.reason === "used"
        ? "Ese enlace ya se usó. Pide uno nuevo desde “¿Olvidaste tu contraseña?”."
        : lookup.reason === "expired"
          ? "Ese enlace venció. Pide uno nuevo desde “¿Olvidaste tu contraseña?”."
          : "Ese enlace no es válido. Pide uno nuevo desde “¿Olvidaste tu contraseña?”.",
    );
  }

  const account = await findAccountById(lookup.userId);
  if (!account || account.deleted_at) return fail("No encontramos tu cuenta.");

  const weak = checkPasswordStrength(parsed.data.password, account.email);
  if (weak) return fail(weak);

  await setPassword(account.id, await hashPassword(parsed.data.password));
  await markPasswordResetUsed(lookup.rowId);

  redirect("/entrar?password=cambiada");
}

export async function signOut(): Promise<void> {
  await clearSessionCookie();
  redirect("/");
}

/** Convenience for server components that only need to know who is here. */
export async function currentSession() {
  return getSession();
}
