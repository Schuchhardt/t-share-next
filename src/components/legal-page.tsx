import type { ReactNode } from "react";

/**
 * Shared layout for the legal documents (`/terminos`, `/privacidad`).
 *
 * Both are long, numbered texts, so they get the same measure, the same
 * heading rhythm and — when there are enough sections to warrant it — an index
 * that jumps to each one.
 */

export type LegalBlock =
  { p: ReactNode } | { list: ReactNode[] } | { table: { head: string[]; rows: ReactNode[][] } };

export type LegalSection = {
  /** Anchor target, also used by the index. */
  id: string;
  title: string;
  body: LegalBlock[];
};

function Block({ block }: { block: LegalBlock }) {
  if ("p" in block) {
    return <p className="mb-3 text-[17px] leading-[1.6] text-pretty text-body">{block.p}</p>;
  }

  if ("list" in block) {
    return (
      <ul className="mb-3 ml-5 list-disc space-y-1.5">
        {block.list.map((item, i) => (
          <li key={i} className="text-[17px] leading-[1.6] text-pretty text-body">
            {item}
          </li>
        ))}
      </ul>
    );
  }

  // Tables carry the data inventories, which are far easier to scan as a grid
  // than as prose. They scroll on their own so the page never does.
  return (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left">
        <thead>
          <tr>
            {block.table.head.map((cell) => (
              <th
                key={cell}
                className="border-b-[1.5px] border-ink pb-2 text-[13px] font-bold tracking-[0.08em] text-muted uppercase"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.table.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`border-b border-line py-3 pr-5 align-top text-[15px] leading-[1.5] text-pretty ${
                    j === 0 ? "font-semibold text-ink" : "text-body"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegalPage({
  eyebrow,
  title,
  updatedAt,
  intro,
  sections,
  showIndex = false,
}: {
  eyebrow: string;
  title: string;
  /** Already formatted, e.g. "10 de septiembre de 2026". */
  updatedAt: string;
  intro: LegalBlock[];
  sections: LegalSection[];
  showIndex?: boolean;
}) {
  return (
    <article className="max-w-[70ch] pt-16 pb-10">
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="mt-2 mb-2.5 text-[28px] leading-[1.15] font-bold tracking-[-0.015em] text-balance text-ink sm:text-[34px]">
        {title}
      </h1>
      <p className="mb-6 text-sm text-muted">Última actualización: {updatedAt}</p>

      {intro.map((block, i) => (
        <Block key={i} block={block} />
      ))}

      {showIndex && (
        <nav aria-label="Contenidos" className="mt-8 rounded-sm bg-lav px-6 py-5">
          <h2 className="eyebrow">Contenidos</h2>
          <ol className="mt-3 space-y-1.5">
            {sections.map((section, i) => (
              <li key={section.id} className="text-[15px] leading-[1.5]">
                <a href={`#${section.id}`}>
                  {i + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {sections.map((section, i) => (
        <section key={section.id} id={section.id} className="mt-9 scroll-mt-24">
          <h2 className="mb-3 text-[19px] leading-snug font-bold text-ink">
            {showIndex ? `${i + 1}. ` : ""}
            {section.title}
          </h2>
          {section.body.map((block, j) => (
            <Block key={j} block={block} />
          ))}
        </section>
      ))}
    </article>
  );
}
