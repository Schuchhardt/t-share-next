"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { initials } from "@/lib/types";

const PUBLIC_NAV = [
  { href: "/", label: "Inicio" },
  { href: "/actividades", label: "Actividades" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * `user` comes from the layout, which reads the session cookie on the server.
 * The header itself is a client component only because it highlights the
 * active link from the pathname.
 */
export function SiteHeader({ user }: { user: { name: string } | null }) {
  const pathname = usePathname();
  const nav = user ? [...PUBLIC_NAV, { href: "/mi-perfil", label: "Mis actividades" }] : PUBLIC_NAV;

  const linkClass = (active: boolean) =>
    `border-b-2 px-3 py-2 text-[15px] no-underline transition-colors hover:text-indigo hover:no-underline ${
      active ? "border-green font-semibold text-ink" : "border-transparent font-normal text-muted"
    }`;

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-7 gap-y-3 border-b border-line bg-white/95 px-7 py-3 backdrop-blur-md">
      <Link href="/" aria-label="T-share — ir al inicio" className="shrink-0">
        <Image
          src="/brand/tshare-logo.svg"
          alt="T-share"
          width={42}
          height={42}
          priority
          className="h-[42px] w-auto"
        />
      </Link>

      <nav className="flex flex-1 gap-0.5" aria-label="Principal">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={linkClass(isActive(pathname, item.href))}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {user ? (
        <>
          <Link
            href="/actividades/crear"
            className="rounded-sm bg-green px-[18px] py-2.5 text-[15px] font-semibold text-green-ink no-underline transition-colors hover:bg-green-hover hover:text-green-ink hover:no-underline"
          >
            Subir actividad
          </Link>

          <Link
            href="/mi-perfil"
            className="flex items-center gap-[9px] text-sm text-muted no-underline hover:text-ink hover:no-underline"
          >
            <span className="flex size-[30px] items-center justify-center rounded-full bg-lav text-[13px] font-semibold text-indigo">
              {initials(user.name)}
            </span>
            {user.name.split(" ")[0]}
          </Link>

          <form action={signOut}>
            <button
              type="submit"
              className="border-none bg-transparent p-0 text-sm text-muted hover:text-ink"
            >
              Salir
            </button>
          </form>
        </>
      ) : (
        <>
          <Link
            href="/entrar"
            className="text-[15px] text-muted no-underline hover:text-ink hover:no-underline"
          >
            Entrar
          </Link>
          <Link
            href="/registro"
            className="rounded-sm bg-green px-[18px] py-2.5 text-[15px] font-semibold text-green-ink no-underline transition-colors hover:bg-green-hover hover:text-green-ink hover:no-underline"
          >
            Crear cuenta
          </Link>
        </>
      )}
    </header>
  );
}
