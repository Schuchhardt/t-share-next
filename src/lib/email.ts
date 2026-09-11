import "server-only";
import { Resend } from "resend";
import { env, hasEmailConfig } from "@/lib/env";

/**
 * Transactional mail, through Resend.
 *
 * It replaces the SendGrid account the Laravel app used. The sender moved to
 * `email.t-share.org` — a subdomain whose SPF and DKIM records stand on their
 * own, so authenticating the mail this app sends never touches the MX of
 * t-share.org, where the team reads its own inbox.
 *
 * Sending never throws at the caller. A teacher who just registered should
 * land on their account whether or not Resend answered, so `send` reports a
 * boolean and logs the reason. Without an API key it logs the message instead
 * — which is what a developer without credentials wants in the terminal.
 */

const TIMEOUT_MS = 10_000;

export type Mail = {
  to: string;
  toName?: string | null;
  subject: string;
  /** Plain-text body. The HTML part is rendered from the same component. */
  text: string;
  html: string;
  /** Where a reply should go, when it is not the shared mailbox. */
  replyTo?: string;
};

let client: Resend | null = null;

function resend(): Resend {
  client ??= new Resend(env.resendApiKey);
  return client;
}

/**
 * `Name <address>`, with the display name quoted when it holds anything a
 * header would read as structure. A teacher's surname is not supposed to be
 * able to add a recipient.
 */
function address(email: string, name?: string | null): string {
  const clean = name?.replace(/[\r\n]/g, " ").trim();
  if (!clean) return email;
  const quoted = clean.replace(/["\\]/g, "");
  return /^[\w áéíóúüñÁÉÍÓÚÜÑ'.-]+$/.test(quoted) ? `${quoted} <${email}>` : `"${quoted}" <${email}>`;
}

export async function sendEmail(mail: Mail): Promise<boolean> {
  if (!hasEmailConfig()) {
    console.info(
      `[email] RESEND_API_KEY no está configurada; no se envió "${mail.subject}" a ${mail.to}.`,
    );
    return false;
  }

  try {
    // The SDK has no timeout of its own, and every caller here runs inside
    // `after()` — a request that never settles would hold the function open
    // for its whole budget.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout tras ${TIMEOUT_MS} ms`)), TIMEOUT_MS).unref?.(),
    );

    const { data, error } = await Promise.race([
      resend().emails.send({
        from: address(env.mailFrom, env.mailFromName),
        to: address(mail.to, mail.toName),
        replyTo: mail.replyTo ?? env.mailReplyTo,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
      timeout,
    ]);

    if (error) {
      console.error(`[email] Resend rechazó "${mail.subject}": ${error.name} — ${error.message}`);
      return false;
    }
    return Boolean(data?.id);
  } catch (err) {
    console.error(`[email] no se pudo enviar "${mail.subject}":`, err);
    return false;
  }
}
