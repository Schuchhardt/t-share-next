import type { MetadataRoute } from "next";
import { absoluteUrl, siteUrl } from "@/lib/seo";

/**
 * What a crawler may read.
 *
 * The repository is the point of the site, so everything public is open. What
 * is closed is either private (a teacher's own screens) or worthless in an
 * index: the sign-in and password screens, and the upload form, which redirect
 * to `/entrar` for anyone who is not signed in — which is every crawler.
 *
 * `/actividades` stays crawlable with its filters: the results pages carry
 * their own `noindex, follow` when they are a search or a page two, so the
 * links to the activities behind them are still followed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/mi-perfil",
        "/actividades/crear",
        "/entrar",
        "/registro",
        "/recuperar-clave",
        "/cambiar-clave",
        "/cambiar-password",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl(),
  };
}
