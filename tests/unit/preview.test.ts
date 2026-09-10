import { describe, expect, it } from "vitest";
import { fileExtension, fileLabel, previewKind, previewKindForFile } from "@/lib/preview";

/**
 * What the detail page and the upload form agree can be shown inline.
 *
 * The cases that matter are the shapes the database actually holds: a bare S3
 * key, a signed URL with a query string, and the 762 migrated resources whose
 * `nombre` is a Canva or Drive link rather than a filename.
 */

describe("fileExtension", () => {
  it("reads the extension off an S3 key", () => {
    expect(fileExtension("actividades/pdf/1076-guia.pdf")).toBe("pdf");
  });

  it("ignores the query string a signed URL drags along", () => {
    expect(
      fileExtension(
        "https://bucket.s3.amazonaws.com/actividades/recursos/abc.PNG" +
          "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=deadbeef",
      ),
    ).toBe("png");
  });

  it("ignores a fragment too", () => {
    expect(fileExtension("https://example.org/guia.pdf#page=3")).toBe("pdf");
  });

  it("has nothing to report for a link with no filename", () => {
    expect(fileExtension("https://www.canva.com/design/DAE1234/view")).toBeNull();
    expect(fileExtension("https://drive.google.com/file/d/1a2b3c/view")).toBeNull();
    expect(fileExtension("")).toBeNull();
    expect(fileExtension(null)).toBeNull();
  });

  it("does not mistake a dotted directory for an extension", () => {
    expect(fileExtension("actividades/v1.2/guia")).toBeNull();
  });

  it("rejects something too long to be an extension", () => {
    expect(fileExtension("archivo.esto-no-es-una-extension")).toBeNull();
  });
});

describe("previewKind", () => {
  it("recognises the formats a browser can render", () => {
    expect(previewKind("foto.jpg")).toBe("image");
    expect(previewKind("foto.JPEG")).toBe("image");
    expect(previewKind("diagrama.webp")).toBe("image");
    expect(previewKind("guia.pdf")).toBe("pdf");
    expect(previewKind("clase.mp4")).toBe("video");
  });

  it("leaves office documents and links as downloads", () => {
    expect(previewKind("planificacion.docx")).toBeNull();
    expect(previewKind("presentacion.pptx")).toBeNull();
    expect(previewKind("https://www.canva.com/design/DAE1234/view")).toBeNull();
  });

  it("does not embed an SVG, which can carry script", () => {
    expect(previewKind("mapa.svg")).toBeNull();
  });
});

describe("previewKindForFile", () => {
  it("trusts the MIME type the browser reports", () => {
    // A phone camera upload: real image, no extension on the name.
    expect(previewKindForFile({ name: "IMG_0042", type: "image/jpeg" })).toBe("image");
    expect(previewKindForFile({ name: "guia", type: "application/pdf" })).toBe("pdf");
  });

  it("falls back to the name when the type is missing", () => {
    expect(previewKindForFile({ name: "foto.png", type: "" })).toBe("image");
    expect(previewKindForFile({ name: "planificacion.docx", type: "" })).toBeNull();
  });

  it("refuses an SVG by either route", () => {
    expect(previewKindForFile({ name: "mapa.svg", type: "image/svg+xml" })).toBeNull();
    expect(previewKindForFile({ name: "mapa.svg", type: "" })).toBeNull();
  });
});

describe("fileLabel", () => {
  it("is the extension, for the badge next to a file", () => {
    expect(fileLabel("guia.pdf")).toBe("PDF");
    expect(fileLabel("planificacion.docx")).toBe("DOCX");
    expect(fileLabel("https://www.canva.com/design/DAE1234/view")).toBeNull();
  });
});
