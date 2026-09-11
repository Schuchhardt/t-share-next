import Link from "next/link";
import { AuthForm, Field } from "@/components/auth-form";
import { signIn } from "@/lib/auth/actions";

/** A sign-in form has nothing to offer a search result. */
export const metadata = {
  title: "Entrar",
  description: "Entra a tu cuenta de T-share para guardar actividades, descargarlas y publicar las tuyas.",
  alternates: { canonical: "/entrar" },
  robots: { index: false, follow: true },
};

/**
 * What to say when an access link did not work. `/acceso` sends them back
 * here with the reason, and every one of them has the same way out: miss the
 * password twice again, or ask for a reset.
 */
const ACCESS_PROBLEM: Record<string, string> = {
  used: "Ese enlace de acceso ya se usó. Entra con tu contraseña o pide uno nuevo.",
  expired: "Ese enlace de acceso venció. Los enlaces duran 30 minutos.",
  unknown: "Ese enlace de acceso no es válido.",
};

export default async function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  // Set by `resetPassword` when it redirects here.
  const justChanged = sp.password === "cambiada";
  // Set by the /acceso route handler when the emailed link is no good.
  const accessProblem = typeof sp.acceso === "string" ? ACCESS_PROBLEM[sp.acceso] : undefined;

  return (
    <AuthForm
      action={signIn}
      title="Entrar"
      intro={
        accessProblem ??
        (justChanged
          ? "Listo, tu contraseña quedó cambiada. Entra con ella."
          : "Usa el mismo correo y contraseña que tenías en T-share. Si es tu primera vez desde la migración, te vamos a pedir una contraseña nueva.")
      }
      submitLabel="Entrar"
      pendingLabel="Entrando…"
      // After the second miss `signIn` mails an access link. The message says
      // "si existe una cuenta" and shows for everybody, so the form still
      // refuses to say which addresses are registered.
      retryHint={{
        after: 2,
        message:
          "¿No la recuerdas? Si existe una cuenta con ese correo, te enviamos un enlace para entrar sin contraseña y elegir una nueva. Revisa tu bandeja, y también el spam.",
      }}
      footer={
        <>
          ¿No tienes cuenta? <Link href="/registro">Crear una</Link>
          <br />
          <Link href="/recuperar-clave">¿Olvidaste tu contraseña?</Link>
        </>
      }
    >
      <input type="hidden" name="next" value={next} />
      <Field id="email" label="Correo" type="email" autoComplete="email" required />
      <Field
        id="password"
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        required
      />
    </AuthForm>
  );
}
