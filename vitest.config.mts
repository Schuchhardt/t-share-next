import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Unit tests only — the Playwright suite in tests/e2e drives the real app.
 *
 * `server-only` is aliased away: the modules under test import it as a guard
 * against ending up in a client bundle, and that guard throws outside a
 * Next.js build.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // `@/*` comes from tsconfig.json.
    tsconfigPaths: true,
    alias: { "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname },
  },
  test: {
    // Node by default: jsdom hands out its own Uint8Array, and `jose` rejects
    // a key that came from another realm. Component tests opt back in with a
    // `@vitest-environment jsdom` docblock.
    environment: "node",
    globals: true,
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
  },
});
