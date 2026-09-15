import { describe, expect, it } from "vitest";
import { normaliseKey, normalisePrefix, safeFileName } from "@/lib/uploads";

/**
 * Las claves del bucket las escribe una persona en el explorador de archivos:
 * el campo de "mover" acepta cualquier cosa. Lo que se prueba aquí es que de
 * ahí no salga una clave con la que S3 haga algo distinto de lo que se leyó —
 * una barra inicial que crea una carpeta sin nombre, un `..` que aparenta
 * subir un nivel, o un nombre con una barra dentro que mueve el archivo a otra
 * parte sin decirlo.
 */

describe("normaliseKey", () => {
  it("deja en paz una clave normal", () => {
    expect(normaliseKey("actividades/recursos/guia.pdf")).toBe("actividades/recursos/guia.pdf");
  });

  it("quita la barra inicial y los tramos vacíos", () => {
    expect(normaliseKey("/actividades//recursos/guia.pdf")).toBe(
      "actividades/recursos/guia.pdf",
    );
  });

  it("descarta los tramos . y ..", () => {
    expect(normaliseKey("actividades/../../etc/passwd")).toBe("actividades/etc/passwd");
    expect(normaliseKey("./actividades/guia.pdf")).toBe("actividades/guia.pdf");
  });

  it("devuelve null cuando no queda nada", () => {
    expect(normaliseKey("")).toBeNull();
    expect(normaliseKey("///")).toBeNull();
    expect(normaliseKey("../..")).toBeNull();
    expect(normaliseKey(`${"a".repeat(901)}`)).toBeNull();
  });
});

describe("normalisePrefix", () => {
  it("termina siempre en barra", () => {
    expect(normalisePrefix("actividades/portadas")).toBe("actividades/portadas/");
    expect(normalisePrefix("/actividades/portadas/")).toBe("actividades/portadas/");
  });

  it("la raíz del bucket es la cadena vacía", () => {
    expect(normalisePrefix("")).toBe("");
    expect(normalisePrefix("/")).toBe("");
  });
});

describe("safeFileName", () => {
  it("conserva el acento y la ñ, que el bucket acepta", () => {
    expect(safeFileName("guía de año.pdf")).toBe("guía de año.pdf");
  });

  it("se queda con el último tramo, para que un nombre no sea una ruta", () => {
    expect(safeFileName("../../otra/carpeta/guia.pdf")).toBe("guia.pdf");
  });

  it("nunca devuelve vacío", () => {
    expect(safeFileName("")).toBe("archivo");
    expect(safeFileName("   ")).toBe("archivo");
    expect(safeFileName("/")).toBe("archivo");
  });
});
