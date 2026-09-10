import { describe, expect, it } from "vitest";
import { DEFAULT_NEXT, safeNext } from "@/lib/auth/next-path";

/**
 * Where sign-in and the password change land afterwards.
 *
 * Two failure modes worth pinning. A missing field arrives as `null`, not
 * `undefined` — `formData.get("next")` says so — and the forced migration
 * screen has no such field at all, so null has to fall through to the default
 * rather than be treated as a value. And the whole thing is attacker-writable
 * through a query string, so anything that leaves the origin is dropped.
 */

describe("safeNext", () => {
  it("keeps a same-origin path", () => {
    expect(safeNext("/mi-perfil")).toBe("/mi-perfil");
    expect(safeNext("/mi-perfil?password=cambiada")).toBe("/mi-perfil?password=cambiada");
    expect(safeNext("/actividades/detalle/1220")).toBe("/actividades/detalle/1220");
  });

  it("falls back when the form carried no field at all", () => {
    // The regression: `z.string().optional()` rejected this and turned the
    // forced password change into "Invalid input: expected string".
    expect(safeNext(null)).toBe(DEFAULT_NEXT);
    expect(safeNext(undefined)).toBe(DEFAULT_NEXT);
    expect(safeNext("")).toBe(DEFAULT_NEXT);
  });

  it("refuses anything that would leave the site", () => {
    expect(safeNext("//evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNext("/\\evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNext("https://evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNext("javascript:alert(1)")).toBe(DEFAULT_NEXT);
    expect(safeNext("mi-perfil")).toBe(DEFAULT_NEXT);
  });
});
