"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, setSessionCookie } from "@/lib/auth/session";
import { hasStorageConfig } from "@/lib/env";
import { previewKindForFile } from "@/lib/preview";
import { putFile, uploadKey } from "@/lib/storage";
import { findAccountById, updateProfile } from "@/lib/users";

/**
 * The "Editar perfil" screen — the name and the photo.
 *
 * The old Angular form under `/perfil/editar/:id` also collected a school, a
 * nationality, a birth date and a gender. Those columns are still in the
 * schema and nothing reads them, so they are not on this screen; adding them
 * back is a matter of extending the schema below and the form.
 *
 * The photo goes to `users/avatars/`, which is where the 266 migrated ones
 * already live.
 */

const MAX_AVATAR_BYTES = 8 * 1024 * 1024;

export type ProfileState = { error: string | null; notice: string | null };

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Escribe tu nombre.").max(120),
  lastName: z.string().trim().max(120),
});

export async function saveProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await requireSession();

  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos.", notice: null };
  }

  const picked = formData.get("avatar");
  const avatar = picked instanceof File && picked.size > 0 ? picked : null;
  if (avatar) {
    if (previewKindForFile(avatar) !== "image") {
      return { error: "La foto tiene que ser una imagen (JPG, PNG, GIF o WEBP).", notice: null };
    }
    if (avatar.size > MAX_AVATAR_BYTES) {
      return { error: "La foto supera los 8 MB.", notice: null };
    }
    if (!hasStorageConfig()) {
      return { error: "La subida de imágenes no está configurada en este entorno.", notice: null };
    }
  }

  try {
    // Uploading first means a failed write leaves an unreferenced object
    // rather than a row pointing at nothing.
    const stored = avatar
      ? await putFile(
          uploadKey("users/avatars", avatar.name),
          new Uint8Array(await avatar.arrayBuffer()),
          avatar.type || "image/jpeg",
        )
      : null;

    await updateProfile(session.userId, {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName || null,
      ...(stored ? { avatarKey: stored.key, avatarUrl: stored.url } : {}),
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "No pudimos guardar los cambios.",
      notice: null,
    };
  }

  // The header greets the teacher from the session cookie, not the database,
  // so a rename that does not reach the token looks like it did not save.
  const account = await findAccountById(session.userId);
  if (account) {
    await setSessionCookie({
      ...session,
      name:
        [account.first_name, account.last_name].filter(Boolean).join(" ").trim() || account.email,
    });
  }

  revalidatePath("/mi-perfil");
  revalidatePath("/mi-perfil/editar");
  return { error: null, notice: "Listo, tu perfil quedó actualizado." };
}
