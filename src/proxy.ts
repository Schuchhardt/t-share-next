import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/token";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

/**
 * Request proxy (what Next.js called middleware before 16.3).
 *
 * Two jobs, both cheap enough to do before a page renders:
 *
 *  1. Keep signed-out visitors out of the screens that need an account.
 *  2. Hold a migrated teacher on /cambiar-password until this app has written
 *     its own password hash for them. The flag travels in the session token,
 *     so this costs a signature check rather than a database round-trip.
 *
 * El panel de administración se resuelve antes que nada y por su cuenta: usa
 * otra cookie, no tiene nada que ver con la sesión de un profesor, y no debe
 * heredar ninguna de las reglas de abajo — a un admin no se le manda a cambiar
 * la contraseña de nadie.
 *
 * The token is verified with `jose`, which runs in the Edge runtime; nothing
 * here imports the Supabase client or bcrypt.
 */

/** Screens that require an account. */
const PROTECTED = ["/mi-perfil", "/actividades/crear", "/cambiar-password"];

/** Screens a signed-in teacher has no reason to see. */
const GUEST_ONLY = ["/entrar", "/registro"];

const CHANGE_PASSWORD = "/cambiar-password";

/**
 * The screens an emailed link opens. A migrated teacher who is being held on
 * /cambiar-password may well be there because they do not remember the old
 * password either — bouncing them off their own reset or access link would
 * leave them with no way out.
 */
const EMAIL_LINKS = ["/recuperar-clave", "/cambiar-clave", "/acceso"];

/** El panel, y la única pantalla suya a la que se entra sin haber entrado. */
const ADMIN = "/admin";
const ADMIN_SIGN_IN = "/admin/entrar";

function matches(pathname: string, routes: string[]): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (matches(pathname, [ADMIN])) {
    return adminProxy(request, pathname, search);
  }

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    if (matches(pathname, PROTECTED)) {
      const url = new URL("/entrar", request.url);
      url.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (
    session.mustChangePassword &&
    pathname !== CHANGE_PASSWORD &&
    !matches(pathname, EMAIL_LINKS)
  ) {
    return NextResponse.redirect(new URL(CHANGE_PASSWORD, request.url));
  }

  if (!session.mustChangePassword && pathname === CHANGE_PASSWORD) {
    // Nothing to force any more; let them change it from the profile instead.
    return NextResponse.next();
  }

  if (matches(pathname, GUEST_ONLY)) {
    return NextResponse.redirect(new URL("/actividades", request.url));
  }

  return NextResponse.next();
}

/**
 * El panel. Sin `ADMIN_KEY` en el entorno `verifyAdminToken` devuelve null
 * siempre, así que todo `/admin` termina en la pantalla de la llave y esa
 * pantalla dice que no está habilitado: quitar la variable apaga el panel.
 */
async function adminProxy(request: NextRequest, pathname: string, search: string) {
  const admin = await verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value);

  if (pathname === ADMIN_SIGN_IN) {
    return admin ? NextResponse.redirect(new URL(ADMIN, request.url)) : NextResponse.next();
  }
  if (!admin) {
    const url = new URL(ADMIN_SIGN_IN, request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next's own assets, the generated icon and social-preview
  // routes, and the files served straight from /public, so a redirect never
  // fires on a font or an image request.
  matcher: [
    "/((?!_next/static|_next/image|icon.svg|apple-icon.png|opengraph-image|brand|fonts|aliados|como-funciona).*)",
  ],
};
