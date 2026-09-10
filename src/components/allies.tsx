import Image from "next/image";
import { ALLIES } from "@/lib/site";

/**
 * The partner logos from the old landing page. The logos come in wildly
 * different aspect ratios, so each one sits in a fixed box and is capped by
 * height — the same way the previous site laid them out.
 */
export function Allies() {
  return (
    <section className="mt-20">
      <div className="section-rule pb-2.5">
        <h2 className="eyebrow">Nuestros aliados</h2>
      </div>

      <p className="mt-5 max-w-[52ch] text-[19px] leading-[1.4] font-semibold text-pretty text-ink sm:text-[22px]">
        Múltiples organizaciones con fines educativos ya se han sumado a T-share.
      </p>
      <p className="mt-2.5 max-w-[56ch] text-[17px] leading-[1.55] text-pretty text-muted">
        Conócelas y tú también promueve la creación y el acceso a prácticas pedagógicas
        innovadoras.
      </p>

      <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ALLIES.map((ally) => {
          const logo = (
            <Image
              src={ally.src}
              alt={ally.name}
              width={ally.width}
              height={ally.height}
              className="h-auto max-h-[68px] w-auto max-w-full object-contain"
            />
          );

          return (
            <li
              key={ally.name}
              className="flex h-[110px] items-center justify-center rounded-sm border border-line px-5 py-4"
            >
              {ally.href ? (
                <a href={ally.href} target="_blank" rel="noreferrer noopener">
                  {logo}
                </a>
              ) : (
                logo
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
