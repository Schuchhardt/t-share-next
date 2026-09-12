import { E2E, expect, requiresDatabase, signIn, signOut, test } from "./fixtures";
import {
  clearLinks,
  linksFor,
  passwordHashOf,
  plantLink,
  resetLoginAttempts,
  restorePassword,
} from "./db";

/**
 * Getting back in without the password: the emailed reset link, and the
 * access link the sign-in form offers after a second wrong try.
 *
 * These drive the real forms against the real database. The mail itself is
 * not asserted — `RESEND_API_KEY` is blanked for the dev server the suite
 * starts, so nothing is actually sent to a `@t-share.test` address that would
 * only bounce. What *is* asserted is the half that broke in production: that
 * asking for a link writes a row of the right kind, and that the routes which
 * consume one do what they promise.
 *
 * `plantLink` stands in for the inbox. The table holds only a SHA-256, so a
 * test cannot read a token back out; it writes one whose clear-text value it
 * already knows instead.
 *
 * What the form is checked against matters here: /recuperar-clave says "te
 * enviamos un enlace" in its *intro* too, so waiting for that would prove
 * nothing and the row would be read while the action was still running. The
 * "carpeta de spam" sentence belongs to the answer alone.
 */

requiresDatabase();

const user = E2E.recoveryUser;

/** The seeded hash, put back after any test that changes the password. */
let seededHash: string;

test.beforeAll(async () => {
  seededHash = await passwordHashOf(user.id);
});

test.beforeEach(async () => {
  await clearLinks(user.id);
  await resetLoginAttempts(user.id);
});

test.afterAll(async () => {
  await restorePassword(user.id, seededHash);
  await clearLinks(user.id);
  await resetLoginAttempts(user.id);
});

test.describe("recuperar la contraseña", () => {
  test("pedir un enlace con un correo registrado deja un token de recuperación", async ({
    page,
  }) => {
    await page.goto("/recuperar-clave");
    await page.getByLabel("Correo").fill(user.email);
    await page.getByRole("button", { name: /Enviar/i }).click();

    await expect(page.getByText(/carpeta de spam/i)).toBeVisible();

    // The part that was answering 500: the insert has to land.
    const links = await linksFor(user.id);
    expect(links).toHaveLength(1);
    expect(links[0]!.purpose).toBe("password_reset");
    expect(links[0]!.used_at).toBeNull();
  });

  test("un correo desconocido dice exactamente lo mismo y no deja nada", async ({ page }) => {
    await page.goto("/recuperar-clave");
    await page.getByLabel("Correo").fill("no.existe@t-share.test");
    await page.getByRole("button", { name: /Enviar/i }).click();

    await expect(page.getByText(/carpeta de spam/i)).toBeVisible();
    expect(await linksFor(user.id)).toHaveLength(0);
  });

  test("pedir dos veces deja servible solo el último enlace", async ({ page }) => {
    const viejo = await plantLink(user.id, "password_reset", 60);

    await page.goto("/recuperar-clave");
    await page.getByLabel("Correo").fill(user.email);
    await page.getByRole("button", { name: /Enviar/i }).click();
    await expect(page.getByText(/carpeta de spam/i)).toBeVisible();

    await page.goto(`/cambiar-clave?token=${encodeURIComponent(viejo)}`);
    await expect(page.getByRole("heading", { name: "Enlace no válido" })).toBeVisible();
  });

  test("el enlace deja elegir una contraseña nueva, y con ella se entra", async ({ page }) => {
    const token = await plantLink(user.id, "password_reset", 60);
    const nueva = `clave-recuperada-${Date.now()}`;

    await page.goto(`/cambiar-clave?token=${encodeURIComponent(token)}`);
    await page.getByLabel("Contraseña nueva", { exact: true }).fill(nueva);
    await page.getByLabel("Repite la contraseña nueva").fill(nueva);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();

    // It deliberately does not sign them in: they prove the new password works.
    await expect(page).toHaveURL(/\/entrar\?password=cambiada$/);

    await signIn(page, user.email, nueva);
    await expect(page).toHaveURL(/\/actividades$/);
  });

  test("un enlace ya usado lo dice antes de pedir nada", async ({ page }) => {
    const token = await plantLink(user.id, "password_reset", 60);
    const nueva = `clave-recuperada-${Date.now()}`;

    await page.goto(`/cambiar-clave?token=${encodeURIComponent(token)}`);
    await page.getByLabel("Contraseña nueva", { exact: true }).fill(nueva);
    await page.getByLabel("Repite la contraseña nueva").fill(nueva);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page).toHaveURL(/\/entrar\?password=cambiada$/);

    await page.goto(`/cambiar-clave?token=${encodeURIComponent(token)}`);
    await expect(page.getByRole("heading", { name: "Enlace no válido" })).toBeVisible();
    await expect(page.getByText(/ya se usó/)).toBeVisible();
  });

  test("un enlace vencido lo dice antes de pedir nada", async ({ page }) => {
    const token = await plantLink(user.id, "password_reset", -1);

    await page.goto(`/cambiar-clave?token=${encodeURIComponent(token)}`);
    await expect(page.getByRole("heading", { name: "Enlace no válido" })).toBeVisible();
    await expect(page.getByText(/venció/)).toBeVisible();
  });
});

test.describe("enlace de acceso tras dos intentos fallidos", () => {
  test("al primer error no manda nada; al segundo deja un enlace de acceso", async ({ page }) => {
    await signIn(page, user.email, "no-es-la-clave-1");
    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
    expect(await linksFor(user.id, "access_link")).toHaveLength(0);

    await signIn(page, user.email, "no-es-la-clave-2");
    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();

    // The send runs in `after()`, so the row lands just behind the response.
    await expect
      .poll(async () => (await linksFor(user.id, "access_link")).length, { timeout: 10_000 })
      .toBe(1);
  });

  test("a la segunda el formulario avisa que revise el correo, sin decir si la cuenta existe", async ({
    page,
  }) => {
    await signIn(page, user.email, "no-es-la-clave-1");
    await page.getByLabel("Contraseña", { exact: true }).fill("no-es-la-clave-2");
    await page.getByRole("button", { name: "Entrar" }).click();

    const aviso = page.getByText(/Si existe una cuenta con ese correo/);
    await expect(aviso).toBeVisible();

    // The same wording for an address nobody registered.
    await page.goto("/entrar");
    await page.getByLabel("Correo").fill("no.existe@t-share.test");
    await page.getByLabel("Contraseña", { exact: true }).fill("no-es-la-clave-1");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.getByLabel("Contraseña", { exact: true }).fill("no-es-la-clave-2");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText(/Si existe una cuenta con ese correo/)).toBeVisible();
  });

  test("mientras haya un enlace vivo no se manda otro", async ({ page }) => {
    await plantLink(user.id, "access_link", 30);

    for (const clave of ["no-es-la-clave-1", "no-es-la-clave-2", "no-es-la-clave-3"]) {
      await signIn(page, user.email, clave);
      await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
    }

    // Asserting that nothing happened needs a moment to pass: the send runs
    // in `after()`, behind the response the assertions above waited for.
    await page.waitForTimeout(2_000);
    expect(await linksFor(user.id, "access_link")).toHaveLength(1);
  });

  test("el enlace entra y pide una contraseña nueva sin preguntar la anterior", async ({
    page,
  }) => {
    const token = await plantLink(user.id, "access_link", 30);
    const nueva = `clave-por-enlace-${Date.now()}`;

    await page.goto(`/acceso?token=${encodeURIComponent(token)}`);
    await expect(page).toHaveURL(/\/cambiar-password$/);

    // The whole point: they are here because they do not have the old one.
    await expect(page.getByLabel("Tu contraseña anterior")).toHaveCount(0);
    await expect(page.getByText(/Entraste con el enlace/)).toBeVisible();

    await page.getByLabel("Contraseña nueva", { exact: true }).fill(nueva);
    await page.getByLabel("Repite la contraseña nueva").fill(nueva);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();

    await expect(page).toHaveURL(/\/actividades$/);

    // And the new password is the one that works from now on.
    await signOut(page);
    await signIn(page, user.email, nueva);
    await expect(page).toHaveURL(/\/actividades$/);
  });

  test("hasta cambiarla, el enlace no deja pasar a otra pantalla", async ({ page }) => {
    const token = await plantLink(user.id, "access_link", 30);

    await page.goto(`/acceso?token=${encodeURIComponent(token)}`);
    await expect(page).toHaveURL(/\/cambiar-password$/);

    await page.goto("/actividades");
    await expect(page).toHaveURL(/\/cambiar-password$/);
    await page.goto("/mi-perfil");
    await expect(page).toHaveURL(/\/cambiar-password$/);
  });

  test("el enlace se gasta al abrirlo, aunque no se llegue a cambiar nada", async ({ page }) => {
    const token = await plantLink(user.id, "access_link", 30);

    await page.goto(`/acceso?token=${encodeURIComponent(token)}`);
    await expect(page).toHaveURL(/\/cambiar-password$/);

    await page.context().clearCookies();
    await page.goto(`/acceso?token=${encodeURIComponent(token)}`);
    await expect(page).toHaveURL(/\/entrar\?acceso=used$/);
    await expect(page.getByText(/ya se usó/)).toBeVisible();
  });

  test("un enlace vencido manda a entrar y lo explica", async ({ page }) => {
    const token = await plantLink(user.id, "access_link", -1);

    await page.goto(`/acceso?token=${encodeURIComponent(token)}`);
    await expect(page).toHaveURL(/\/entrar\?acceso=expired$/);
    await expect(page.getByText(/venció/)).toBeVisible();
  });

  test("un token de recuperación no sirve para entrar, y al revés tampoco", async ({ page }) => {
    const reset = await plantLink(user.id, "password_reset", 60);
    await page.goto(`/acceso?token=${encodeURIComponent(reset)}`);
    await expect(page).toHaveURL(/\/entrar\?acceso=unknown$/);

    const acceso = await plantLink(user.id, "access_link", 30);
    await page.goto(`/cambiar-clave?token=${encodeURIComponent(acceso)}`);
    await expect(page.getByRole("heading", { name: "Enlace no válido" })).toBeVisible();
  });
});
