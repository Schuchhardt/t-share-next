/**
 * Where an account action sends the teacher when it is done.
 *
 * Three screens post a `next`: sign-in carries the page that bounced them to
 * it, and the password change carries either nothing (the forced screen, which
 * has no such field) or the profile that opened it.
 *
 * Two things to get right. `formData.get` answers **null** for a field the
 * form does not have, so null has to mean "the default" rather than blow up —
 * that is what broke the forced migration screen once. And the value comes
 * from a query string a stranger can write, so only same-origin paths are
 * honoured: `//evil.com` is a protocol-relative URL that a browser follows off
 * this site, and it starts with a slash like any other path.
 */

export const DEFAULT_NEXT = "/actividades";

export function safeNext(next: string | null | undefined): string {
  if (!next) return DEFAULT_NEXT;
  if (!next.startsWith("/")) return DEFAULT_NEXT;
  // `//host` and `/\host` both leave the origin.
  if (next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_NEXT;
  return next;
}
