import { NextResponse, type NextRequest } from "next/server";
import { findAccessLink, markTokenUsed } from "@/lib/auth/reset";
import { sessionCookie } from "@/lib/auth/session";
import { findAccountById, recordLogin } from "@/lib/users";

/**
 * The emailed access link: `/acceso?token=…`.
 *
 * `signIn` mails it after a second wrong password. Opening it signs the
 * teacher in and drops them on /cambiar-password, where the "contraseña
 * actual" field is not shown — the link is what proved who they are, and if
 * they knew the old password they would not be here.
 *
 * A route handler rather than a page because this has to write a cookie, and
 * a Server Component render cannot. The token is spent before the session is
 * handed out, so a link that is forwarded, logged by a mail scanner or left
 * in someone's history is already dead.
 */

/** Where a link that no longer works sends the teacher, and what to tell them. */
function reject(request: NextRequest, reason: string) {
  const url = new URL("/entrar", request.url);
  url.searchParams.set("acceso", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const lookup = await findAccessLink(token);
  if (!lookup.ok) return reject(request, lookup.reason);

  const account = await findAccountById(lookup.userId);
  if (!account || account.deleted_at) return reject(request, "unknown");

  await markTokenUsed(lookup.rowId);

  const response = NextResponse.redirect(new URL("/cambiar-password", request.url));
  const cookie = await sessionCookie({
    userId: account.id,
    email: account.email,
    name: [account.first_name, account.last_name].filter(Boolean).join(" ").trim() || account.email,
    // They are in, but not done: the proxy holds them on /cambiar-password
    // until this app has a hash they chose.
    mustChangePassword: true,
    viaAccessLink: true,
  });
  response.cookies.set(cookie);

  // Also zeroes `login_attempts`, so the failures that earned this link do
  // not count towards the next one.
  await recordLogin(account.id);

  return response;
}
