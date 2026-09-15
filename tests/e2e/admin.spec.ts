import { E2E, adminSignIn, expect, requiresAdminKey, requiresDatabase, test } from "./fixtures";

/**
 * El panel de administración: la llave, el CRUD de cuentas y el de
 * actividades.
 *
 * Todo lo que se crea aquí se elimina al final del mismo caso — con
 * "Eliminar definitivamente", que es justamente lo que hay que probar — así
 * que la suite no deja cuentas ni actividades de prueba en el catálogo. Lo
 * único que queda es el archivo que se sube al bucket, igual que en el caso de
 * publicación del profesor; `npm run db:clean:test` recoge esos.
 *
 * Cada botón de riesgo abre un modal — un `<dialog>` de la página, no el
 * `window.confirm` del navegador — así que confirmar es apretar el segundo
 * botón, el que repite la acción, dentro de `getByRole("dialog")`.
 */

requiresDatabase();
requiresAdminKey();

/** Aprieta el botón, y dice que sí en el modal que abre. */
async function confirmar(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("button", { name, exact: true }).click();
  await expect(modal).toBeHidden();
}

test("la llave equivocada no entra, la buena vuelve a donde iba", async ({ page }) => {
  await page.goto("/admin/usuarios");
  await expect(page).toHaveURL(/\/admin\/entrar\?next=%2Fadmin%2Fusuarios/);

  await page.getByLabel("Llave").fill("no-es-la-llave");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Esa llave no es.")).toBeVisible();

  await page.getByLabel("Llave").fill(process.env.ADMIN_KEY ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/usuarios$/);
});

test("una cuenta: crearla, editarla, borrarla, restaurarla y eliminarla", async ({ page }) => {
  const email = `admin.e2e.${Date.now()}@t-share.test`;
  await adminSignIn(page);

  await page.goto("/admin/usuarios/nuevo");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-de-panel-2026");
  await page.getByLabel("Nombre", { exact: true }).fill("Cuenta");
  await page.getByLabel("Apellido").fill("De Panel");
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page).toHaveURL(/\/admin\/usuarios\/\d+\?creada=1/);
  const url = page.url().split("?")[0]!;

  await page.getByLabel("Nombre", { exact: true }).fill("Cuenta editada");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("la cuenta quedó guardada")).toBeVisible();

  // Archivar no pierde nada: la fila sigue ahí y vuelve.
  await confirmar(page, "Archivar");
  await expect(page.getByText("quedó archivada")).toBeVisible();
  await confirmar(page, "Restaurar");
  await expect(page.getByText("quedó restaurada")).toBeVisible();

  // Cancelar en el modal no borra: la ficha sigue en pie.
  await page.getByRole("button", { name: "Eliminar definitivamente" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
  await expect(page).toHaveURL(url);

  await confirmar(page, "Eliminar definitivamente");
  await expect(page).toHaveURL(/\/admin\/usuarios\?estado=eliminada/);

  expect((await page.request.get(url)).status()).toBe(404);
});

test("una actividad: crearla con su autor, adjuntarle un archivo y eliminarla", async ({
  page,
}) => {
  const title = `Actividad de panel ${Date.now()}`;
  await adminSignIn(page);

  await page.goto("/admin/actividades/nueva");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Objetivo de aprendizaje").fill("Comprobar el CRUD del panel");
  await page.getByLabel("Asignatura").selectOption({ label: E2E.subject.name });
  await page.getByLabel("Nivel").selectOption({ label: E2E.grade.name });
  // El autor va por correo: son casi tres mil cuentas y un desplegable de ese
  // tamaño no es usable.
  await page.getByLabel("Autor (correo)").fill(E2E.modernUser.email);
  await page.locator("#step_Inicio").fill("Se presenta la clase.");
  await page.locator("#materials").fill("Hojas\nLápices");
  await page.getByRole("button", { name: "Crear actividad" }).click();

  await expect(page).toHaveURL(/\/admin\/actividades\/\d+\?creada=1/);
  const activityId = Number(page.url().match(/actividades\/(\d+)/)![1]);

  // El archivo sube a S3 al elegirlo, no dentro del server action: lo que
  // viaja con el formulario es la clave que devolvió `/api/admin/subidas`.
  const form = page.locator("form", { hasText: "Agregar documento" }).last();
  await form.locator('input[type="file"]').setInputFiles({
    name: "guia-de-panel.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("documento subido desde el panel"),
  });
  await expect(form.getByText(/^Listo: /)).toBeVisible({ timeout: 20_000 });
  await form.getByLabel("Nombre").fill("Guía de panel");
  await form.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByText("Documento agregado.")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Documentos (1)")).toBeVisible();

  // Lo que el panel escribe es lo que el sitio muestra.
  await page.goto(`/actividades/detalle/${activityId}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.goto(`/admin/actividades/${activityId}`);
  await confirmar(page, "Eliminar definitivamente");
  await expect(page).toHaveURL(/\/admin\/actividades\?estado=eliminada/);
});

/**
 * Lo mismo desde la lista, que es donde se hace cuando son varias.
 *
 * El botón de una fila manda su id y nada más; la barra de arriba manda lo
 * marcado. Las dos llaman a la misma acción, así que lo que este caso comprueba
 * es que la fila no arrastre a las demás ni al revés.
 */
test("desde la lista: archivar una fila, restaurarla y eliminarla en lote", async ({ page }) => {
  const title = `Actividad en lote ${Date.now()}`;
  await adminSignIn(page);

  await page.goto("/admin/actividades/nueva");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Objetivo de aprendizaje").fill("Comprobar las acciones de la lista");
  await page.getByLabel("Asignatura").selectOption({ label: E2E.subject.name });
  await page.getByLabel("Nivel").selectOption({ label: E2E.grade.name });
  await page.getByRole("button", { name: "Crear actividad" }).click();
  await expect(page).toHaveURL(/\/admin\/actividades\/\d+\?creada=1/);
  const activityId = Number(page.url().match(/actividades\/(\d+)/)![1]);

  // El botón de la fila: archiva esa y vuelve a la lista con la búsqueda puesta.
  const list = `/admin/actividades?q=${encodeURIComponent(title)}`;
  await page.goto(list);
  const row = page.getByRole("row", { name: new RegExp(title) });
  await row.getByRole("button", { name: "Archivar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Archivar" }).click();
  await expect(page.getByText("1 actividad quedó fuera del sitio")).toBeVisible();
  await expect(page.getByRole("link", { name: title })).toHaveCount(0);

  // Marcada, la barra de arriba la trae de vuelta.
  await page.goto(`${list}&estado=borradas`);
  await page.getByRole("checkbox", { name: `Marcar «${title}»` }).check();
  await confirmar(page, "Restaurar selección");
  await expect(page.getByText("1 actividad quedó de vuelta")).toBeVisible();

  // Cancelar no borra, y la selección sigue puesta.
  await page.getByRole("checkbox", { name: `Marcar «${title}»` }).check();
  await page.getByRole("button", { name: "Eliminar selección" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  await confirmar(page, "Eliminar selección");
  await expect(page.getByText("1 actividad eliminada definitivamente")).toBeVisible();

  expect((await page.request.get(`/admin/actividades/${activityId}`)).status()).toBe(404);
});

test("el explorador de archivos navega el bucket", async ({ page }) => {
  await adminSignIn(page);
  await page.goto("/admin/archivos");

  await page.getByRole("link", { name: "actividades/recursos" }).click();
  await expect(page).toHaveURL(/prefix=actividades%2Frecursos%2F/);
  await expect(page.getByText("Subir a actividades/recursos/")).toBeVisible();
});
