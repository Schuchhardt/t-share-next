import { SignJWT, jwtVerify } from "jose";

/**
 * The session token itself, with no Node-only imports.
 *
 * `src/middleware.ts` runs in the Edge runtime, so it cannot pull in
 * `next/headers`, the Supabase client or bcrypt. Keeping the sign/verify pair
 * here lets the middleware check a session with nothing but a signature
 * check, while `src/lib/auth/session.ts` adds the cookie handling on top.
 */

export const SESSION_COOKIE = "tshare_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type Session = {
  userId: number;
  email: string;
  name: string;
  mustChangePassword: boolean;
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

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({
    email: session.email,
    name: session.name,
    mustChangePassword: session.mustChangePassword,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(session.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret());
}

/** Verifies a token. Returns null for anything expired, forged or malformed. */
export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    return {
      userId,
      email: typeof payload.email === "string" ? payload.email : "",
      name: typeof payload.name === "string" ? payload.name : "",
      mustChangePassword: payload.mustChangePassword === true,
    };
  } catch {
    return null;
  }
}
