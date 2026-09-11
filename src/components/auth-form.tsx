"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/auth/actions";
import { checkNewPassword } from "@/lib/auth/strength";

/**
 * The shell the account screens share: a heading, a server action, an error
 * region and a submit button that disables itself while the action runs.
 *
 * `useActionState` keeps the form working before hydration — the browser
 * posts it, the action runs, and the page comes back with the error rendered.
 *
 * `newPassword` names the fields that hold a password being *chosen*, and the
 * reducer below checks them in the browser before the action is called. That
 * matters for more than the round trip: the change-password screen also asks
 * for the current password, and the server has to see both. Without this, a
 * teacher who picks an unusable password *and* mistypes the old one is told
 * only about the old one — the wrong field, and the wrong problem. The
 * actions apply the same rule again server-side; this is a courtesy, not the
 * guarantee.
 *
 * The prop is a plain object rather than a callback because these screens are
 * Server Components, which cannot hand a function to a client one.
 */

/** One more error on this form, counted from the state the last run left. */
function failures(previous: FormState): number {
  return (previous.attempts ?? 0) + 1;
}

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-sm border-none bg-indigo px-6 py-[13px] text-[15px] font-bold text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * A second line to show once the form has come back with an error `after`
 * times in a row — the sign-in screen uses it to point at the access link it
 * just mailed.
 *
 * The count is kept here, in the browser, rather than by the action. The
 * server knows whether the address exists and the form must not: telling
 * everyone the same thing after the same number of misses is what keeps this
 * from becoming a way to check who has an account.
 */
export type RetryHint = { after: number; message: string };

/** Which fields hold a password being chosen, so the form can vet them. */
export type NewPasswordFields = {
  field: string;
  confirmField: string;
  /** The field holding the address, when the form collects one. */
  emailField?: string;
};

export function AuthForm({
  action,
  title,
  intro,
  submitLabel,
  pendingLabel,
  children,
  footer,
  newPassword,
  retryHint,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  title: string;
  intro?: string;
  submitLabel: string;
  pendingLabel: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  newPassword?: NewPasswordFields;
  retryHint?: RetryHint;
}) {
  const [state, formAction] = useActionState(
    async (previous: FormState, formData: FormData): Promise<FormState> => {
      // Runs in the browser once hydrated; with JavaScript off the form posts
      // straight to the action and the server catches the same thing.
      if (newPassword) {
        const value = (name: string) => String(formData.get(name) ?? "");
        const problem = checkNewPassword(
          value(newPassword.field),
          value(newPassword.confirmField),
          newPassword.emailField ? value(newPassword.emailField) : undefined,
        );
        if (problem) return { error: problem, attempts: failures(previous) };
      }
      const result = await action(previous, formData);
      return { ...result, attempts: result.error ? failures(previous) : 0 };
    },
    { error: null, attempts: 0 },
  );

  const notice =
    state.notice ??
    (retryHint && (state.attempts ?? 0) >= retryHint.after ? retryHint.message : null);

  return (
    <section className="mx-auto max-w-[440px] pt-16 pb-24">
      <h1 className="mb-2.5 text-[30px] leading-[1.1] font-bold tracking-[-0.015em] text-ink sm:text-[34px]">
        {title}
      </h1>
      {intro && <p className="mb-7 text-[15px] leading-[1.55] text-pretty text-muted">{intro}</p>}

      <form action={formAction} className="grid gap-[18px]" noValidate>
        {children}

        <p aria-live="polite" className="min-h-[1.25rem] text-sm text-coral-ink">
          {state.error}
        </p>

        {notice && (
          <p
            aria-live="polite"
            className="rounded-sm bg-mint px-4 py-3 text-sm leading-[1.55] text-mint-strong"
          >
            {notice}
          </p>
        )}

        <Submit label={submitLabel} pendingLabel={pendingLabel} />
      </form>

      {footer && <div className="mt-7 text-sm text-muted">{footer}</div>}
    </section>
  );
}

export function Field({
  id,
  label,
  type = "text",
  autoComplete,
  required,
  hint,
  defaultValue,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  defaultValue?: string;
}) {
  return (
    <div className="grid gap-[7px]">
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
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
