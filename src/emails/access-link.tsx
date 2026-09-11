import { EmailLayout, P } from "@/emails/layout";

/**
 * The magic link. Nothing in the Laravel app sent this one: it is offered by
 * `signIn` after a teacher gets their password wrong a second time, so that
 * someone who simply does not remember it stops guessing and gets in.
 */
export const ACCESS_LINK_SUBJECT = "Tu enlace para entrar a T-share";

export const ACCESS_LINK_TTL_MINUTES = 30;

export function AccessLinkEmail({
  name,
  token,
  appUrl,
}: {
  name: string;
  token: string;
  appUrl: string;
}) {
  const url = `${appUrl}/acceso?token=${encodeURIComponent(token)}`;

  return (
    <EmailLayout
      appUrl={appUrl}
      preview="Entra sin contraseña y elige una nueva."
      heading={`¡Hola ${name}!`}
      cta={{ label: "Entrar a T-share", url }}
      note={
        <>
          El enlace vence en {ACCESS_LINK_TTL_MINUTES} minutos y sirve una sola vez. Si no fuiste
          tú quien intentó entrar, puedes ignorar este correo: tu contraseña actual sigue siendo
          válida y nadie puede entrar sin este enlace.
        </>
      }
    >
      <P>
        Vimos un par de intentos de entrar con una contraseña que no era. Si no la recuerdas, no
        tienes que seguir adivinando: este botón te deja entrar directo.
      </P>
      <P>Apenas entres te vamos a pedir que elijas una contraseña nueva, y listo.</P>
    </EmailLayout>
  );
}
