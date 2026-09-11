import { AuthForm, Field } from "@/components/auth-form";
import { changePassword } from "@/lib/auth/actions";
import { getSession } from "@/lib/auth/session";

export const metadata = {
  title: "Cambiar contraseña",
  robots: { index: false, follow: false },
};

/**
 * Every account migrated from the old site lands here on its first sign-in:
 * the Laravel hash got them through the door once, and this screen replaces it
 * with one this app wrote. The middleware keeps them here until it succeeds.
 */
export default async function CambiarPasswordPage() {
  const session = await getSession();
  const forced = session?.mustChangePassword ?? false;

  return (
    <AuthForm
      action={changePassword}
      title={forced ? "Elige una contraseña nueva" : "Cambiar contraseña"}
      intro={
        forced
          ? "Migramos T-share a una plataforma nueva. Tu contraseña anterior sirvió para entrar esta vez; define una nueva para dejarla guardada de forma segura."
          : "Define una contraseña nueva para tu cuenta."
      }
      submitLabel="Guardar contraseña"
      pendingLabel="Guardando…"
      newPassword={{ field: "password", confirmField: "passwordConfirm" }}
    >
      <Field
        id="currentPassword"
        label={forced ? "Tu contraseña anterior" : "Contraseña actual"}
        type="password"
        autoComplete="current-password"
        required
      />
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
