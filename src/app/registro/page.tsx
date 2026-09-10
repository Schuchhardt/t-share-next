import Link from "next/link";
import { AuthForm, Field } from "@/components/auth-form";
import { signUp } from "@/lib/auth/actions";

export const metadata = { title: "Crear cuenta" };

export default function RegistroPage() {
  return (
    <AuthForm
      action={signUp}
      title="Crear cuenta"
      intro="Con una cuenta puedes guardar actividades, descargarlas y publicar las tuyas."
      submitLabel="Crear cuenta"
      pendingLabel="Creando…"
      newPassword={{ field: "password", confirmField: "passwordConfirm", emailField: "email" }}
      footer={
        <>
          ¿Ya tienes cuenta? <Link href="/entrar">Entrar</Link>
          <br />
          Al crear una cuenta aceptas los{" "}
          <Link href="/terminos">términos y condiciones</Link> y la{" "}
          <Link href="/privacidad">política de privacidad</Link>.
        </>
      }
    >
      <Field id="firstName" label="Nombre" autoComplete="given-name" required />
      <Field id="lastName" label="Apellido" autoComplete="family-name" />
      <Field id="email" label="Correo" type="email" autoComplete="email" required />
      <Field
        id="password"
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        required
        hint="Al menos 10 caracteres, con letras y números."
      />
      <Field
        id="passwordConfirm"
        label="Repite la contraseña"
        type="password"
        autoComplete="new-password"
        required
      />
    </AuthForm>
  );
}
