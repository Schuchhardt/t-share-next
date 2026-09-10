import Link from "next/link";
import { AuthForm, Field } from "@/components/auth-form";
import { requestPasswordReset } from "@/lib/auth/actions";

export const metadata = { title: "Recuperar contraseña" };

/**
 * Asking for a reset link. Same path the Angular site used, so links from old
 * emails and bookmarks still land on a working screen.
 */
export default function RecuperarClavePage() {
  return (
    <AuthForm
      action={requestPasswordReset}
      title="Recuperar contraseña"
      intro="Escribe el correo con el que entras a T-share y te enviamos un enlace para elegir una contraseña nueva. El enlace vence en una hora."
      submitLabel="Enviarme el enlace"
      pendingLabel="Enviando…"
      footer={
        <>
          ¿Te acordaste? <Link href="/entrar">Entrar</Link>
        </>
      }
    >
      <Field id="email" label="Correo" type="email" autoComplete="email" required />
    </AuthForm>
  );
}
