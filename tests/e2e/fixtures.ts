import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { E2E } from "../../db/scripts/e2e-fixtures";

/**
 * Shared helpers for the e2e suite.
 *
 * `E2E` is the same module `db/scripts/seed-e2e.ts` writes from, so a fixture
 * can never drift from the rows the database actually holds.
 */

export { E2E };

/** True when this machine has a Supabase project to test against. */
export const configured = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export const test = base.extend({});

/** Skips a whole file with a message that says what is missing. */
export function requiresDatabase() {
  test.skip(
    !configured,
    "Needs a Supabase project: fill .env.local, apply db/schema.sql, then run `npm run db:seed:e2e`.",
  );
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/entrar");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/**
 * Clicks, and waits for the server action behind it to answer.
 *
 * Several controls here change before the server has agreed. The save button
 * flips through `useOptimistic`, so "Guardada ✓" is on screen before the row
 * exists; "Salir" re-renders the header signed-out while the `Set-Cookie` that
 * expires the session is still in flight. Asserting on what the screen says
 * and then reloading — or signing in again — races the write, which is what
 * made both of those flake.
 */
export async function clickAndSettle(page: Page, target: Locator) {
  const answered = page.waitForResponse((r) => r.request().method() === "POST");
  await target.click();
  await answered;
}

export async function signOut(page: Page) {
  await clickAndSettle(page, page.getByRole("button", { name: "Salir" }));
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
}

export { expect };
