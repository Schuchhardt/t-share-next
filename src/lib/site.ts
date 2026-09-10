/**
 * Everything about the organisation behind the site: the text and links that
 * live in the footer, and the partner logos on the landing page.
 *
 * All of it was carried over from the previous Angular site
 * (`landing.component.html`), which is the only place this content existed.
 */

export const SITE = {
  company: "EDTEK SpA",
  email: "comunidad@t-share.org",
  address: "General del Canto 50, of. 301, Providencia",
  city: "Santiago, Chile",
} as const;

export const SOCIAL = [
  { name: "Facebook", href: "https://facebook.com/tshare.org" },
  { name: "Instagram", href: "https://instagram.com/tshareorg" },
] as const;

export type Ally = {
  name: string;
  /** Path under `public/aliados`. */
  src: string;
  /** Intrinsic size, so `next/image` can reserve the space before it loads. */
  width: number;
  height: number;
  /** The organisation's own site. `null` until someone confirms the URL. */
  href: string | null;
};

/** Ordered as they were shown on the old landing page. */
export const ALLIES: Ally[] = [
  { name: "Odisea", src: "/aliados/odisea.png", width: 400, height: 200, href: null },
  { name: "Aula 42", src: "/aliados/aula42.png", width: 331, height: 400, href: null },
  { name: "Intar 21", src: "/aliados/intar21.png", width: 387, height: 400, href: null },
  { name: "Kyklos", src: "/aliados/kyklos.png", width: 400, height: 200, href: null },
  { name: "N-Lab", src: "/aliados/n-lab.png", width: 400, height: 183, href: null },
  { name: "Futuro Colega", src: "/aliados/futurocolega.png", width: 377, height: 400, href: null },
  { name: "Kimün", src: "/aliados/kimun.png", width: 400, height: 301, href: null },
  {
    name: "Fundación Un Alto en el Desierto",
    src: "/aliados/un-alto-en-el-desierto.png",
    width: 400,
    height: 227,
    href: null,
  },
];
