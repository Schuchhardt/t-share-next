"use client";

import { useActionState } from "react";
import { Messages, Submit } from "@/components/admin/ui";
import { adminSignIn, type AdminAuthState } from "@/lib/admin/actions";

/** El formulario de la llave. `next` lo lee la página del `?next=` que pone el
 * proxy, y `adminSignIn` sólo lo acepta si apunta dentro de /admin. */

const EMPTY: AdminAuthState = { error: null };

export function KeyForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(adminSignIn, EMPTY);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="next" value={next} />

      <div className="grid gap-1.5">
        <label htmlFor="key" className="text-[13px] font-bold text-ink">
          Llave
        </label>
        <input
          id="key"
          name="key"
          type="password"
          autoComplete="off"
          autoFocus
          required
          className="field"
        />
      </div>

      <Messages error={state.error} />

      <div>
        <Submit pendingLabel="Entrando…">Entrar</Submit>
      </div>
    </form>
  );
}
