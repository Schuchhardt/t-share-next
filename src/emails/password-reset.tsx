import { EmailLayout, P } from "@/emails/layout";

/** Laravel: `PasswordReset`. */
export const PASSWORD_RESET_SUBJECT = "Recuperación de contraseña - T-share";

export function PasswordResetEmail({
  name,
  token,
  appUrl,
}: {
  name: string;
  token: string;
  appUrl: string;
}) {
  // The path the Angular site used, so links in old bookmarks still land
  // somewhere that works.
  const url = `${appUrl}/cambiar-clave?token=${encodeURIComponent(token)}`;

  return (
    <EmailLayout
      appUrl={appUrl}
      preview="Elige una contraseña nueva para tu cuenta."
      heading={`¡Hola ${name}!`}
      cta={{ label: "Cambiar contraseña", url }}
      note={
        <>
          El enlace vence en una hora y sirve una sola vez. Si no fuiste tú, puedes ignorar este
          correo: tu contraseña actual sigue siendo válida.
        </>
      }
    >
      <P>Se ha solicitado un cambio de contraseña para tu cuenta.</P>
    </EmailLayout>
  );
}
