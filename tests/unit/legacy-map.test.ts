import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SPECS,
  bool,
  date,
  fileKey,
  int,
  notificationType,
  num,
  text,
  textOrEmpty,
  ts,
  type MigrationContext,
} from "../../db/legacy-map";
import { DEFAULT_EXPORT_DIR, readCsv } from "../../db/scripts/loader";

/**
 * Guards on the legacy migration.
 *
 * The important ones are at the bottom: they read the real export and assert
 * that each file still has the number of columns `db/legacy-map.ts` expects,
 * and that the values land on the right fields. That is the part of the
 * migration with no type system behind it — the CSV header is sorted
 * alphabetically while the values follow the table's column order, so a
 * mis-declared order would silently write emails into avatar columns.
 */

function ctx(): MigrationContext {
  return { known: new Map(), notes: [] };
}

/** The export is only present in a checkout that also has t-share-back. */
function exportAvailable(): boolean {
  try {
    return readdirSync(DEFAULT_EXPORT_DIR).some((f) => f.endsWith(".csv"));
  } catch {
    return false;
  }
}

describe("value coercion", () => {
  it("treats empty strings and the literal 'null' as missing", () => {
    expect(text("")).toBeNull();
    expect(text("   ")).toBeNull();
    expect(text("null")).toBeNull();
    expect(text("NULL")).toBeNull();
    expect(text(" Chile ")).toBe("Chile");
    expect(textOrEmpty("")).toBe("");
  });

  it("parses integers and decimals, rejecting junk", () => {
    expect(int("42")).toBe(42);
    expect(int("")).toBeNull();
    expect(int("abc")).toBeNull();
    expect(num("4.5")).toBe(4.5);
    expect(num("")).toBeNull();
  });

  it("reads MySQL booleans", () => {
    expect(bool("1")).toBe(true);
    expect(bool("0")).toBe(false);
    expect(bool("")).toBe(false);
  });

  it("tags naive timestamps as UTC, which is what Laravel wrote", () => {
    expect(ts("2018-03-16 08:45:38")).toBe("2018-03-16T08:45:38Z");
    expect(ts("")).toBeNull();
    expect(ts("0000-00-00 00:00:00")).toBeNull();
  });

  it("drops the placeholder dates the old signup form wrote", () => {
    expect(date("1998-01-20")).toBe("1998-01-20");
    // Every migrated row carries this in code_expiration; it is not a date.
    expect(date("0001-01-01")).toBeNull();
    expect(date("")).toBeNull();
  });

  it("turns Laravel's public storage paths back into S3 keys", () => {
    expect(fileKey("actividades/pdf/1076-x.pdf")).toBe("actividades/pdf/1076-x.pdf");
    expect(fileKey("/storage/actividades/recursos/abc")).toBe("actividades/recursos/abc");
    expect(fileKey("")).toBeNull();
  });

  it("normalises notification types, backslashes or not", () => {
    expect(notificationType("App\\Notifications\\ActividadGuardada")).toBe("activity_saved");
    // The export lost the backslashes in about a fifth of the rows.
    expect(notificationType("AppNotificationsActividadGuardada")).toBe("activity_saved");
    expect(notificationType("AppNotificationsUsuarioSeguidor")).toBe("user_followed");
    expect(notificationType("App\\Notifications\\SomethingNew")).toBe("unknown");
  });
});

describe("user mapping", () => {
  const spec = SPECS.find((s) => s.table === "tshare_users")!;

  /** A row in the real positional order, taken from the export. */
  const row = Object.fromEntries(
    spec.legacy.map((name, i) => [
      name,
      [
        "2296",
        "Angela",
        "Palma",
        "Angela.Palma@Gmail.com",
        "",
        "$2y$10$jaWigipEBBgiSMxZXRht.u1NuNK/Vz1ZMoiR3EAWED37hwBmYrkpG",
        "",
        "2",
        "1998-01-20",
        "Chile",
        "Región del Biobío",
        "null",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "0",
        "1",
        "",
        "0001-01-01",
        "Profesora de básica",
        "1",
        "",
        "2021-11-12 20:52:08",
        "2021-11-12 20:52:09",
        "1",
        "users/avatars/abc.png",
        "users/avatars/abc.png",
        "",
        "1",
      ][i]!,
    ]),
  );

  const mapped = spec.map(row, ctx())!;

  it("puts every value on the right column", () => {
    expect(mapped.id).toBe(2296);
    expect(mapped.first_name).toBe("Angela");
    expect(mapped.last_name).toBe("Palma");
    expect(mapped.password_hash).toBe(
      "$2y$10$jaWigipEBBgiSMxZXRht.u1NuNK/Vz1ZMoiR3EAWED37hwBmYrkpG",
    );
    expect(mapped.birth_date).toBe("1998-01-20");
    expect(mapped.region).toBe("Región del Biobío");
    expect(mapped.bio).toBe("Profesora de básica");
    expect(mapped.country_id).toBe(1);
    expect(mapped.is_active).toBe(true);
    expect(mapped.is_verified).toBe(true);
  });

  it("lower-cases the email so a sign-in is case-insensitive", () => {
    expect(mapped.email).toBe("angela.palma@gmail.com");
  });

  it("forces a password change on every migrated account", () => {
    expect(mapped.must_change_password).toBe(true);
  });

  it("keeps the free-text country only when it is not just the id again", () => {
    expect(mapped.country_name).toBe("Chile");
    const numeric = spec.map({ ...row, pais: "1" }, ctx())!;
    expect(numeric.country_name).toBeNull();
  });

  it("collapses avatar and avatar_public, which held the same key", () => {
    expect(mapped.avatar_key).toBe("users/avatars/abc.png");
  });

  it("skips a row with no email, which cannot satisfy the unique index", () => {
    expect(spec.map({ ...row, email: "" }, ctx())).toBeNull();
  });
});

describe("activity mapping", () => {
  const spec = SPECS.find((s) => s.table === "tshare_activities")!;

  function build(overrides: Record<string, string> = {}) {
    const base = Object.fromEntries(spec.legacy.map((n) => [n, ""]));
    return spec.map({ ...base, id: "1076", nombre: "El post-it positivo", ...overrides }, ctx())!;
  }

  it("prefers the authored cover over the stock one", () => {
    const row = build({
      avatar: "actividades/avatar/authored.png",
      avatar_public: "actividades/avatar_random/2WEB.png",
    });
    expect(row.cover_image_key).toBe("actividades/avatar/authored.png");
  });

  it("falls back to the stock cover when there is no authored one", () => {
    const row = build({ avatar: "", avatar_public: "actividades/avatar_random/2WEB.png" });
    expect(row.cover_image_key).toBe("actividades/avatar_random/2WEB.png");
  });

  it("reads duration and rating as numbers", () => {
    const row = build({ duracion: "45", puntaje: "4" });
    expect(row.duration_minutes).toBe(45);
    expect(row.rating).toBe(4);
  });
});

describe("follows", () => {
  const spec = SPECS.find((s) => s.table === "tshare_follows")!;

  it("keeps a normal follow", () => {
    const row = spec.map(
      { id: "1", created_at: "", updated_at: "", user_id: "28", seguido_id: "76" },
      ctx(),
    );
    expect(row).toMatchObject({ follower_id: 28, followed_id: 76 });
  });

  it("drops a self-follow, which the check constraint rejects", () => {
    const context = ctx();
    const row = spec.map(
      { id: "1", created_at: "", updated_at: "", user_id: "28", seguido_id: "28" },
      context,
    );
    expect(row).toBeNull();
    expect(context.notes).toHaveLength(1);
  });
});

describe("notifications", () => {
  const spec = SPECS.find((s) => s.table === "tshare_notifications")!;

  it("detaches a notification whose user was never exported", () => {
    const context = ctx();
    context.known.set("tshare_users", new Set(["28"]));
    const row = spec.map(
      {
        id: "3e250480-f4bb-4d74-a905-f3030124d838",
        type: "App\\Notifications\\ActividadGuardada",
        notifiable_type: "App\\User",
        notifiable_id: "115",
        data: '{"user":115}',
        read_at: "",
        created_at: "2018-07-19 16:31:09",
        updated_at: "2018-07-19 16:31:09",
      },
      context,
    )!;
    expect(row.user_id).toBeNull();
    expect(row.type).toBe("activity_saved");
    expect(row.data).toEqual({ user: 115 });
  });
});

describe.runIf(exportAvailable())("against the real export", () => {
  it.each(SPECS.map((s) => [s.csv, s] as const))(
    "%s still has the column count legacy-map declares",
    (_csv, spec) => {
      const header = readFileSync(join(DEFAULT_EXPORT_DIR, spec.csv), "utf8")
        .replace(/^﻿/, "")
        .split("\n")[0]!
        .split(",");
      expect(header).toHaveLength(spec.legacy.length);
    },
  );

  it("maps every row of every table without throwing", () => {
    const context = ctx();
    for (const spec of SPECS) {
      const rows = readCsv(spec);
      expect(rows.length).toBeGreaterThan(0);
      const mapped = rows.map((r) => spec.map(r, context)).filter(Boolean);
      context.known.set("tshare_" + spec.table, new Set());
      context.known.set(spec.table, new Set(mapped.map((r) => String(r!.id))));
      // Every table has an id, and it is the first positional column.
      expect(mapped.every((r) => r!.id !== null && r!.id !== undefined)).toBe(true);
    }
  });

  it("reads the first user row as a person, not as shuffled columns", () => {
    const spec = SPECS.find((s) => s.table === "tshare_users")!;
    const first = spec.map(readCsv(spec)[0]!, ctx())!;
    expect(first.email).toMatch(/^[^@\s]+@[^@\s]+$/);
    expect(String(first.password_hash)).toMatch(/^\$2[aby]\$/);
    expect(typeof first.first_name).toBe("string");
    expect(first.first_name).not.toBe("");
  });
});
