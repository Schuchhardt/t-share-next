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
 *
 * A teacher who arrived through an emailed access link sees one field fewer.
 * They got here precisely because they could not produce the old password, so
 * asking for it would be a locked door with the key still in the inbox; the
 * link itself is what proved the account is theirs, and `changePassword`
 * checks the same flag before it skips the verification.
 */
export default async function CambiarPasswordPage() {
  const session = await getSession();
  const forced = session?.mustChangePassword ?? false;
  const viaAccessLink = session?.viaAccessLink ?? false;

  const intro = viaAccessLink
    ? "Entraste con el enlace que te mandamos al correo. Elige ahora una contraseña nueva y con ella entras la próxima vez."
    : forced
      ? "Migramos T-share a una plataforma nueva. Tu contraseña anterior sirvió para entrar esta vez; define una nueva para dejarla guardada de forma segura."
      : "Define una contraseña nueva para tu cuenta.";

  return (
    <AuthForm
      action={changePassword}
      title={forced ? "Elige una contraseña nueva" : "Cambiar contraseña"}
      intro={intro}
      submitLabel="Guardar contraseña"
      pendingLabel="Guardando…"
      newPassword={{ field: "password", confirmField: "passwordConfirm" }}
    >
      {!viaAccessLink && (
        <Field
          id="currentPassword"
          label={forced ? "Tu contraseña anterior" : "Contraseña actual"}
          type="password"
          autoComplete="current-password"
          required
        />
      )}
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
