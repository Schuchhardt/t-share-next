"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  checkPasswordStrength,
  hashPassword,
  isLegacyHash,
  verifyPassword,
} from "@/lib/auth/password";
import {
  clearSessionCookie,
  getSession,
  requireSession,
  setSessionCookie,
} from "@/lib/auth/session";
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

export type FormState = { error: string | null };

/** What every action returns when the form itself is wrong. */
function fail(message: string): FormState {
  return { error: message };
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
  next: z.string().optional(),
});

function displayName(account: AccountRow): string {
  return [account.first_name, account.last_name].filter(Boolean).join(" ").trim() || account.email;
}

/**
 * A redirect inside a server action throws a control-flow error that Next.js
 * catches, so it must happen outside the try/catch that turns failures into
 * form state.
 */
function safeNext(next: string | undefined): string {
  // Only same-origin paths, so a crafted ?next= cannot bounce a signed-in
  // teacher to another site.
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/actividades";
  return next;
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

  redirect("/actividades");
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Escribe tu contraseña actual."),
    password: z.string(),
    passwordConfirm: z.string(),
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
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos.");

  const account = await findAccountById(session.userId);
  if (!account) return fail("No encontramos tu cuenta.");

  if (!(await verifyPassword(parsed.data.currentPassword, account.password_hash))) {
    return fail("Tu contraseña actual no es correcta.");
  }

  const weak = checkPasswordStrength(parsed.data.password, account.email);
  if (weak) return fail(weak);

  if (await verifyPassword(parsed.data.password, account.password_hash)) {
    return fail("Elige una contraseña distinta de la anterior.");
  }

  await setPassword(session.userId, await hashPassword(parsed.data.password));
  await setSessionCookie({ ...session, mustChangePassword: false });

  redirect("/actividades");
}

export async function signOut(): Promise<void> {
  await clearSessionCookie();
  redirect("/");
}

/** Convenience for server components that only need to know who is here. */
export async function currentSession() {
  return getSession();
}
