import Image from "next/image";

/**
 * The six steps from the previous landing page, with the icon set the designer
 * drew for them (`new-landing/Iconos Como Funciona` in the old repo). The
 * artwork is a fixed indigo outline over a coloured offset, so it is used as-is
 * rather than recoloured from the theme.
 */
const STEPS = [
  {
    icon: "encuentra",
    title: "Encuentra",
    text: "Y personaliza planificaciones didácticas.",
  },
  {
    icon: "crea",
    title: "Crea",
    text: "Actividades y recursos que apoyen el trabajo en aula.",
  },
  {
    icon: "digitaliza",
    title: "Digitaliza",
    text: "Tus clases y portafolio docente.",
  },
  {
    icon: "retroalimenta",
    title: "Retroalimenta",
    text: "Y comparte tu experiencia en clases.",
  },
  {
    icon: "edita",
    title: "Edita",
    text: "Las actividades para una mejora continua.",
  },
  {
    icon: "gana",
    title: "Gana",
    text: "Reconocimiento por tu trabajo.",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="mt-20">
      <div className="section-rule pb-2.5">
        <h2 className="eyebrow">¿Cómo funciona?</h2>
      </div>

      <ul className="mt-9 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.icon}>
            <Image
              src={`/como-funciona/${step.icon}.svg`}
              alt=""
              width={72}
              height={72}
              className="h-[72px] w-auto"
            />
            <h3 className="mt-3.5 text-[15px] font-bold tracking-[0.06em] text-indigo uppercase">
              {step.title}
            </h3>
            <p className="mt-1.5 max-w-[34ch] text-[16px] leading-[1.5] text-pretty text-muted">
              {step.text}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
