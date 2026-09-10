import "server-only";
import { env, hasEmailConfig } from "@/lib/env";

/**
 * Transactional mail, still through SendGrid — the same account the Laravel
 * app used, so the sender domain stays verified and nothing has to be
 * re-warmed.
 *
 * This talks to the v3 REST endpoint with `fetch` rather than pulling in
 * `@sendgrid/mail`: the payload below is the whole API surface we need, and a
 * dependency that only wraps one POST is not worth carrying.
 *
 * Sending never throws at the caller. A teacher who just registered should
 * land on their account whether or not SendGrid answered, so `send` reports a
 * boolean and logs the reason. Without an API key it logs the message instead
 * — which is what a developer without credentials wants in the terminal.
 */

const ENDPOINT = "https://api.sendgrid.com/v3/mail/send";
const TIMEOUT_MS = 10_000;

export type Mail = {
  to: string;
  toName?: string | null;
  subject: string;
  /** Plain-text body. The HTML part is built from the same content. */
  text: string;
  html: string;
  /** Where a reply should go, when it is not the no-reply sender. */
  replyTo?: string;
};

export async function sendEmail(mail: Mail): Promise<boolean> {
  if (!hasEmailConfig()) {
    console.info(
      `[email] SENDGRID_API_KEY no está configurada; no se envió "${mail.subject}" a ${mail.to}.`,
    );
    return false;
  }

  const body = {
    personalizations: [
      { to: [{ email: mail.to, ...(mail.toName ? { name: mail.toName } : {}) }] },
    ],
    from: { email: env.mailFrom, name: env.mailFromName },
    ...(mail.replyTo ? { reply_to: { email: mail.replyTo } } : {}),
    subject: mail.subject,
    content: [
      { type: "text/plain", value: mail.text },
      { type: "text/html", value: mail.html },
    ],
  };

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // SendGrid answers 202 with an empty body when the message is queued.
    if (response.ok) return true;

    const detail = await response.text().catch(() => "");
    console.error(`[email] SendGrid ${response.status} al enviar "${mail.subject}": ${detail}`);
    return false;
  } catch (err) {
    console.error(`[email] no se pudo enviar "${mail.subject}":`, err);
    return false;
  }
}
