import { beforeAll, describe, expect, it } from "vitest";
import { signUploadTicket, verifyUploadTicket } from "@/lib/upload-ticket";

/**
 * El ticket es lo único que separa "este archivo lo subió este profesor recién"
 * de "esta es la clave de cualquier objeto del bucket". El navegador manda la
 * clave, así que sin esta comprobación un formulario manipulado podría colgar
 * de su actividad el documento de otra persona.
 */

const KEY = "actividades/recursos/9f1c2b40-0000-4000-8000-000000000000.pdf";
const USER = 2296;

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
});

describe("upload tickets", () => {
  it("acepta la clave que amparó, para ese profesor", async () => {
    const ticket = await signUploadTicket(KEY, USER, "document");
    expect(await verifyUploadTicket(ticket, KEY, USER, "document")).toBe(true);
  });

  it("rechaza una clave distinta de la firmada", async () => {
    const ticket = await signUploadTicket(KEY, USER, "document");
    const otra = "actividades/recursos/de-otra-persona.pdf";
    expect(await verifyUploadTicket(ticket, otra, USER, "document")).toBe(false);
  });

  it("rechaza el ticket de otro profesor", async () => {
    const ticket = await signUploadTicket(KEY, USER, "document");
    expect(await verifyUploadTicket(ticket, KEY, USER + 1, "document")).toBe(false);
  });

  it("no deja pasar un documento por portada", async () => {
    const ticket = await signUploadTicket(KEY, USER, "document");
    expect(await verifyUploadTicket(ticket, KEY, USER, "cover")).toBe(false);
  });

  it("rechaza una firma que no es nuestra", async () => {
    const ticket = await signUploadTicket(KEY, USER, "document");
    process.env.SESSION_SECRET = "otro-secreto-otro-secreto-otro-secreto-9";
    const verificado = await verifyUploadTicket(ticket, KEY, USER, "document");
    process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
    expect(verificado).toBe(false);
  });

  it("rechaza basura", async () => {
    expect(await verifyUploadTicket("no-es-un-jwt", KEY, USER, "document")).toBe(false);
    expect(await verifyUploadTicket("", KEY, USER, "document")).toBe(false);
  });
});
