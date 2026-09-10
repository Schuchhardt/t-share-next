import { describe, expect, it } from "vitest";
import { FILTER_KEYS, readFilters } from "@/lib/filters";

/**
 * The query string is the whole state of the results page, so it has to
 * survive being shared, bookmarked and hand-edited.
 */

describe("readFilters", () => {
  it("defaults to everything, newest first", () => {
    expect(readFilters({})).toEqual({
      q: "",
      subjectIds: [],
      gradeIds: [],
      skillIds: [],
      resourceTypeIds: [],
      sort: "recientes",
      page: 1,
    });
  });

  it("reads a single facet value and a repeated one alike", () => {
    expect(readFilters({ [FILTER_KEYS.subject]: "7" }).subjectIds).toEqual([7]);
    expect(readFilters({ [FILTER_KEYS.subject]: ["7", "6"] }).subjectIds).toEqual([7, 6]);
  });

  it("keeps every facet apart", () => {
    const filters = readFilters({
      [FILTER_KEYS.subject]: "7",
      [FILTER_KEYS.grade]: "4",
      [FILTER_KEYS.skill]: "2",
      [FILTER_KEYS.type]: "3",
    });
    expect(filters).toMatchObject({
      subjectIds: [7],
      gradeIds: [4],
      skillIds: [2],
      resourceTypeIds: [3],
    });
  });

  it("drops values that are not catalogue ids", () => {
    expect(
      readFilters({ [FILTER_KEYS.subject]: ["7", "abc", "-1", "0", "1.5", ""] }).subjectIds,
    ).toEqual([7]);
  });

  it("collapses a repeated id rather than filtering on it twice", () => {
    expect(readFilters({ [FILTER_KEYS.grade]: ["4", "4"] }).gradeIds).toEqual([4]);
  });

  it("trims the search term", () => {
    expect(readFilters({ q: "  fracciones " }).q).toBe("fracciones");
  });

  it("only accepts the two sort orders it knows", () => {
    expect(readFilters({ sort: "populares" }).sort).toBe("populares");
    expect(readFilters({ sort: "recientes" }).sort).toBe("recientes");
    expect(readFilters({ sort: "cualquier-cosa" }).sort).toBe("recientes");
  });

  it("falls back to the first page for a nonsense page number", () => {
    expect(readFilters({ page: "3" }).page).toBe(3);
    expect(readFilters({ page: "0" }).page).toBe(1);
    expect(readFilters({ page: "-2" }).page).toBe(1);
    expect(readFilters({ page: "abc" }).page).toBe(1);
  });
});
