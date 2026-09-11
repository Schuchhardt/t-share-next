import { E2E, expect, requiresDatabase, signIn, test } from "./fixtures";

/**
 * What a signed-in teacher can do: save an activity, comment on it, and
 * publish a new one. Each of these writes to Supabase through a server action.
 *
 * Los adjuntos tienen su propio caso porque tienen su propio camino: no van
 * dentro del server action, que acepta 1 MB, sino de a uno por `/api/subidas`.
 * Publicar con una guía de verdad moría con "Body exceeded 1 MB limit", así
 * que el test que lo cubre carga archivos que pesan de verdad.
 */

/** Un archivo del tamaño pedido, sin dejar binarios en el repo. */
function archivo(name: string, mimeType: string, bytes: number) {
  return { name, mimeType, buffer: Buffer.alloc(bytes, "T") };
}

requiresDatabase();

test.beforeEach(async ({ page }) => {
  await signIn(page, E2E.modernUser.email, E2E.modernUser.password);
  await expect(page).toHaveURL(/\/actividades$/);
});

test("saving an activity sticks, and shows up on the profile", async ({ page }) => {
  await page.goto(`/actividades/detalle/${E2E.activity.id}`);

  const save = page.getByRole("button", { name: /Guardar|Guardada/ });
  const wasSaved = (await save.getAttribute("aria-pressed")) === "true";
  if (wasSaved) {
    await save.click();
    await expect(save).toHaveAttribute("aria-pressed", "false");
  }

  await save.click();
  await expect(page.getByRole("button", { name: "Guardada ✓" })).toBeVisible();

  // It survives a reload, so it lives in the database rather than in the tab.
  await page.reload();
  await expect(page.getByRole("button", { name: "Guardada ✓" })).toBeVisible();

  await page.goto("/mi-perfil");
  await page.getByRole("tab", { name: "Guardadas" }).click();
  await expect(page.getByRole("link", { name: E2E.activity.title })).toBeVisible();
});

test("commenting adds the comment to the thread", async ({ page }) => {
  const comment = `Me sirvió en la sala ${Date.now()}`;

  await page.goto(`/actividades/detalle/${E2E.activity.id}`);
  await page.getByPlaceholder("¿Cómo te resultó en la sala?").fill(comment);
  await page.getByRole("button", { name: "Comentar" }).click();

  await expect(page.getByText(comment)).toBeVisible();
  await page.reload();
  await expect(page.getByText(comment)).toBeVisible();
});

test("a too-short comment is refused without reloading the page", async ({ page }) => {
  await page.goto(`/actividades/detalle/${E2E.activity.id}`);
  const box = page.getByPlaceholder("¿Cómo te resultó en la sala?");
  // Sidestep the browser's own minlength so the server rule is what answers.
  await box.evaluate((el) => el.removeAttribute("minlength"));
  await box.fill("no");
  await page.getByRole("button", { name: "Comentar" }).click();

  await expect(page.getByText(/un poco más largo/)).toBeVisible();
});

test("publishing an activity lands on its detail page", async ({ page }) => {
  const title = `Actividad publicada ${Date.now()}`;

  await page.goto("/actividades/crear");
  await page.getByLabel("Título de la actividad").fill(title);
  await page.getByLabel("Objetivo de aprendizaje").fill("Que el test la encuentre después");
  await page.getByLabel("Asignatura").selectOption({ label: E2E.subject.name });
  await page.getByLabel("Nivel").selectOption({ label: `${E2E.grade.name} · ${E2E.grade.description}` });
  await page.getByLabel("Duración (min)").fill("30");
  await page.getByRole("textbox", { name: /^Inicio/ }).fill("Primero se explica.");
  await page.getByLabel("Materiales").fill("Cartulina\nPlumones");
  await page.getByRole("checkbox", { name: E2E.skill.name }).check();

  await page.getByRole("button", { name: "Publicar actividad" }).click();

  await expect(page).toHaveURL(/\/actividades\/detalle\/\d+$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("Primero se explica.")).toBeVisible();
  await expect(page.getByText("Cartulina")).toBeVisible();
  await expect(page.getByText("30 minutos")).toBeVisible();

  // And it is on the profile.
  await page.goto("/mi-perfil");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("publishing with a cover and a document stores both", async ({ page }) => {
  const title = `Actividad con adjuntos ${Date.now()}`;

  await page.goto("/actividades/crear");
  await page.getByLabel("Título de la actividad").fill(title);
  await page.getByLabel("Asignatura").selectOption({ label: E2E.subject.name });
  await page.getByLabel("Nivel").selectOption({ label: `${E2E.grade.name} · ${E2E.grade.description}` });

  // Pesados a propósito: con el límite de 1 MB del server action, esto era
  // exactamente lo que devolvía un 500 y dejaba al profesor sin formulario.
  await page.getByLabel("Portada").setInputFiles(archivo("portada.png", "image/png", 2 * 1024 * 1024));
  await page
    .getByLabel("Documentos de la actividad")
    .setInputFiles([archivo("guia.pdf", "application/pdf", 3 * 1024 * 1024)]);

  await page.getByRole("button", { name: "Publicar actividad" }).click();

  await expect(page).toHaveURL(/\/actividades\/detalle\/\d+$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("guia.pdf")).toBeVisible();
});

test("a document over the limit is refused before publishing", async ({ page }) => {
  await page.goto("/actividades/crear");
  await page
    .getByLabel("Documentos de la actividad")
    .setInputFiles([archivo("enorme.pdf", "application/pdf", 5 * 1024 * 1024)]);

  await expect(page.getByText(/supera los 4 MB/)).toBeVisible();
  // Y lo dice sin tumbar el formulario: el título sigue ahí para seguir.
  await expect(page.getByLabel("Título de la actividad")).toBeVisible();
});

test("publishing without a title is refused", async ({ page }) => {
  await page.goto("/actividades/crear");
  await page.getByLabel("Título de la actividad").evaluate((el) => el.removeAttribute("required"));
  await page.getByLabel("Asignatura").selectOption({ label: E2E.subject.name });
  await page.getByLabel("Nivel").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Publicar actividad" }).click();

  await expect(page.getByText("El título es obligatorio.")).toBeVisible();
  await expect(page).toHaveURL(/\/actividades\/crear$/);
});
