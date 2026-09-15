import { describe, expect, it } from "vitest";
import { backToList, selectedIds } from "@/lib/admin/bulk";

/**
 * Lo que una acción en lote decide antes de tocar la base: sobre qué filas
 * actúa y a dónde vuelve después.
 *
 * Todo esto entra por un formulario, que es texto y viene del navegador, así
 * que aquí están los casos en que ese texto no es lo que la pantalla mandó.
 */

function form(entries: [string, string][]): FormData {
  const formData = new FormData();
  for (const [name, value] of entries) formData.append(name, value);
  return formData;
}

describe("selectedIds", () => {
  it("lee las casillas marcadas", () => {
    expect(selectedIds(form([["ids", "3"], ["ids", "1"], ["ids", "2"]]))).toEqual([1, 2, 3]);
  });

  it("no repite una fila que llegó dos veces", () => {
    // El botón de una fila manda su id, y esa fila podía estar marcada.
    expect(selectedIds(form([["ids", "7"], ["ids", "7"]]))).toEqual([7]);
  });

  it("descarta lo que no es un id", () => {
    const formData = form([
      ["ids", "0"],
      ["ids", "-4"],
      ["ids", "1.5"],
      ["ids", "abc"],
      ["ids", ""],
      ["ids", "9"],
    ]);
    expect(selectedIds(formData)).toEqual([9]);
  });

  it("devuelve nada cuando no vino ninguna", () => {
    expect(selectedIds(form([["back", "/admin/usuarios"]]))).toEqual([]);
  });
});

describe("backToList", () => {
  const BASE = "/admin/usuarios";

  it("vuelve a la misma búsqueda y la misma página", () => {
    const formData = form([["back", `${BASE}?q=ana&page=3`]]);
    const back = backToList(formData, BASE, "archivadas", 2);
    expect(back).toBe(`${BASE}?q=ana&page=3&lote=archivadas&n=2`);
  });

  /** `back` viene de un formulario: puede traer cualquier cosa. */
  it("no se va a otra parte porque el formulario lo diga", () => {
    for (const given of ["https://otro.sitio/x", "/admin/actividades?q=x", "//evil.example", ""]) {
      expect(backToList(form([["back", given]]), BASE, "archivadas", 1)).toBe(
        `${BASE}?lote=archivadas&n=1`,
      );
    }
  });

  /**
   * `estado=borradas` es el filtro de la lista, y quien acaba de archivar algo
   * quiere verlo donde está ahora, no seguir mirando el filtro anterior.
   */
  it("suelta el filtro de estado al volver", () => {
    const formData = form([["back", `${BASE}?estado=borradas&q=ana`]]);
    expect(backToList(formData, BASE, "restauradas", 5)).toBe(`${BASE}?q=ana&lote=restauradas&n=5`);
  });

  it("acepta la lista sin nada en la URL", () => {
    expect(backToList(form([["back", BASE]]), BASE, "eliminadas", 4)).toBe(
      `${BASE}?lote=eliminadas&n=4`,
    );
  });
});
