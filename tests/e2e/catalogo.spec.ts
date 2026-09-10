import { E2E, expect, requiresDatabase, test } from "./fixtures";

/**
 * Browsing: the landing page, search, the facets and one activity's detail.
 * All of it reads Supabase, so these also serve as a smoke test that the
 * migrated schema answers the queries the app makes.
 */

requiresDatabase();

test.describe("home", () => {
  test("shows the pitch, the subject chips and recent activities", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Actividades de clase, listas para usar." }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Ver todas \(\d+\)/ })).toBeVisible();
    // The chips are subjects read from tshare_subjects, not a hard-coded list.
    await expect(page.getByRole("link", { name: E2E.subject.name, exact: true })).toBeVisible();
  });

  test("a subject chip lands on the filtered list", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: E2E.subject.name, exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/actividades\\?asignatura=${E2E.subject.id}`));
    await expect(page.getByRole("link", { name: E2E.activity.title })).toBeVisible();
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
