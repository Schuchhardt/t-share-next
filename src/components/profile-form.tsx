"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ImagePicker } from "@/components/image-picker";
import { saveProfile } from "@/lib/profile-actions";
import type { Profile } from "@/lib/types";

/**
 * The name-and-photo half of "Editar perfil".
 *
 * It stays on the page after saving — a confirmation rather than a redirect —
 * because a teacher who has just changed their photo wants to see the new one
 * where they left it. The action revalidates `/mi-perfil`, so the header and
 * the profile pick the change up on the way back.
 */

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-sm border-none bg-indigo px-6 py-[13px] text-[15px] font-bold text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Guardar cambios"}
    </button>
  );
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState(saveProfile, { error: null, notice: null });

  return (
    <form action={formAction} className="grid gap-[22px]">
      <ImagePicker
        name="avatar"
        label="Foto de perfil"
        alt="Tu foto de perfil"
        hint="Opcional · JPG o PNG, hasta 8 MB"
        currentUrl={profile.avatarUrl}
        round
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[18px]">
        <div className="grid gap-[7px]">
          <label htmlFor="firstName" className="text-sm font-bold text-ink">
            Nombre
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            maxLength={120}
            autoComplete="given-name"
            defaultValue={profile.firstName}
            className="field"
          />
        </div>

        <div className="grid gap-[7px]">
          <label htmlFor="lastName" className="text-sm font-bold text-ink">
            Apellido <span className="font-normal text-muted">— opcional</span>
          </label>
          <input
            id="lastName"
            name="lastName"
            maxLength={120}
            autoComplete="family-name"
            defaultValue={profile.lastName ?? ""}
            className="field"
          />
        </div>
      </div>

      <div className="grid gap-[7px]">
        <span className="text-sm font-bold text-ink">Correo</span>
        <p className="text-[15px] text-muted">
          {profile.email} —{" "}
          <span className="text-muted">
            es con lo que entras, así que se cambia escribiéndonos.
          </span>
        </p>
      </div>

      <p aria-live="polite" className="min-h-[1.25rem] text-sm text-coral-ink">
        {state.error}
      </p>

      {state.notice && (
        <p
          aria-live="polite"
          className="rounded-sm bg-mint px-4 py-3 text-sm leading-[1.55] text-mint-strong"
        >
          {state.notice}
        </p>
      )}

      <div>
        <Save />
      </div>
    </form>
  );
}
