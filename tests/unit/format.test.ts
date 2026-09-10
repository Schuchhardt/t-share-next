import { describe, expect, it } from "vitest";
import { docsLine, documentName, formatDuration, joinEs, metaLine, stepName } from "@/lib/format";

describe("joinEs", () => {
  it("reads as Spanish", () => {
    expect(joinEs([])).toBe("");
    expect(joinEs(["Matemática"])).toBe("Matemática");
    expect(joinEs(["Matemática", "Inglés"])).toBe("Matemática y Inglés");
    expect(joinEs(["a", "b", "c"])).toBe("a, b y c");
  });
});

describe("metaLine", () => {
  it("builds the small-caps line", () => {
    expect(
      metaLine({ subjects: ["Matemática"], grades: ["9 a 10 años"], durationMinutes: 45 }),
    ).toBe("MATEMÁTICA · 9 A 10 AÑOS · 45 MIN");
  });

  it("skips what the activity does not have instead of leaving gaps", () => {
    expect(metaLine({ subjects: ["Inglés"], grades: [], durationMinutes: null })).toBe("INGLÉS");
    expect(metaLine({ subjects: [], grades: [], durationMinutes: 0 })).toBe("");
  });
});

describe("docsLine", () => {
  it("counts documents and downloads, singular and plural", () => {
    expect(docsLine({ documentCount: 1, resourceTypes: ["Guía"], downloadCount: 1 })).toBe(
      "1 documento · Guía · 1 descarga",
    );
    expect(docsLine({ documentCount: 3, resourceTypes: [], downloadCount: 12 })).toBe(
      "3 documentos · 12 descargas",
    );
  });

  it("says so when there is nothing attached", () => {
    expect(docsLine({ documentCount: 0, resourceTypes: [], downloadCount: 0 })).toBe(
      "Sin documentos adjuntos",
    );
  });
});

describe("formatDuration", () => {
  it("reads minutes and hours", () => {
    expect(formatDuration(45)).toBe("45 minutos");
    expect(formatDuration(60)).toBe("1 hora");
    expect(formatDuration(90)).toBe("1 hora 30 min");
    expect(formatDuration(120)).toBe("2 horas");
  });

  it("handles the 97 activities exported with duration 0", () => {
    expect(formatDuration(0)).toBe("Sin definir");
    expect(formatDuration(null)).toBe("Sin definir");
  });
});

describe("documentName", () => {
  it("uses the stored name when it is a name", () => {
    expect(documentName("Guía de fracciones.pdf", "Guía")).toBe("Guía de fracciones.pdf");
  });

  it("prefers the resource type over a URL, which most migrated rows store", () => {
    expect(documentName("https://www.canva.com/design/DAEguVXlMl8/view", "Presentación")).toBe(
      "Presentación",
    );
  });

  it("falls back to the host when there is no type either", () => {
    expect(documentName("https://docs.google.com/forms/d/1uWg/copy", null)).toBe(
      "docs.google.com",
    );
  });

  it("has something to say for an empty name", () => {
    expect(documentName("", null)).toBe("Documento");
    expect(documentName(null, "Video")).toBe("Video");
  });
});

describe("stepName", () => {
  it("keeps a real name", () => {
    expect(stepName("Inicio", 0)).toBe("Inicio");
  });

  it("numbers the 4 356 migrated steps that have no name", () => {
    expect(stepName("", 0)).toBe("Paso 1");
    expect(stepName(null, 2)).toBe("Paso 3");
  });
});
