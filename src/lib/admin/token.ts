import { SignJWT, jwtVerify } from "jose";

/**
 * La sesión del panel de administración, sin nada que solo exista en Node.
 *
 * `src/proxy.ts` tiene que poder decir si alguien es admin antes de que se
 * renderice una página, así que verificar un token no puede costar más que una
 * firma: ni Supabase, ni bcrypt, ni `next/headers`. La cookie se pone en
 * `./session`, que sí es de servidor.
 *
 * No hay cuenta detrás de esta sesión. La única credencial es `ADMIN_KEY`, y
 * por eso el token lleva su huella: cambiar la variable de entorno invalida en
 * el acto todas las sesiones abiertas, que es la forma de echar a alguien sin
 * tener a quién echar.
 */

export const ADMIN_COOKIE = "tshare_admin";

/**
 * Ocho horas: una jornada. Es una llave compartida y sin dueño, así que dura
 * bastante menos que los treinta días de la sesión de un profesor.
 */
export const ADMIN_MAX_AGE_SECONDS = 60 * 60 * 8;

/** Lo que distingue este token del de un profesor y del de una subida. */
const ADMIN_SUBJECT = "admin";

export type AdminSession = {
  /** La huella de la llave con la que se entró. */
  fingerprint: string;
};

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error(
      "SESSION_SECRET is not set. Generate one with `openssl rand -base64 32` and put it in .env.local.",
    );
  }
  return new TextEncoder().encode(value);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Los primeros 16 hex del SHA-256 de la llave. Identifica, no revela. */
export async function adminKeyFingerprint(key: string): Promise<string> {
  return (await sha256Hex(key)).slice(0, 16);
}

/**
 * Compara dos llaves sin que el tiempo que tarda diga cuánto se parecen.
 *
 * Compara los digests y no las llaves: tienen siempre el mismo largo, así que
 * el recorrido no depende de lo que escribió quien está intentando entrar —
 * ni siquiera de cuántos caracteres escribió.
 */
export async function sameKey(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256Hex(given), sha256Hex(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signAdminToken(fingerprint: string): Promise<string> {
  return new SignJWT({ fingerprint })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(ADMIN_SUBJECT)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_MAX_AGE_SECONDS}s`)
    .sign(secret());
}

/**
 * La sesión de admin, o null.
 *
 * Null cuando el token está vencido, falsificado o malformado; cuando es el
 * token de otra cosa — el de un profesor lleva su id en `sub`, el de una
 * subida también, y ninguno dice "admin"; cuando `ADMIN_KEY` no está puesta,
 * porque entonces el panel no existe en este entorno; y cuando la llave
 * cambió desde que se entró.
 */
export async function verifyAdminToken(token: string | undefined): Promise<AdminSession | null> {
  const key = process.env.ADMIN_KEY?.trim();
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
      subject: ADMIN_SUBJECT,
    });
    const fingerprint = typeof payload.fingerprint === "string" ? payload.fingerprint : "";
    if (!fingerprint || fingerprint !== (await adminKeyFingerprint(key))) return null;
    return { fingerprint };
  } catch {
    return null;
  }
}
