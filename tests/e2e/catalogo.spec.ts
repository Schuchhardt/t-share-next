import { E2E, expect, requiresDatabase, test } from "./fixtures";

/**
 * Browsing: the landing page, search, the facets and one activity's detail.
 * All of it reads Supabase, so these also serve as a smoke test that the
 * migrated schema answers the queries the app makes.
 */

requiresDatabase();

/**
 * The chips on the landing page.
 *
 * Deliberately not `E2E.subject`: the home shows the ten subjects with the
 * most activities behind them (`getSubjectsWithActivities(10)`), and the
 * seeded one has two of more than a thousand, so it will never be among them.
 * Naming it made these tests pass on an empty database and fail on a real
 * one — the opposite of what an end-to-end test is for.
 *
 * Their href is the assertion that matters anyway: it is what says the chips
 * were read from `tshare_subjects` rather than hard-coded.
 */
const chips = (page: import("@playwright/test").Page) =>
  page.locator('a[href^="/actividades?asignatura="]');

test.describe("home", () => {
  test("shows the pitch, the subject chips and recent activities", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Actividades de clase, listas para usar." }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Ver todas \(\d+\)/ })).toBeVisible();

    // Chips, each carrying the id of a real row.
    await expect(chips(page).first()).toBeVisible();
    const count = await chips(page).count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(10);

    // "Agregadas recientemente" lists something, and it links to a detail page.
    await expect(page.locator('a[href^="/actividades/detalle/"]').first()).toBeVisible();
  });

  test("a subject chip lands on that subject's filtered list", async ({ page }) => {
    await page.goto("/");

    const chip = chips(page).first();
    const name = (await chip.textContent())?.trim() ?? "";
    const id = new URL(await chip.getAttribute("href") ?? "", "http://x").searchParams.get(
      "asignatura",
    );
    expect(name).not.toBe("");
    expect(id).toMatch(/^\d+$/);

    await chip.click();

    // The filter the chip set is the one the list came back holding.
    await expect(page).toHaveURL(new RegExp(`/actividades\\?asignatura=${id}$`));
    await expect(page.getByRole("checkbox", { name, exact: true })).toBeChecked();
    await expect(page.locator('a[href^="/actividades/detalle/"]').first()).toBeVisible();
  });

  test("search from the landing page", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Buscar actividades").fill("Actividad E2E de prueba");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/\/actividades\?q=/);
    await expect(page.getByRole("link", { name: E2E.activity.title })).toBeVisible();
  });
});

test.describe("filters", () => {
  test("narrow the list and survive a reload", async ({ page }) => {
    await page.goto("/actividades");
    await page.getByRole("checkbox", { name: E2E.subject.name, exact: true }).check();

    await expect(page).toHaveURL(new RegExp(`asignatura=${E2E.subject.id}`));
    await expect(page.getByRole("link", { name: E2E.activity.title })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("checkbox", { name: E2E.subject.name, exact: true })).toBeChecked();
  });

  test("combine, so an activity has to satisfy every facet", async ({ page }) => {
    await page.goto("/actividades");
    await page.getByRole("checkbox", { name: E2E.subject.name, exact: true }).check();
    await page.getByRole("checkbox", { name: E2E.skill.name }).check();

    // The seed's second activity has the subject but not the skill.
    await expect(page.getByRole("link", { name: E2E.activity.title })).toBeVisible();
    await expect(page.getByRole("link", { name: E2E.quietActivity.title })).toHaveCount(0);
  });

  test("say so when nothing matches, and clear cleanly", async ({ page }) => {
    await page.goto(`/actividades?asignatura=${E2E.otherSubject.id}`);
    await expect(page.getByText("No hay actividades con esos filtros.")).toBeVisible();

    await page.getByRole("button", { name: "Limpiar" }).click();
    await expect(page).toHaveURL(/\/actividades$/);
    await expect(page.getByRole("link", { name: E2E.activity.title })).toBeVisible();
  });

  test("sorting by most used keeps the list working", async ({ page }) => {
    await page.goto("/actividades");
    await page.getByRole("button", { name: "Más usadas" }).click();

    await expect(page).toHaveURL(/sort=populares/);
    await expect(page.getByText(/\d+ actividades/)).toBeVisible();
  });
});

test.describe("activity detail", () => {
  test("shows everything the seeded activity has", async ({ page }) => {
    await page.goto(`/actividades/detalle/${E2E.activity.id}`);

    await expect(page.getByRole("heading", { name: E2E.activity.title })).toBeVisible();
    await expect(page.getByText(E2E.activity.objective)).toBeVisible();
    await expect(page.getByText("Se parte con una pregunta.")).toBeVisible();
    await expect(page.getByText("Se cierra con una puesta en común.")).toBeVisible();
    await expect(page.getByText("Plumones E2E")).toBeVisible();
    await expect(page.getByText("Guía de la actividad E2E")).toBeVisible();
    await expect(page.getByText(E2E.skill.name)).toBeVisible();
    await expect(page.getByText("45 minutos")).toBeVisible();
  });

  test("an activity with no files says so instead of showing an empty box", async ({ page }) => {
    await page.goto(`/actividades/detalle/${E2E.quietActivity.id}`);
    await expect(page.getByText("Esta actividad no tiene archivos.")).toBeVisible();
  });

  test("a missing activity is a 404, not a crash", async ({ page }) => {
    const response = await page.goto("/actividades/detalle/99999999");
    expect(response?.status()).toBe(404);
  });

  test("a visitor is invited to sign in before commenting", async ({ page }) => {
    await page.goto(`/actividades/detalle/${E2E.activity.id}`);
    await expect(page.getByRole("link", { name: "Entra", exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("¿Cómo te resultó en la sala?")).toHaveCount(0);
  });
});
