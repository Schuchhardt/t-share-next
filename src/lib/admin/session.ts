import "server-only";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  ADMIN_MAX_AGE_SECONDS,
  adminKeyFingerprint,
  signAdminToken,
  verifyAdminToken,
  type AdminSession,
} from "@/lib/admin/token";
import { env } from "@/lib/env";

/**
 * La cookie del panel, alrededor del token de `./token`.
 *
 * Es una cookie distinta de la del profesor (`tshare_session`) a propósito: un
 * admin no es un profesor con más permisos, y mezclarlas significaría que
 * entrar al panel afecta lo que ve el sitio, o peor, que salir del sitio deja
 * el panel abierto.
 */

export { ADMIN_COOKIE };
export type { AdminSession };

const COOKIE_OPTIONS = {
  httpOnly: true,
  // `strict` y no `lax`: al panel se llega escribiendo la URL o desde el propio
  // panel, nunca desde un enlace de fuera, así que no hay nada que perder y sí
  // algo que ganar — un POST cross-site a un server action llega sin cookie.
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: ADMIN_MAX_AGE_SECONDS,
} as const;

export async function setAdminCookie(): Promise<void> {
  const key = env.adminKey;
  if (!key) throw new Error("ADMIN_KEY no está configurada.");
  const store = await cookies();
  store.set(ADMIN_COOKIE, await signAdminToken(await adminKeyFingerprint(key)), COOKIE_OPTIONS);
}

/** Cierra la sesión del panel. Vence la cookie con los mismos atributos con
 * los que se escribió — borrarla por nombre manda un `Path` distinto y deja
 * viva la de verdad. */
export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

/** La sesión de admin, o null cuando nadie entró. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE)?.value);
}

/**
 * La sesión de admin, o un error.
 *
 * Lo llama cada server action y cada ruta del panel. El proxy ya redirige a
 * quien no entró, pero un server action se puede invocar con un POST a mano:
 * el proxy es comodidad, esto es la autorización.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error("No hay sesión de administración.");
  return session;
}
