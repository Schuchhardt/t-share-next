import Link from "next/link";
import { AuthForm, Field } from "@/components/auth-form";
import { resetPassword } from "@/lib/auth/actions";
import { findPasswordReset } from "@/lib/auth/reset";

export const metadata = { title: "Elegir una contraseña nueva" };

/**
 * The screen an emailed reset link opens. Same path and query parameter the
 * Angular site used (`/cambiar-clave?token=…`).
 *
 * The token is checked here, before the form is drawn, so a stale link says so
 * up front instead of after someone has typed a password twice. The check does
 * not spend the token — `resetPassword` does that once the new hash is
 * written.
 */
export default async function CambiarClavePage({ searchParams }: PageProps<"/cambiar-clave">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const lookup = token
    ? await findPasswordReset(token)
    : ({ ok: false, reason: "unknown" } as const);

  if (!lookup.ok) {
    const message =
      lookup.reason === "used"
        ? "Ese enlace ya se usó para cambiar la contraseña."
        : lookup.reason === "expired"
          ? "Ese enlace venció. Los enlaces duran una hora."
          : "Ese enlace no es válido.";

    return (
      <section className="mx-auto max-w-[440px] pt-16 pb-24">
        <h1 className="mb-2.5 text-[30px] leading-[1.1] font-bold tracking-[-0.015em] text-ink sm:text-[34px]">
          Enlace no válido
        </h1>
        <p className="mb-7 text-[15px] leading-[1.55] text-pretty text-muted">
          {message} Puedes pedir uno nuevo y te lo enviamos al tiro.
        </p>
        <Link
          href="/recuperar-clave"
          className="inline-block rounded-sm bg-indigo px-6 py-[13px] text-[15px] font-bold text-white no-underline transition-colors hover:bg-ink hover:no-underline"
        >
          Pedir un enlace nuevo
        </Link>
      </section>
    );
  }

  return (
    <AuthForm
      action={resetPassword}
      title="Elige una contraseña nueva"
      intro="Escríbela dos veces y listo. Después entra con ella como siempre."
      submitLabel="Guardar contraseña"
      pendingLabel="Guardando…"
      footer={
        <>
          ¿Ya la cambiaste? <Link href="/entrar">Entrar</Link>
        </>
      }
    >
      <input type="hidden" name="token" value={token} />
      <Field
        id="password"
        label="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        required
        hint="Al menos 10 caracteres, con letras y números."
      />
      <Field
        id="passwordConfirm"
        label="Repite la contraseña nueva"
        type="password"
        autoComplete="new-password"
        required
      />
    </AuthForm>
  );
}
