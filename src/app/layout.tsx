import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/auth/session";
import {
  SITE_DESCRIPTION,
  SITE_TAGLINE,
  SITE_TITLE,
  organizationJsonLd,
  siteUrl,
  websiteJsonLd,
} from "@/lib/seo";

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
  // `APP_URL`, so a deployment's canonicals and social images point at the
  // host actually serving them. In production it is https://t-share.org.
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_TITLE, template: "%s · T-share" },
  description: SITE_DESCRIPTION,
  applicationName: "T-share",
  // The icon and the social preview come from `icon.svg`, `apple-icon.png` and
  // `opengraph-image.tsx` in this directory. An activity adds its own.
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "T-share",
    title: SITE_TAGLINE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TAGLINE,
    description: SITE_DESCRIPTION,
  },
  // The repository is public and meant to be found; the private screens turn
  // this off one by one.
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  formatDetection: { telephone: false },
};

/** Matches the indigo the header and the buttons are painted in. */
export const viewport: Viewport = {
  themeColor: "#363795",
  colorScheme: "light",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read once here rather than in every screen; the header is the only part of
  // the chrome that changes with who is signed in.
  const session = await getSession();

  return (
    <html lang="es" className={`${raleway.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* Who publishes the site and how its search works — the same two
            entities on every page, which the per-page graphs point back to. */}
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        <SiteHeader user={session ? { name: session.name } : null} />
        <main className="mx-auto w-full max-w-[1060px] px-7 pb-30">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
