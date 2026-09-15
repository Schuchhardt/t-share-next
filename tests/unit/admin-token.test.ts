import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  adminKeyFingerprint,
  sameKey,
  signAdminToken,
  verifyAdminToken,
} from "@/lib/admin/token";
import { signSession } from "@/lib/auth/token";
import { signUploadTicket } from "@/lib/upload-ticket";

/**
 * La sesión del panel es lo único que separa `/admin` del resto de internet,
 * así que lo que se prueba aquí es que no la abra nada que no sea la llave:
 * ni el token de un profesor, ni el de una subida, ni la llave de ayer.
 */

const KEY = "llave-de-prueba-llave-de-prueba-0001";

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
  process.env.ADMIN_KEY = KEY;
});

afterEach(() => {
  delete process.env.ADMIN_KEY;
});

describe("sameKey", () => {
  it("acepta la llave exacta", async () => {
    expect(await sameKey(KEY, KEY)).toBe(true);
  });

  it("rechaza una llave parecida y una vacía", async () => {
    expect(await sameKey(`${KEY} `, KEY)).toBe(false);
    expect(await sameKey(KEY.toUpperCase(), KEY)).toBe(false);
    expect(await sameKey("", KEY)).toBe(false);
  });
});

describe("sesión del panel", () => {
  it("acepta el token que firmó con la llave vigente", async () => {
    const token = await signAdminToken(await adminKeyFingerprint(KEY));
    expect(await verifyAdminToken(token)).toEqual({
      fingerprint: await adminKeyFingerprint(KEY),
    });
  });

  it("caduca las sesiones abiertas cuando cambia ADMIN_KEY", async () => {
    const token = await signAdminToken(await adminKeyFingerprint(KEY));
    process.env.ADMIN_KEY = "otra-llave-otra-llave-otra-llave-0002";
    expect(await verifyAdminToken(token)).toBeNull();
  });

  it("no vale nada sin ADMIN_KEY en el entorno", async () => {
    const token = await signAdminToken(await adminKeyFingerprint(KEY));
    delete process.env.ADMIN_KEY;
    expect(await verifyAdminToken(token)).toBeNull();
  });

  it("no acepta la sesión de un profesor", async () => {
    const teacher = await signSession({
      userId: 2296,
      email: "profe@example.com",
      name: "Profe",
      mustChangePassword: false,
    });
    expect(await verifyAdminToken(teacher)).toBeNull();
  });

  it("no acepta un ticket de subida", async () => {
    const ticket = await signUploadTicket("actividades/recursos/x.pdf", 2296, "document");
    expect(await verifyAdminToken(ticket)).toBeNull();
  });

  it("rechaza una firma que no es nuestra, y basura", async () => {
    const token = await signAdminToken(await adminKeyFingerprint(KEY));
    process.env.SESSION_SECRET = "otro-secreto-otro-secreto-otro-secreto-9";
    expect(await verifyAdminToken(token)).toBeNull();

    process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
    expect(await verifyAdminToken("no-es-un-jwt")).toBeNull();
    expect(await verifyAdminToken(undefined)).toBeNull();
  });
});
