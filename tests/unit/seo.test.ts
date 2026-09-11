import { describe, expect, it } from "vitest";
import {
  activityDescription,
  activityJsonLd,
  activityTitle,
  breadcrumbJsonLd,
  clamp,
  isoDuration,
} from "@/lib/seo";
import type { ActivityDetail } from "@/lib/types";

/**
 * What a crawler ends up reading.
 *
 * The cases worth pinning are the ones the migrated catalogue actually
 * produces: activities with no objective and no description — the snippet
 * cannot be left empty or Google writes its own — and objectives far longer
 * than a result snippet fits.
 */

function activity(overrides: Partial<ActivityDetail> = {}): ActivityDetail {
  return {
    id: 1076,
    title: "Fracciones con material concreto",
    learningObjective: "Representar fracciones simples con material concreto.",
    coverUrl: null,
    durationMinutes: 45,
    createdAt: "2025-03-04T12:00:00.000Z",
    author: { id: 7, name: "Ana Pérez", avatarUrl: null },
    subjects: ["Matemática"],
    grades: ["9 a 10 años"],
    resourceTypes: ["Guía"],
    documentCount: 2,
    savedCount: 3,
    downloadCount: 12,
    description: null,
    evaluation: null,
    rating: 4.5,
    pdfUrl: null,
    skills: ["Resolución de problemas"],
    units: [],
    steps: [],
    materials: [],
    documents: [],
    ...overrides,
  };
}

describe("clamp", () => {
  it("leaves a snippet that already fits", () => {
    expect(clamp("Una descripción corta.")).toBe("Una descripción corta.");
  });

  it("cuts at a word, not mid-syllable", () => {
    const long = `${"palabra ".repeat(40)}final`;
    const result = clamp(long);
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toContain("palabr…");
  });

  it("collapses the whitespace a pasted objective drags along", () => {
    expect(clamp("  dos\n\nlíneas  ")).toBe("dos líneas");
  });
});

describe("isoDuration", () => {
  it("is what schema.org expects", () => {
    expect(isoDuration(45)).toBe("PT45M");
    expect(isoDuration(60)).toBe("PT1H");
    expect(isoDuration(90)).toBe("PT1H30M");
  });

  it("says nothing when the duration is missing", () => {
    expect(isoDuration(null)).toBeUndefined();
    expect(isoDuration(0)).toBeUndefined();
  });
});

describe("activityDescription", () => {
  it("leads with the objective, which is what a teacher searches for", () => {
    expect(activityDescription(activity())).toBe(
      "Representar fracciones simples con material concreto.",
    );
  });

  it("falls back to the description", () => {
    expect(
      activityDescription(
        activity({ learningObjective: null, description: "Una clase de dos momentos." }),
      ),
    ).toBe("Una clase de dos momentos.");
  });

  it("still says something for a row that has neither", () => {
    const text = activityDescription(activity({ learningObjective: null, description: null }));
    expect(text).toContain("Matemática");
    expect(text).toContain("9 a 10 años");
  });
});

describe("activityTitle", () => {
  it("qualifies the title with the ficha", () => {
    expect(activityTitle(activity())).toBe(
      "Fracciones con material concreto — matemática · 9 a 10 años · 45 min",
    );
  });

  it("is the bare title when there is no ficha to add", () => {
    const bare = activity({ subjects: [], grades: [], durationMinutes: null });
    expect(activityTitle(bare)).toBe("Fracciones con material concreto");
  });
});

describe("activityJsonLd", () => {
  it("describes the activity as teaching material", () => {
    const data = activityJsonLd(activity());
    expect(data["@type"]).toBe("LearningResource");
    expect(data.educationalLevel).toEqual(["9 a 10 años"]);
    expect(data.timeRequired).toBe("PT45M");
    expect(data.teaches).toContain("Resolución de problemas");
    expect(data.author).toEqual({ "@type": "Person", name: "Ana Pérez" });
  });

  it("never claims a rating, because no vote count backs the migrated one", () => {
    expect(activityJsonLd(activity())).not.toHaveProperty("aggregateRating");
  });

  it("leaves out what the activity does not have rather than sending null", () => {
    const data = activityJsonLd(
      activity({ grades: [], subjects: [], durationMinutes: null, author: null, downloadCount: 0 }),
    );
    for (const key of [
      "educationalLevel",
      "about",
      "timeRequired",
      "author",
      "interactionStatistic",
    ]) {
      expect(data).not.toHaveProperty(key);
    }
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers the trail from one", () => {
    const data = breadcrumbJsonLd([
      { name: "Inicio", path: "/" },
      { name: "Actividades", path: "/actividades" },
    ]) as { itemListElement: { position: number; name: string; item: string }[] };
    expect(data.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(data.itemListElement[1]!.item).toMatch(/\/actividades$/);
  });
});
