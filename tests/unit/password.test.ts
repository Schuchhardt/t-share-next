import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import {
  checkPasswordStrength,
  hashPassword,
  isLegacyHash,
  verifyPassword,
} from "@/lib/auth/password";

/**
 * The migration hinges on this file: 2 986 accounts carry a hash written by
 * PHP's `password_hash`, which stamps `$2y$` rather than `$2a$`. If those stop
 * verifying, every migrated teacher is locked out.
 */

/** PHP writes the same bcrypt digest under a different prefix. */
async function laravelStyleHash(password: string): Promise<string> {
  const hash = await bcrypt.hash(password, 10);
  return `$2y$${hash.slice(4)}`;
}

describe("legacy Laravel hashes", () => {
  it("verifies a $2y$ hash", async () => {
    const hash = await laravelStyleHash("clave-de-la-profe");
    expect(hash.startsWith("$2y$")).toBe(true);
    expect(await verifyPassword("clave-de-la-profe", hash)).toBe(true);
  });

  it("rejects the wrong password against a $2y$ hash", async () => {
    const hash = await laravelStyleHash("clave-de-la-profe");
    expect(await verifyPassword("otra-clave", hash)).toBe(false);
  });

  it("recognises which hashes still need migrating", async () => {
    expect(isLegacyHash(await laravelStyleHash("x"))).toBe(true);
    expect(isLegacyHash(await hashPassword("una-clave-larga-1"))).toBe(false);
  });

  it("verifies a hash this app wrote", async () => {
    const hash = await hashPassword("una-clave-larga-1");
    expect(await verifyPassword("una-clave-larga-1", hash)).toBe(true);
    expect(await verifyPassword("una-clave-larga-2", hash)).toBe(false);
  });

  it("treats a missing or malformed hash as a failed login, not a crash", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });
});

describe("password rules", () => {
  it("accepts a reasonable password", () => {
    expect(checkPasswordStrength("laclase2026", "profe@colegio.cl")).toBeNull();
  });

  it("rejects short passwords", () => {
    expect(checkPasswordStrength("corta1")).toMatch(/10 caracteres/);
  });

  it("requires both a letter and a number", () => {
    expect(checkPasswordStrength("solamenteletras")).toMatch(/letra y un número/);
    expect(checkPasswordStrength("1234567890")).toMatch(/letra y un número/);
  });

  it("rejects a password built from the address", () => {
    expect(checkPasswordStrength("sebastian2026", "sebastian@t-share.org")).toMatch(/tu correo/);
  });

  it("rejects an absurdly long password rather than hashing it", () => {
    expect(checkPasswordStrength(`a1${"x".repeat(300)}`)).toMatch(/demasiado larga/);
  });
});
