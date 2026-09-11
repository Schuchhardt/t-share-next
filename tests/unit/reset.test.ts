import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one-use links the app mails out.
 *
 * The properties worth guarding: the clear-text token never reaches the table
 * — a database dump has to be useless for taking over an account — a link
 * stops working once it is used or once it ages out, and a link cannot change
 * what it is for. A reset token pasted into /acceso would otherwise hand out
 * a session that skips the "contraseña actual" check.
 *
 * The Supabase client is stubbed with enough of the query builder to serve
 * the handful of calls these functions make: a filtered `maybeSingle`, a
 * counting `head` select, an insert, an update and a delete.
 */

/** Rows the stubbed `tshare_password_resets` table holds. */
let rows: Record<string, unknown>[] = [];
/** Every row handed to `.insert()`, so the stored hash can be inspected. */
let inserted: Record<string, unknown>[] = [];

type Filter = (row: Record<string, unknown>) => boolean;

function builder() {
  const filters: Filter[] = [];
  let counting = false;

  const matching = () => rows.filter((row) => filters.every((f) => f(row)));

  const self: Record<string, unknown> = {
    select(_columns?: string, options?: { count?: string; head?: boolean }) {
      counting = Boolean(options?.head);
      return self;
    },
    insert(row: Record<string, unknown>) {
      inserted.push(row);
      rows.push({ id: rows.length + 1, used_at: null, ...row });
      return Promise.resolve({ data: null, error: null });
    },
    update(patch: Record<string, unknown>) {
      return {
        eq(column: string, value: unknown) {
          for (const row of rows) if (row[column] === value) Object.assign(row, patch);
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
    delete() {
      const deleting: Filter[] = [];
      const chain: Record<string, unknown> = {
        eq(column: string, value: unknown) {
          deleting.push((row) => row[column] === value);
          return chain;
        },
        is(column: string, value: unknown) {
          deleting.push((row) => (row[column] ?? null) === value);
          rows = rows.filter((row) => !deleting.every((f) => f(row)));
          return Promise.resolve({ data: null, error: null });
        },
      };
      return chain;
    },
    eq(column: string, value: unknown) {
      filters.push((row) => row[column] === value);
      return self;
    },
    is(column: string, value: unknown) {
      filters.push((row) => (row[column] ?? null) === value);
      return self;
    },
    gt(column: string, value: string) {
      filters.push((row) => String(row[column]) > value);
      return self;
    },
    maybeSingle() {
      return Promise.resolve({ data: matching()[0] ?? null, error: null });
    },
  };
  // A counting select just gets awaited — whichever filter happens to be last
  // ends the chain — so the builder itself has to be a thenable.
  self.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({
      count: counting ? matching().length : null,
      data: matching(),
      error: null,
    }).then(resolve);
  return self;
}

vi.mock("@/lib/supabase", async () => {
  const actual = await vi.importActual<typeof import("@/lib/supabase")>("@/lib/supabase");
  return { ...actual, db: () => ({ from: () => builder() }) };
});

const {
  createAccessLink,
  createPasswordReset,
  findAccessLink,
  findPasswordReset,
  hasActiveAccessLink,
  hashResetToken,
  markTokenUsed,
} = await import("@/lib/auth/reset");

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
    expect(row.purpose).toBe("password_reset");
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

  it("drops the link it sent before, so only the newest mail works", async () => {
    const first = await createPasswordReset(7);
    await createPasswordReset(7);
    await expect(findPasswordReset(first)).resolves.toEqual({ ok: false, reason: "unknown" });
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
    await markTokenUsed(1);
    await expect(findPasswordReset(token)).resolves.toEqual({ ok: false, reason: "used" });
  });

  it("refuses a token past its hour", async () => {
    const token = await createPasswordReset(7);
    rows[0]!.expires_at = new Date(Date.now() - 1000).toISOString();
    await expect(findPasswordReset(token)).resolves.toEqual({ ok: false, reason: "expired" });
  });
});

describe("createAccessLink", () => {
  it("is a different kind of row, and a shorter-lived one", async () => {
    await createAccessLink(7);
    expect(inserted[0]!.purpose).toBe("access_link");
    const minutes = (new Date(inserted[0]!.expires_at as string).getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(28);
    expect(minutes).toBeLessThanOrEqual(30);
  });
});

describe("a link cannot leave the purpose it was issued for", () => {
  it("will not let a reset token open a session", async () => {
    const token = await createPasswordReset(7);
    await expect(findAccessLink(token)).resolves.toEqual({ ok: false, reason: "unknown" });
  });

  it("will not let an access token set a password on its own", async () => {
    const token = await createAccessLink(7);
    await expect(findPasswordReset(token)).resolves.toEqual({ ok: false, reason: "unknown" });
    await expect(findAccessLink(token)).resolves.toMatchObject({ ok: true, userId: 7 });
  });

  it("keeps one kind from cancelling the other", async () => {
    const access = await createAccessLink(7);
    await createPasswordReset(7);
    await expect(findAccessLink(access)).resolves.toMatchObject({ ok: true, userId: 7 });
  });
});

describe("hasActiveAccessLink", () => {
  it("is false for an account that was never sent one", async () => {
    await expect(hasActiveAccessLink(7)).resolves.toBe(false);
  });

  it("is true while the link is still good — that is the rate limit", async () => {
    await createAccessLink(7);
    await expect(hasActiveAccessLink(7)).resolves.toBe(true);
  });

  it("goes back to false once the link is used", async () => {
    await createAccessLink(7);
    await markTokenUsed(1);
    await expect(hasActiveAccessLink(7)).resolves.toBe(false);
  });

  it("goes back to false once the link expires", async () => {
    await createAccessLink(7);
    rows[0]!.expires_at = new Date(Date.now() - 1000).toISOString();
    await expect(hasActiveAccessLink(7)).resolves.toBe(false);
  });

  it("does not count a reset link somebody asked for", async () => {
    await createPasswordReset(7);
    await expect(hasActiveAccessLink(7)).resolves.toBe(false);
  });
});
