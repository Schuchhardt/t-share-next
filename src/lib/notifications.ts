import "server-only";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { SITE } from "@/lib/site";

/**
 * The three emails this app sends, carried over from the Laravel
 * notifications: `WelcomeUser`, `PasswordReset` and `ActividadComentada`.
 * Subjects are kept word for word so a teacher's existing filters keep
 * matching.
 *
 * The other mail notifications in the old code — `UsuarioMensaje`,
 * `ActividadSolicitaAutorizacion` and `AutorizaEdicionActividad` — belong to
 * the private messaging and edit-authorisation features, which this app does
 * not have. They are not ported; when those screens arrive, the builders go
 * here next to these.
 *
 * Every builder is pure and returns the finished message, so the wording is
 * unit-testable without a network. The `notify*` wrappers do the sending and
 * swallow failures: a comment is saved whether or not the author's mail
 * server was reachable.
 */

export type Message = { subject: string; text: string; html: string };

/** Escapes a value going into the HTML part. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The shell every message shares: brand header, body, and the footer the old
 * mails carried. Styles are inline because that is the only thing mail
 * clients agree on.
 */
function layout(parts: { heading: string; body: string[]; cta?: { label: string; url: string } }): string {
  const paragraphs = parts.body
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a4870;">${line}</p>`,
    )
    .join("");

  const cta = parts.cta
    ? `<p style="margin:24px 0 8px;">
         <a href="${esc(parts.cta.url)}" style="display:inline-block;background:#3d3b96;color:#ffffff;
            font-size:15px;font-weight:bold;text-decoration:none;padding:13px 24px;border-radius:4px;">
           ${esc(parts.cta.label)}
         </a>
       </p>
       <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6e6c8f;">
         Si el botón no funciona, copia esta dirección en tu navegador:<br>
         <span style="word-break:break-all;">${esc(parts.cta.url)}</span>
       </p>`
    : "";

  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f7f7fd;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e1f0;border-radius:8px;padding:32px;">
    <p style="margin:0 0 24px;font-size:18px;font-weight:bold;color:#2b2a55;letter-spacing:-0.01em;">T-share</p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:#2b2a55;">${esc(parts.heading)}</h1>
    ${paragraphs}
    ${cta}
    <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #e2e1f0;font-size:13px;line-height:1.6;color:#6e6c8f;">
      ${esc(SITE.company)} · <a href="mailto:${esc(SITE.email)}" style="color:#3d3b96;">${esc(SITE.email)}</a><br>
      Este correo se envía automáticamente; no hace falta responderlo.
    </p>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/** Laravel: `WelcomeUser` — "¡Bienvenido a T-share!" */
export function welcomeMessage(input: { name: string }): Message {
  const url = `${env.appUrl}/actividades`;
  return {
    subject: "¡Bienvenido a T-share!",
    text: [
      `¡Hola ${input.name}!`,
      "",
      "Tu cuenta en T-share ya está lista. Desde ahora puedes buscar actividades de otras profesoras y profesores, guardar las que te sirvan y publicar las tuyas.",
      "",
      `Empieza acá: ${url}`,
      "",
      "¡Gracias por sumarte!",
    ].join("\n"),
    html: layout({
      heading: `¡Hola ${input.name}!`,
      body: [
        "Tu cuenta en T-share ya está lista.",
        "Desde ahora puedes buscar actividades de otras profesoras y profesores, guardar las que te sirvan y publicar las tuyas para que otros las usen en su sala.",
      ],
      cta: { label: "Ver actividades", url },
    }),
  };
}

/** Laravel: `PasswordReset` — "Recuperación de contraseña - T-share" */
export function passwordResetMessage(input: { name: string; token: string }): Message {
  // The path the Angular site used, so links in old bookmarks still land
  // somewhere that works.
  const url = `${env.appUrl}/cambiar-clave?token=${encodeURIComponent(input.token)}`;
  return {
    subject: "Recuperación de contraseña - T-share",
    text: [
      `¡Hola ${input.name}!`,
      "",
      "Se ha solicitado un cambio de contraseña para tu cuenta.",
      "",
      `Cambiar contraseña: ${url}`,
      "",
      "El enlace vence en una hora y sirve una sola vez. Si no fuiste tú, puedes ignorar este correo: tu contraseña actual sigue siendo válida.",
      "",
      "¡Gracias por usar T-share!",
    ].join("\n"),
    html: layout({
      heading: `¡Hola ${input.name}!`,
      body: [
        "Se ha solicitado un cambio de contraseña para tu cuenta.",
        "El enlace vence en una hora y sirve una sola vez. Si no fuiste tú, puedes ignorar este correo: tu contraseña actual sigue siendo válida.",
      ],
      cta: { label: "Cambiar contraseña", url },
    }),
  };
}

/** Laravel: `ActividadComentada` — "Han comentado tu actividad en T-share" */
export function activityCommentedMessage(input: {
  authorName: string;
  commenterName: string;
  activityId: number;
  activityTitle: string;
}): Message {
  const url = `${env.appUrl}/actividades/detalle/${input.activityId}`;
  return {
    subject: "Han comentado tu actividad en T-share",
    text: [
      `¡Hola ${input.authorName}!`,
      "",
      `${input.commenterName} ha comentado tu actividad "${input.activityTitle}".`,
      "",
      `Ver el comentario: ${url}`,
    ].join("\n"),
    html: layout({
      heading: `¡Hola ${input.authorName}!`,
      body: [
        `<strong>${esc(input.commenterName)}</strong> ha comentado tu actividad “${esc(input.activityTitle)}”.`,
      ],
      cta: { label: "Ver el comentario", url },
    }),
  };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export async function notifyWelcome(to: { email: string; name: string }): Promise<void> {
  await sendEmail({ to: to.email, toName: to.name, ...welcomeMessage({ name: to.name }) });
}

export async function notifyPasswordReset(
  to: { email: string; name: string },
  token: string,
): Promise<void> {
  await sendEmail({
    to: to.email,
    toName: to.name,
    ...passwordResetMessage({ name: to.name, token }),
  });
}

export async function notifyActivityCommented(
  to: { email: string; name: string },
  comment: { commenterName: string; activityId: number; activityTitle: string },
): Promise<void> {
  await sendEmail({
    to: to.email,
    toName: to.name,
    ...activityCommentedMessage({ authorName: to.name, ...comment }),
  });
}
