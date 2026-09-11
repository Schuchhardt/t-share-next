import Link from "next/link";

export const metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <section className="max-w-[560px] pt-20 pb-10">
      <div className="eyebrow">Error 404</div>
      <h1 className="mt-2 mb-3.5 text-[30px] leading-[1.1] font-bold tracking-[-0.015em] text-ink sm:text-[36px] lg:text-[42px]">
        No encontramos esta página.
      </h1>
      <p className="mb-6 text-[17px] text-pretty text-muted">
        Puede que la actividad se haya movido o que el enlace esté incompleto.
      </p>
      <Link
        href="/actividades"
        className="inline-block rounded-sm bg-indigo px-6 py-[13px] text-[15px] font-semibold text-white no-underline transition-colors hover:bg-ink hover:text-white hover:no-underline"
      >
        Explorar el repositorio
      </Link>
    </section>
  );
}
