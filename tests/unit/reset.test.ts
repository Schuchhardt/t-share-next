import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Password-reset tokens.
 *
 * The property worth guarding is that the clear-text token never reaches the
 * table — a database dump has to be useless for taking over an account — and
 * that a link stops working once it is used or once it ages out.
 *
 * The Supabase client is stubbed with just enough of the builder to serve the
 * one `select().eq().maybeSingle()` the lookup makes.
 */

/** Rows the stubbed `tshare_password_resets` table holds. */
let rows: Record<string, unknown>[] = [];
/** Every row handed to `.insert()`, so the stored hash can be inspected. */
let inserted: Record<string, unknown>[] = [];

function builder() {
  let match: { column: string; value: unknown } | null = null;

  const self: Record<string, unknown> = {
    select() {
      return self;
    },
    insert(row: Record<string, unknown>) {
      inserted.push(row);
      rows.push(row);
      return Promise.resolve({ data: null, error: null });
    },
    update(patch: Record<string, unknown>) {
      const applied = patch;
      return {
        eq() {
          Object.assign(rows[0] ?? {}, applied);
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
    delete() {
      return {
        eq() {
          return { is: () => Promise.resolve({ data: null, error: null }) };
        },
      };
    },
    eq(column: string, value: unknown) {
      match = { column, value };
      return self;
    },
    is() {
      return self;
    },
    maybeSingle() {
      const found = match
        ? rows.find((r) => r[match!.column.replace(/^.*\./, "")] === match!.value)
        : rows[0];
      return Promise.resolve({ data: found ?? null, error: null });
    },
  };
  return self;
}

vi.mock("@/lib/supabase", async () => {
  const actual = await vi.importActual<typeof import("@/lib/supabase")>("@/lib/supabase");
  return { ...actual, db: () => ({ from: () => builder() }) };
});

const { createPasswordReset, findPasswordReset, hashResetToken, markPasswordResetUsed } =
  await import("@/lib/auth/reset");

beforeEach(() => {
  rows = [];
  inserted = [];
});

describe("hashResetToken", () => {
  it("is a plain hex SHA-256, which is what the column holds", () => {
    expect(hashResetToken("abc")).toBe(createHash("sha256").update("abc").digest("hex"));
    expect(hashResetToken("abc")).toHaveLength(64);
  });
});

describe("createPasswordReset", () => {
  it("stores the hash and never the token", async () => {
    const token = await createPasswordReset(7);

    expect(inserted).toHaveLength(1);
    const row = inserted[0]!;
    expect(row.user_id).toBe(7);
    expect(row.token_hash).toBe(hashResetToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it("hands out a different token every time", async () => {
    const a = await createPasswordReset(7);
    const b = await createPasswordReset(7);
    expect(a).not.toBe(b);
    // 32 random bytes, base64url — no padding, nothing needing escaping.
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("gives the teacher an hour to use it", async () => {
    await createPasswordReset(7);
    const expires = new Date(inserted[0]!.expires_at as string).getTime();
    const minutes = (expires - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(58);
    expect(minutes).toBeLessThanOrEqual(60);
  });
});

describe("findPasswordReset", () => {
  it("resolves a fresh token to its account", async () => {
    const token = await createPasswordReset(7);
    await expect(findPasswordReset(token)).resolves.toMatchObject({ ok: true, userId: 7 });
  });

  it("does not know a token it never issued", async () => {
    await createPasswordReset(7);
    await expect(findPasswordReset("no-es-un-token")).resolves.toEqual({
      ok: false,
      reason: "unknown",
    });
  });

  it("rejects an empty token without asking the database", async () => {
    await expect(findPasswordReset("")).resolves.toEqual({ ok: false, reason: "unknown" });
    expect(rows).toHaveLength(0);
  });

  it("refuses a token that was already spent", async () => {
    const token = await createPasswordReset(7);
    await markPasswordResetUsed(1);
    await expect(findPasswordReset(token)).resolves.toEqual({ ok: false, reason: "used" });
  });

  it("refuses a token past its hour", async () => {
    const token = await createPasswordReset(7);
    rows[0]!.expires_at = new Date(Date.now() - 1000).toISOString();
    await expect(findPasswordReset(token)).resolves.toEqual({ ok: false, reason: "expired" });
  });
});
