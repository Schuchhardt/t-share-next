import "server-only";
import { plainTextSelectors, render } from "@react-email/render";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { AccessLinkEmail, ACCESS_LINK_SUBJECT } from "@/emails/access-link";
import {
  ActivityCommentedEmail,
  ACTIVITY_COMMENTED_SUBJECT,
} from "@/emails/activity-commented";
import { PasswordResetEmail, PASSWORD_RESET_SUBJECT } from "@/emails/password-reset";
import { WelcomeEmail, WELCOME_SUBJECT } from "@/emails/welcome";

/**
 * The emails this app sends: the three carried over from the Laravel
 * notifications — `WelcomeUser`, `PasswordReset` and `ActividadComentada` —
 * plus the access link `signIn` offers after a second wrong password. The
 * three old subjects are kept word for word so a teacher's existing filters
 * keep matching.
 *
 * The other mail notifications in the old code (`UsuarioMensaje`,
 * `ActividadSolicitaAutorizacion`, `AutorizaEdicionActividad`) belong to the
 * private messaging and edit-authorisation features, which this app does not
 * have. They are not ported; when those screens arrive, the builders go here
 * next to these.
 *
 * Each builder renders its React Email component twice — once to HTML, once
 * to plain text — so the two parts of a message can never drift apart, and
 * returns the finished message. That keeps the wording unit-testable without
 * a network. The `notify*` wrappers do the sending and swallow failures: a
 * comment is saved whether or not the author's mail server was reachable.
 */

export type Message = { subject: string; text: string; html: string };

/**
 * How the HTML turns into the plain-text part.
 *
 * Two corrections to the defaults: the heading keeps the capitals it was
 * written with, instead of being shouted as "¡HOLA ANA!", and the logo — a
 * link wrapped around an image — is dropped rather than printed as a bare URL
 * above the greeting.
 */
const TEXT_SELECTORS = [
  ...plainTextSelectors,
  { selector: "h1", options: { uppercase: false } },
  { selector: "#logo", format: "skip" },
];

/** Renders a component into the two parts a message carries. */
async function build(subject: string, element: React.ReactElement): Promise<Message> {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true, htmlToTextOptions: { selectors: TEXT_SELECTORS } }),
  ]);
  return { subject, html, text: text.trim() };
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export function welcomeMessage(input: { name: string }): Promise<Message> {
  return build(WELCOME_SUBJECT, WelcomeEmail({ name: input.name, appUrl: env.appUrl }));
}

export function passwordResetMessage(input: { name: string; token: string }): Promise<Message> {
  return build(
    PASSWORD_RESET_SUBJECT,
    PasswordResetEmail({ ...input, appUrl: env.appUrl }),
  );
}

export function accessLinkMessage(input: { name: string; token: string }): Promise<Message> {
  return build(ACCESS_LINK_SUBJECT, AccessLinkEmail({ ...input, appUrl: env.appUrl }));
}

export function activityCommentedMessage(input: {
  authorName: string;
  commenterName: string;
  activityId: number;
  activityTitle: string;
}): Promise<Message> {
  return build(
    ACTIVITY_COMMENTED_SUBJECT,
    ActivityCommentedEmail({ ...input, appUrl: env.appUrl }),
  );
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export async function notifyWelcome(to: { email: string; name: string }): Promise<void> {
  await sendEmail({ to: to.email, toName: to.name, ...(await welcomeMessage({ name: to.name })) });
}

export async function notifyPasswordReset(
  to: { email: string; name: string },
  token: string,
): Promise<void> {
  await sendEmail({
    to: to.email,
    toName: to.name,
    ...(await passwordResetMessage({ name: to.name, token })),
  });
}

export async function notifyAccessLink(
  to: { email: string; name: string },
  token: string,
): Promise<void> {
  await sendEmail({
    to: to.email,
    toName: to.name,
    ...(await accessLinkMessage({ name: to.name, token })),
  });
}

export async function notifyActivityCommented(
  to: { email: string; name: string },
  comment: { commenterName: string; activityId: number; activityTitle: string },
): Promise<void> {
  await sendEmail({
    to: to.email,
    toName: to.name,
    ...(await activityCommentedMessage({ authorName: to.name, ...comment })),
  });
}
