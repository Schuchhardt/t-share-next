import { expect, test as base, type Page } from "@playwright/test";
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
 * Waits for the answer, not just for the header to change.
 *
 * "Salir" posts a server action, and the `Set-Cookie` that expires the
 * session rides on its response. The re-rendered header can show "Entrar"
 * before the browser has processed that header, so asserting on the header
 * alone leaves the next `signIn` racing a session that is still in the jar —
 * which is what made this flake.
 */
export async function signOut(page: Page) {
  const answered = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByRole("button", { name: "Salir" }).click();
  await answered;
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
}

export { expect };
