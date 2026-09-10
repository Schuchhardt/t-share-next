import { beforeAll, describe, expect, it } from "vitest";
import { signSession, verifySession, type Session } from "@/lib/auth/token";

/**
 * The session cookie is the only thing standing between a visitor and another
 * teacher's account, and the proxy trusts `mustChangePassword` from it to keep
 * migrated accounts on the reset screen.
 */

const session: Session = {
  userId: 2296,
  email: "angela@example.cl",
  name: "Angela Palma",
  mustChangePassword: true,
};

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
});

describe("session tokens", () => {
  it("round-trips a session", async () => {
    expect(await verifySession(await signSession(session))).toEqual(session);
  });

  it("carries the forced-reset flag, which the proxy relies on", async () => {
    const relaxed = await verifySession(
      await signSession({ ...session, mustChangePassword: false }),
    );
    expect(relaxed?.mustChangePassword).toBe(false);
  });

  it("rejects a tampered token", async () => {
    const token = await signSession(session);
    const [header, payload, signature] = token.split(".");
    // Re-sign nothing: flip a byte of the payload and keep the old signature.
    const forged = `${header}.${payload!.slice(0, -2)}XY.${signature}`;
    expect(await verifySession(forged)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSession(session);
    process.env.SESSION_SECRET = "a-completely-different-secret-value-99";
    expect(await verifySession(token)).toBeNull();
    process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
  });

  it("treats an absent or unparsable cookie as signed out", async () => {
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession("")).toBeNull();
    expect(await verifySession("garbage")).toBeNull();
  });
});
