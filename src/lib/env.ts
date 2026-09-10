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
  /** SendGrid, which is what the Laravel app sent its mail through. */
  get sendgridApiKey(): string {
    return required("SENDGRID_API_KEY");
  },
  get mailFrom(): string {
    return process.env.MAIL_FROM_ADDRESS ?? "comunidad@t-share.org";
  },
  get mailFromName(): string {
    return process.env.MAIL_FROM_NAME ?? "T-share";
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

/** True when mail can actually leave the machine. */
export function hasEmailConfig(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY);
}
