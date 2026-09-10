import { E2E, expect, requiresDatabase, signIn, signOut, test } from "./fixtures";

/**
 * The migration's user-facing promise: a teacher signs in with the password
 * they had on the old Laravel site, and is then made to choose a new one
 * before they can do anything else.
 */

requiresDatabase();

test.describe("sign in", () => {
  test("a migrated account signs in with its old password and is sent to the reset screen", async ({
    page,
  }) => {
    await signIn(page, E2E.legacyUser.email, E2E.legacyUser.password);

    await expect(page).toHaveURL(/\/cambiar-password$/);
    await expect(page.getByRole("heading", { name: "Elige una contraseña nueva" })).toBeVisible();
  });

  test("a migrated account cannot slip past the reset screen", async ({ page }) => {
    await signIn(page, E2E.legacyUser.email, E2E.legacyUser.password);
    await expect(page).toHaveURL(/\/cambiar-password$/);

    // Every other screen bounces back until the password is replaced.
    await page.goto("/actividades");
    await expect(page).toHaveURL(/\/cambiar-password$/);
    await page.goto("/mi-perfil");
    await expect(page).toHaveURL(/\/cambiar-password$/);
  });

  test("setting a new password releases the account, and the new password works", async ({
    page,
  }) => {
    const nuevaClave = `clave-migrada-${Date.now()}`;

    await signIn(page, E2E.legacyUser.email, E2E.legacyUser.password);
    await page.getByLabel("Tu contraseña anterior").fill(E2E.legacyUser.password);
    await page.getByLabel("Contraseña nueva", { exact: true }).fill(nuevaClave);
    await page.getByLabel("Repite la contraseña nueva").fill(nuevaClave);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();

    await expect(page).toHaveURL(/\/actividades$/);

    await signOut(page);
    await signIn(page, E2E.legacyUser.email, nuevaClave);
    // No detour this time.
    await expect(page).toHaveURL(/\/actividades$/);

    // And the old password no longer opens the door.
    await signOut(page);
    await signIn(page, E2E.legacyUser.email, E2E.legacyUser.password);
    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
  });

  test("an account this app created signs in without a detour", async ({ page }) => {
    await signIn(page, E2E.modernUser.email, E2E.modernUser.password);
    await expect(page).toHaveURL(/\/actividades$/);
    await expect(page.getByRole("link", { name: /Nadia/ })).toBeVisible();
  });

  test("a wrong password says the same thing as an unknown address", async ({ page }) => {
    await signIn(page, E2E.modernUser.email, "no-es-la-clave-1");
    const wrongPassword = await page.getByText("Correo o contraseña incorrectos.").textContent();

    await signIn(page, "nadie@t-share.test", "no-es-la-clave-1");
    await expect(page.getByText("Correo o contraseña incorrectos.")).toHaveText(
      wrongPassword ?? "",
    );
  });

  test("signing in returns to the page that asked for it", async ({ page }) => {
    await page.goto("/actividades/crear");
    await expect(page).toHaveURL(/\/entrar\?next=%2Factividades%2Fcrear$/);

    await page.getByLabel("Correo").fill(E2E.modernUser.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(E2E.modernUser.password);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/actividades\/crear$/);
  });
});

test.describe("access", () => {
  test("the screens that need an account redirect a visitor", async ({ page }) => {
    for (const path of ["/mi-perfil", "/actividades/crear"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/entrar\?next=/);
    }
  });

  test("the public screens do not", async ({ page }) => {
    for (const path of ["/", "/actividades"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : path}`));
    }
  });
});

test.describe("sign up", () => {
  test("rejects a weak password before creating anything", async ({ page }) => {
    await page.goto("/registro");
    await page.getByLabel("Nombre", { exact: true }).fill("Prueba");
    await page.getByLabel("Correo").fill(`nuevo-${Date.now()}@t-share.test`);
    await page.getByLabel("Contraseña", { exact: true }).fill("corta");
    await page.getByLabel("Repite la contraseña").fill("corta");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page.getByText(/al menos 10 caracteres/i)).toBeVisible();
    await expect(page).toHaveURL(/\/registro$/);
  });

  test("refuses an address that already exists", async ({ page }) => {
    await page.goto("/registro");
    await page.getByLabel("Nombre", { exact: true }).fill("Prueba");
    await page.getByLabel("Correo").fill(E2E.modernUser.email);
    await page.getByLabel("Contraseña", { exact: true }).fill("una-clave-larga-1");
    await page.getByLabel("Repite la contraseña").fill("una-clave-larga-1");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page.getByText(/Ya existe una cuenta/)).toBeVisible();
  });
});
