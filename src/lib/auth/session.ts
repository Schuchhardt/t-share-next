import "server-only";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifySession,
  type Session,
} from "@/lib/auth/token";

/**
 * The signed-in teacher, read from and written to the session cookie.
 *
 * This app does not use Supabase Auth — the service role key is the only
 * credential that reaches the database, so the session is established here
 * instead. The token format lives in `./token`, which the Edge middleware also
 * imports; this module adds the httpOnly cookie around it.
 */

export { SESSION_COOKIE, verifySession };
export type { Session };

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
} as const;

/**
 * The signed cookie, ready to hand to a `NextResponse`.
 *
 * Route handlers that answer with a redirect set it on the response itself
 * rather than through `cookies()`: the header and the Location then leave
 * together, with nothing relying on Next merging a mutated cookie store into
 * a response it did not build.
 */
export async function sessionCookie(session: Session) {
  return { name: SESSION_COOKIE, value: await signSession(session), ...COOKIE_OPTIONS };
}

export async function setSessionCookie(session: Session): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(session), COOKIE_OPTIONS);
}

/**
 * Signs the teacher out.
 *
 * It expires the cookie by writing it again with the same attributes rather
 * than calling `store.delete(name)`. `delete` sends no `Path`, so the browser
 * falls back to the path of the request — and "Salir" is pressed from
 * /actividades or /mi-perfil, never from "/". The expiry then landed on a
 * *different* cookie and the real one, at `Path=/`, stayed in the browser:
 * the page came back rendered as signed out, because the action had cleared
 * its own request's store, and the next navigation was signed in again.
 */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

/** The current session, or null when nobody is signed in. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/**
 * The current session, or a thrown error. For server actions a signed-out
 * visitor cannot reach anyway — the middleware redirects them first, so this
 * only fires on a race or a hand-crafted request.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("No hay sesión iniciada.");
  return session;
}
