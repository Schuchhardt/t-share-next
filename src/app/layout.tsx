import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/auth/session";

// Self-hosted from the Raleway family the current site already ships.
const raleway = localFont({
  variable: "--font-raleway",
  display: "swap",
  src: [
    { path: "../../public/fonts/Raleway-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/Raleway-Medium.ttf", weight: "500", style: "normal" },
    { path: "../../public/fonts/Raleway-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../../public/fonts/Raleway-Bold.ttf", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://t-share.org"),
  title: {
    default: "T-share · Actividades de clase, listas para usar",
    template: "%s · T-share",
  },
  description:
    "Un repositorio de actividades hechas por profesores. Busca por nivel, asignatura u objetivo de aprendizaje, y descarga los documentos.",
  icons: { icon: "/brand/favicon.png" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "T-share",
    title: "Actividades de clase, listas para usar.",
    description:
      "Un repositorio de actividades hechas por profesores. Busca por nivel, asignatura u objetivo de aprendizaje, y descarga los documentos.",
    images: ["/brand/tshare-logo.svg"],
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read once here rather than in every screen; the header is the only part of
  // the chrome that changes with who is signed in.
  const session = await getSession();

  return (
    <html lang="es" className={`${raleway.variable} h-full antialiased`}>
      <body className="min-h-full">
        <SiteHeader user={session ? { name: session.name } : null} />
        <main className="mx-auto w-full max-w-[1060px] px-7 pb-30">{children}</main>
      </body>
    </html>
  );
}
