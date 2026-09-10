import Link from "next/link";
import { AuthForm, Field } from "@/components/auth-form";
import { signIn } from "@/lib/auth/actions";

export const metadata = { title: "Entrar" };

export default async function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  // Set by `resetPassword` when it redirects here.
  const justChanged = sp.password === "cambiada";

  return (
    <AuthForm
      action={signIn}
      title="Entrar"
      intro={
        justChanged
          ? "Listo, tu contraseña quedó cambiada. Entra con ella."
          : "Usa el mismo correo y contraseña que tenías en T-share. Si es tu primera vez desde la migración, te vamos a pedir una contraseña nueva."
      }
      submitLabel="Entrar"
      pendingLabel="Entrando…"
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
