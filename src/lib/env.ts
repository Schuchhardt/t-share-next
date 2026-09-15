import "server-only";

/**
 * Server-side configuration.
 *
 * Every value here is secret or server-only — none of it is prefixed
 * `NEXT_PUBLIC_`, so none of it reaches the browser bundle. Reads are lazy so
 * that `next build` can prerender pages on a machine without the secrets;
 * anything that actually touches Supabase or S3 fails loudly at request time
 * instead of silently returning nothing.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill it in ` +
        "(or add it to the Netlify site's environment variables).",
    );
  }
  return value;
}

export const env = {
  get supabaseUrl(): string {
    return required("SUPABASE_URL");
  },
  /**
   * The service role key. It bypasses row-level security by design — this app
   * runs no RLS policies and treats the Next.js server as the only client, so
   * this key must never be sent to the browser.
   */
  get supabaseServiceRoleKey(): string {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get sessionSecret(): string {
    return required("SESSION_SECRET");
  },
  get s3Bucket(): string {
    return required("S3_BUCKET");
  },
  get s3Region(): string {
    return process.env.S3_REGION ?? "us-east-1";
  },
  get s3AccessKeyId(): string {
    return required("S3_ACCESS_KEY_ID");
  },
  get s3SecretAccessKey(): string {
    return required("S3_SECRET_ACCESS_KEY");
  },
  /**
   * Public base for objects that are world-readable (a CDN or website
   * endpoint). When unset, reads fall back to a signed URL.
   */
  get s3PublicBaseUrl(): string | null {
    return process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? null;
  },
  /**
   * La llave del panel de administración (`/admin`). No hay cuenta ni correo
   * detrás: quien la escribe entra, así que es un secreto de operación, no una
   * credencial de persona. Es opcional a propósito — sin ella el panel no
   * existe, que es lo que corresponde en un entorno donde nadie lo va a usar.
   */
  get adminKey(): string | null {
    return process.env.ADMIN_KEY?.trim() || null;
  },
  /** Resend, which is what sends every transactional mail. */
  get resendApiKey(): string {
    return required("RESEND_API_KEY");
  },
  /**
   * The envelope sender. It has to live on the domain verified in Resend —
   * `email.t-share.org`, a subdomain, so the DKIM and SPF records for it do
   * not touch the MX of the main domain and the team keeps reading mail at
   * t-share.org as always.
   */
  get mailFrom(): string {
    return process.env.RESEND_EMAIL_ADDRESS ?? "comunidad@email.t-share.org";
  },
  get mailFromName(): string {
    return process.env.MAIL_FROM_NAME ?? "T-share";
  },
  /**
   * Where an answer should land. The sending subdomain has no inbox, so a
   * teacher who hits "responder" would be writing into a void; this points
   * them at the mailbox somebody actually reads.
   */
  get mailReplyTo(): string {
    return process.env.MAIL_REPLY_TO ?? "comunidad@t-share.org";
  },
  /**
   * The canonical origin, used to build the links inside an email — a request
   * host cannot be trusted for that, and a Server Action has no URL of its own.
   */
  get appUrl(): string {
    return (process.env.APP_URL ?? "https://t-share.org").replace(/\/$/, "");
  },
} as const;

/** True when the app has enough configuration to reach Supabase. */
export function hasDatabaseConfig(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** True when uploads can be written to S3. */
export function hasStorageConfig(): boolean {
  return Boolean(
    process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY,
  );
}

/** True when the admin panel is enabled in this environment. */
export function hasAdminConfig(): boolean {
  return Boolean(process.env.ADMIN_KEY?.trim());
}

/** True when mail can actually leave the machine. */
export function hasEmailConfig(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
