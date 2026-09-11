import { EmailLayout, P } from "@/emails/layout";

/** Laravel: `WelcomeUser`. */
export const WELCOME_SUBJECT = "¡Bienvenido a T-share!";

export function WelcomeEmail({ name, appUrl }: { name: string; appUrl: string }) {
  return (
    <EmailLayout
      appUrl={appUrl}
      preview="Tu cuenta en T-share ya está lista."
      heading={`¡Hola ${name}!`}
      cta={{ label: "Ver actividades", url: `${appUrl}/actividades` }}
    >
      <P>Tu cuenta en T-share ya está lista.</P>
      <P>
        Desde ahora puedes buscar actividades de otras profesoras y profesores, guardar las que
        te sirvan y publicar las tuyas para que otros las usen en su sala.
      </P>
    </EmailLayout>
  );
}
