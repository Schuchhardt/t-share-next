import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

/**
 * Resets the fixtures before every run.
 *
 * The suite changes state on purpose — the migrated teacher ends up with a new
 * password, activities get published — so without this the second run would
 * fail on the leftovers of the first.
 */
export default async function globalSetup() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const { seedE2E } = await import("../../db/scripts/seed-e2e");
  await seedE2E();
}
