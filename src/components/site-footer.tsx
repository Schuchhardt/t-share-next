import Image from "next/image";
import Link from "next/link";
import { SITE, SOCIAL } from "@/lib/site";

const EXPLORE = [
  { href: "/", label: "Inicio" },
  { href: "/actividades", label: "Actividades" },
] as const;

const ACCOUNT = [
  { href: "/entrar", label: "Entrar" },
  { href: "/registro", label: "Crear cuenta" },
  { href: "/actividades/crear", label: "Subir actividad" },
] as const;

/** Brand glyphs, drawn in `currentColor` so they follow the link colour. */
const ICONS: Record<string, string> = {
  Facebook:
    "M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z",
  Instagram:
    "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16ZM12 0C8.74 0 8.33.01 7.05.07c-1.28.06-2.15.26-2.91.56-.79.3-1.46.72-2.13 1.38C1.35 2.68.94 3.35.63 4.14.33 4.9.13 5.77.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.28.26 2.15.56 2.91.3.79.72 1.46 1.38 2.13.67.67 1.34 1.08 2.13 1.38.76.3 1.63.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.28-.06 2.15-.26 2.91-.56.79-.3 1.46-.71 2.13-1.38.67-.67 1.08-1.34 1.38-2.13.3-.76.5-1.63.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.28-.26-2.15-.56-2.91-.3-.79-.71-1.46-1.38-2.13-.67-.67-1.34-1.08-2.13-1.38-.76-.3-1.63-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm7.85-10.41a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0Z",
};

function Column({
  title,
  links,
}: {
  title: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <div>
      <h2 className="eyebrow">{title}</h2>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-[15px] text-muted hover:text-ink">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-row-hover">
      <div className="mx-auto grid w-full max-w-[1060px] gap-10 px-7 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href="/" aria-label="T-share — ir al inicio" className="inline-block">
            <Image
              src="/brand/tshare-logo.svg"
              alt="T-share"
              width={48}
              height={48}
              className="h-12 w-auto"
            />
          </Link>
          <p className="mt-3.5 max-w-[34ch] text-[15px] leading-[1.55] text-pretty text-muted">
            Un repositorio de actividades hechas por profesores, para profesores.
          </p>

          <ul className="mt-4 flex gap-3">
            {SOCIAL.map((account) => (
              <li key={account.name}>
                <a
                  href={account.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`T-share en ${account.name}`}
                  className="flex size-9 items-center justify-center rounded-full bg-lav text-indigo transition-colors hover:bg-lav-hover hover:text-ink"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]">
                    <path fill="currentColor" d={ICONS[account.name]} />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <Column title="Explorar" links={EXPLORE} />
        <Column title="Tu cuenta" links={ACCOUNT} />

        <div>
          <h2 className="eyebrow">Contacto</h2>
          <ul className="mt-3 space-y-2 text-[15px] text-muted">
            <li>
              <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
            </li>
            <li>{SITE.address}</li>
            <li>{SITE.city}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1060px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-7 py-5 text-[13px] text-muted">
          <p>
            © {new Date().getFullYear()} T-share · {SITE.company}. Todos los derechos reservados.
          </p>
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Link href="/terminos" className="text-muted hover:text-ink">
              Términos y condiciones
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/privacidad" className="text-muted hover:text-ink">
              Política de privacidad
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
