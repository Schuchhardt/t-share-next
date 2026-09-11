import "server-only";
import { SignJWT, jwtVerify } from "jose";
import type { UploadKind } from "@/lib/uploads";

/**
 * El comprobante de que una clave del bucket se la entregamos nosotros.
 *
 * El navegador sube el archivo directo a S3 y después le manda al server
 * action la clave donde quedó. Esa clave viene del cliente, así que por sí
 * sola no vale nada: un formulario manipulado podría mandar la clave de
 * cualquier objeto del bucket — el CV que otro profesor subió, por ejemplo — y
 * colgarlo de su propia actividad.
 *
 * Por eso `presignUpload` devuelve además este token: firma la clave junto al
 * id del profesor, y el server action solo acepta claves que vengan con él.
 *
 * Dura una hora, que es lo que puede tardar alguien en subir sus archivos y
 * terminar de llenar el formulario.
 */

const TICKET_TTL = "1h";

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set.");
  return new TextEncoder().encode(value);
}

export async function signUploadTicket(
  key: string,
  userId: number,
  kind: UploadKind,
): Promise<string> {
  return new SignJWT({ key, kind })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(TICKET_TTL)
    .sign(secret());
}

/**
 * True cuando el ticket es nuestro, no ha expirado y ampara exactamente esa
 * clave para ese profesor. Cualquier otra cosa — firma falsa, clave cambiada,
 * ticket de otra persona — es false.
 */
export async function verifyUploadTicket(
  ticket: string,
  key: string,
  userId: number,
  kind: UploadKind,
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(ticket, secret(), { algorithms: ["HS256"] });
    return payload.key === key && payload.kind === kind && payload.sub === String(userId);
  } catch {
    return false;
  }
}
