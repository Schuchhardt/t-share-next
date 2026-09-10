"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { changePassword, type FormState } from "@/lib/auth/actions";
import { checkNewPassword } from "@/lib/auth/strength";

/**
 * Changing the password from inside another page.
 *
 * `AuthForm` owns the standalone /cambiar-password screen — heading, intro,
 * footer and all — which is the wrong shape for a section sitting under the
 * profile fields. What the two share is the rule: the new password is checked
 * in the browser first, so a teacher who picks an unusable one hears about
 * *that* rather than about the current password they may also have mistyped.
 *
 * `next` is where the action lands on success. It is a plain form field, and
 * the action runs it through the same same-origin check the sign-in redirect
 * uses.
 */

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-sm border-[1.5px] border-indigo bg-transparent px-5 py-2.5 text-sm font-semibold text-indigo transition-colors hover:bg-lav disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Cambiar contraseña"}
    </button>
  );
}

function Field({
  id,
  label,
  hint,
}: {
  id: string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="grid gap-[7px]">
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="password"
        autoComplete={id === "currentPassword" ? "current-password" : "new-password"}
        required
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="field"
      />
      {hint && (
        <span id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </span>
      )}
    </div>
  );
}

export function PasswordForm({ next }: { next: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction] = useActionState(
    async (previous: FormState, formData: FormData): Promise<FormState> => {
      const value = (name: string) => String(formData.get(name) ?? "");
      const problem = checkNewPassword(value("password"), value("passwordConfirm"));
      if (problem) return { error: problem };

      const result = await changePassword(previous, formData);
      // On success the action redirects and this never runs; on failure the
      // typed passwords are stale, so clearing them beats leaving them.
      if (result.error) formRef.current?.reset();
      return result;
    },
    { error: null },
  );

  return (
    <form ref={formRef} action={formAction} className="grid max-w-[420px] gap-[18px]" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field id="currentPassword" label="Contraseña actual" />
      <Field
        id="password"
        label="Contraseña nueva"
        hint="Al menos 10 caracteres, con letras y números."
      />
      <Field id="passwordConfirm" label="Repite la contraseña nueva" />

      <p aria-live="polite" className="min-h-[1.25rem] text-sm text-coral-ink">
        {state.error}
      </p>

      <div>
        <Save />
      </div>
    </form>
  );
}
