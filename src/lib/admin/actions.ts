"use server";

import { redirect } from "next/navigation";
import { clearAdminCookie, setAdminCookie } from "@/lib/admin/session";
import { sameKey } from "@/lib/admin/token";
import { env, hasAdminConfig } from "@/lib/env";

/**
 * Entrar y salir del panel.
 *
 * La credencial es una sola: `ADMIN_KEY`. No hay usuario que buscar ni hash
 * que verificar, así que todo lo que hace `adminSignIn` es comparar y firmar.
 */

export type AdminAuthState = { error: string | null };

/**
 * Sólo rutas dentro del panel, para que el `?next=` que pone el proxy no se
 * pueda usar para mandar a alguien a otro sitio después de entrar.
 */
function safeAdminPath(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : "";
  return path === "/admin" || path.startsWith("/admin/") ? path : "/admin";
}

export async function adminSignIn(
  _prev: AdminAuthState,
  formData: FormData,
): Promise<AdminAuthState> {
  if (!hasAdminConfig()) {
    return {
      error:
        "El panel no está habilitado en este entorno: falta ADMIN_KEY en las variables de entorno.",
    };
  }

  const given = String(formData.get("key") ?? "");
  if (!given) return { error: "Escribe la llave." };

  if (!(await sameKey(given, env.adminKey!))) {
    // Un poco de espera en cada intento fallido. No es un candado — esto corre
    // en una función que puede estar replicada, así que no hay un contador
    // compartido donde llevar la cuenta — pero le quita gracia a probar llaves
    // a mano, y la comparación de arriba ya no delata cuánto se acercó.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { error: "Esa llave no es." };
  }

  await setAdminCookie();
  redirect(safeAdminPath(formData.get("next")));
}

export async function adminSignOut(): Promise<void> {
  await clearAdminCookie();
  redirect("/admin/entrar");
}
