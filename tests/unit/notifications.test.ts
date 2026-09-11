import { beforeAll, describe, expect, it } from "vitest";
import {
  accessLinkMessage,
  activityCommentedMessage,
  passwordResetMessage,
  welcomeMessage,
} from "@/lib/notifications";

/**
 * The emails the app sends: three carried over from the Laravel
 * notifications, plus the access link.
 *
 * The subjects of the first three are the part worth pinning: they are word
 * for word what `WelcomeUser`, `PasswordReset` and `ActividadComentada` sent,
 * so a teacher's existing inbox filters keep matching. The rest checks that
 * both parts of a message come out of the same render — a link points at the
 * configured origin rather than at whatever host answered the request, and
 * the plain-text alternative is not empty — and that a name with an angle
 * bracket cannot inject markup.
 */

beforeAll(() => {
  process.env.APP_URL = "https://t-share.org";
});

describe("welcomeMessage", () => {
  it("keeps the subject the old app used", async () => {
    expect((await welcomeMessage({ name: "Ana" })).subject).toBe("¡Bienvenido a T-share!");
  });

  it("greets by name and links to the activities", async () => {
    const mail = await welcomeMessage({ name: "Ana" });
    expect(mail.text).toContain("¡Hola Ana!");
    expect(mail.html).toContain("https://t-share.org/actividades");
  });
});

describe("passwordResetMessage", () => {
  it("keeps the subject the old app used", async () => {
    expect((await passwordResetMessage({ name: "Ana", token: "abc" })).subject).toBe(
      "Recuperación de contraseña - T-share",
    );
  });

  it("links to the same path the Angular site used", async () => {
    const mail = await passwordResetMessage({ name: "Ana", token: "abc123" });
    expect(mail.text).toContain("https://t-share.org/cambiar-clave?token=abc123");
    expect(mail.html).toContain("https://t-share.org/cambiar-clave?token=abc123");
  });

  it("escapes a token that needs it, so the link survives the trip", async () => {
    const mail = await passwordResetMessage({ name: "Ana", token: "a+b/c=" });
    expect(mail.text).toContain("token=a%2Bb%2Fc%3D");
  });

  it("says the link expires and that ignoring it is safe", async () => {
    const mail = await passwordResetMessage({ name: "Ana", token: "abc" });
    expect(mail.text).toContain("una hora");
    expect(mail.text).toContain("Si no fuiste tú");
  });
});

describe("accessLinkMessage", () => {
  it("opens the route that signs the teacher in", async () => {
    const mail = await accessLinkMessage({ name: "Ana", token: "abc123" });
    expect(mail.subject).toBe("Tu enlace para entrar a T-share");
    expect(mail.text).toContain("https://t-share.org/acceso?token=abc123");
    expect(mail.html).toContain("https://t-share.org/acceso?token=abc123");
  });

  it("says how long it lasts, that it is single use, and what to do if it wasn't you", async () => {
    const mail = await accessLinkMessage({ name: "Ana", token: "abc" });
    expect(mail.text).toContain("30 minutos");
    expect(mail.text).toContain("una sola vez");
    expect(mail.text).toContain("Si no fuiste tú");
  });

  it("promises the password change that /cambiar-password then asks for", async () => {
    const mail = await accessLinkMessage({ name: "Ana", token: "abc" });
    expect(mail.text).toContain("contraseña nueva");
  });
});

describe("activityCommentedMessage", () => {
  const base = {
    authorName: "Ana",
    commenterName: "Pedro",
    activityId: 1076,
    activityTitle: "El post-it positivo",
  };

  it("keeps the subject the old app used", async () => {
    expect((await activityCommentedMessage(base)).subject).toBe(
      "Han comentado tu actividad en T-share",
    );
  });

  it("links straight to the activity", async () => {
    expect((await activityCommentedMessage(base)).html).toContain(
      "https://t-share.org/actividades/detalle/1076",
    );
  });

  it("escapes a title that contains markup", async () => {
    const mail = await activityCommentedMessage({
      ...base,
      activityTitle: '<script>alert("x")</script>',
      commenterName: "Pedro & Co",
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("Pedro &amp; Co");
    // The plain-text part is not markup, so it keeps the title as written.
    expect(mail.text).toContain('<script>alert("x")</script>');
  });
});

describe("every message", () => {
  it("carries the logo and a plain-text alternative", async () => {
    const mail = await welcomeMessage({ name: "Ana" });
    expect(mail.html).toContain("https://t-share.org/brand/tshare-logo-email.png");
    expect(mail.text.length).toBeGreaterThan(80);
    // The text part is text: no tags, and no bare URL standing in for the logo.
    expect(mail.text).not.toContain("<div");
    expect(mail.text.split("\n")[0]).toBe("¡Hola Ana!");
  });
});
