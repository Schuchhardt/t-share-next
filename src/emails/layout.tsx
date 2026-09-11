import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { SITE } from "@/lib/site";

/**
 * The shell every T-share email shares: the logo, a heading, the body, an
 * optional button and the footer.
 *
 * Written as a React Email component rather than a template string so the
 * HTML and the plain-text part come out of the same source — `@/lib/email`
 * renders it twice — and so React escapes anything a teacher typed. The old
 * builders concatenated markup and escaped by hand, which is one forgotten
 * call away from an activity title closing a tag.
 *
 * Styles stay inline objects because that is the only thing mail clients
 * agree on: no stylesheet, no class names, no custom properties. The values
 * below are the same palette `globals.css` defines for the site.
 */

const brand = {
  ink: "#2b2a55",
  indigo: "#3d3b96",
  body: "#4a4870",
  muted: "#6e6c8f",
  line: "#e2e1f0",
  canvas: "#f7f7fd",
  white: "#ffffff",
} as const;

const font =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const styles = {
  body: { margin: 0, padding: "24px 12px", backgroundColor: brand.canvas, fontFamily: font },
  card: {
    maxWidth: "560px",
    margin: "0 auto",
    backgroundColor: brand.white,
    border: `1px solid ${brand.line}`,
    borderRadius: "8px",
    padding: "32px",
  },
  logo: { display: "block", margin: "0 0 28px" },
  heading: {
    margin: "0 0 16px",
    fontSize: "22px",
    lineHeight: "1.25",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: brand.ink,
  },
  text: { margin: "0 0 16px", fontSize: "15px", lineHeight: "1.6", color: brand.body },
  button: {
    display: "inline-block",
    backgroundColor: brand.indigo,
    color: brand.white,
    fontSize: "15px",
    fontWeight: 700,
    textDecoration: "none",
    padding: "13px 24px",
    borderRadius: "4px",
  },
  fallback: { margin: "12px 0 0", fontSize: "13px", lineHeight: "1.6", color: brand.muted },
  url: { color: brand.indigo, wordBreak: "break-all" as const },
  note: { margin: "16px 0 0", fontSize: "13px", lineHeight: "1.6", color: brand.muted },
  rule: { margin: "28px 0 20px", border: "none", borderTop: `1px solid ${brand.line}` },
  footer: { margin: 0, fontSize: "13px", lineHeight: "1.6", color: brand.muted },
  footerLink: { color: brand.indigo },
} as const;

export type EmailLayoutProps = {
  /** The line the inbox shows next to the subject. */
  preview: string;
  heading: string;
  children: React.ReactNode;
  cta?: { label: string; url: string };
  /** Smaller print under the button — an expiry, or what to do if it wasn't you. */
  note?: React.ReactNode;
  /** Absolute origin for the logo and the links. */
  appUrl: string;
};

export function EmailLayout({
  preview,
  heading,
  children,
  cta,
  note,
  appUrl,
}: EmailLayoutProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.card}>
          {/* `id` is what the plain-text pass keys off to drop the logo. */}
          <Link href={appUrl} id="logo">
            <Img
              src={`${appUrl}/brand/tshare-logo-email.png`}
              alt="T-share"
              width="84"
              height="101"
              style={styles.logo}
            />
          </Link>

          <Heading as="h1" style={styles.heading}>
            {heading}
          </Heading>

          {children}

          {cta && (
            <Section style={{ margin: "24px 0 0" }}>
              <Button href={cta.url} style={styles.button}>
                {cta.label}
              </Button>
              <Text style={styles.fallback}>
                Si el botón no funciona, copia esta dirección en tu navegador:
                <br />
                <Link href={cta.url} style={styles.url}>
                  {cta.url}
                </Link>
              </Text>
            </Section>
          )}

          {note && <Text style={styles.note}>{note}</Text>}

          <Hr style={styles.rule} />
          <Text style={styles.footer}>
            {SITE.company} ·{" "}
            <Link href={`mailto:${SITE.email}`} style={styles.footerLink}>
              {SITE.email}
            </Link>
            <br />
            Este correo se envía automáticamente; puedes responderlo si necesitas ayuda.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/** A body paragraph, so every email spaces its text the same way. */
export function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.text}>{children}</Text>;
}

export { brand, styles };
