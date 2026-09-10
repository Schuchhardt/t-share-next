import { beforeAll, describe, expect, it } from "vitest";
import {
  activityCommentedMessage,
  passwordResetMessage,
  welcomeMessage,
} from "@/lib/notifications";

/**
 * The three emails carried over from the Laravel notifications.
 *
 * The subjects are the part worth pinning: they are word for word what
 * `WelcomeUser`, `PasswordReset` and `ActividadComentada` sent, so a teacher's
 * existing inbox filters keep matching. The rest checks that a link points at
 * the configured origin — not at whatever host answered the request — and that
 * a name with an apostrophe or an angle bracket cannot inject markup.
 */

beforeAll(() => {
  process.env.APP_URL = "https://t-share.org";
});

describe("welcomeMessage", () => {
  it("keeps the subject the old app used", () => {
    expect(welcomeMessage({ name: "Ana" }).subject).toBe("¡Bienvenido a T-share!");
  });

  it("greets by name and links to the activities", () => {
    const mail = welcomeMessage({ name: "Ana" });
    expect(mail.text).toContain("¡Hola Ana!");
    expect(mail.html).toContain("https://t-share.org/actividades");
  });
});

describe("passwordResetMessage", () => {
  it("keeps the subject the old app used", () => {
    expect(passwordResetMessage({ name: "Ana", token: "abc" }).subject).toBe(
      "Recuperación de contraseña - T-share",
    );
  });

  it("links to the same path the Angular site used", () => {
    const mail = passwordResetMessage({ name: "Ana", token: "abc123" });
    expect(mail.text).toContain("https://t-share.org/cambiar-clave?token=abc123");
    expect(mail.html).toContain("https://t-share.org/cambiar-clave?token=abc123");
  });

  it("escapes a token that needs it, so the link survives the trip", () => {
    const mail = passwordResetMessage({ name: "Ana", token: "a+b/c=" });
    expect(mail.text).toContain("token=a%2Bb%2Fc%3D");
  });

  it("says the link expires and that ignoring it is safe", () => {
    const mail = passwordResetMessage({ name: "Ana", token: "abc" });
    expect(mail.text).toContain("una hora");
    expect(mail.text).toContain("Si no fuiste tú");
  });
});

describe("activityCommentedMessage", () => {
  const base = {
    authorName: "Ana",
    commenterName: "Pedro",
    activityId: 1076,
    activityTitle: "El post-it positivo",
  };

  it("keeps the subject the old app used", () => {
    expect(activityCommentedMessage(base).subject).toBe(
      "Han comentado tu actividad en T-share",
    );
  });

  it("links straight to the activity", () => {
    expect(activityCommentedMessage(base).html).toContain(
      "https://t-share.org/actividades/detalle/1076",
    );
  });

  it("escapes a title that contains markup", () => {
    const mail = activityCommentedMessage({
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
