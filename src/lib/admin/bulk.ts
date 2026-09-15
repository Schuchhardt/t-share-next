/**
 * Lo que comparten las acciones en lote de las dos listas del panel.
 *
 * Una lista marcada es un formulario con muchas casillas `ids` y un botón por
 * operación, así que todo lo que hace falta antes de tocar la base es leer esa
 * selección y saber a dónde volver. Las dos cosas son puro texto — sin base de
 * datos y sin sesión — y por eso viven acá y no dentro de un `"use server"`,
 * donde no se podrían probar ni exportar como lo que son.
 */

/**
 * Los ids marcados: enteros positivos, sin repetidos y en orden.
 *
 * Se llama `ids` venga de donde venga — de las casillas de la lista o del campo
 * oculto del botón de una fila — porque para la acción son lo mismo.
 */
export function selectedIds(formData: FormData): number[] {
  const ids = new Set<number>();
  for (const value of formData.getAll("ids")) {
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) ids.add(id);
  }
  return [...ids].sort((a, b) => a - b);
}

/**
 * La misma lista de la que se salió, más el resultado del lote.
 *
 * El campo `back` lo pone la lista con su propia búsqueda y su página, para no
 * devolver a la primera página cada vez. Llega en un formulario, así que puede
 * traer cualquier cosa: sólo se acepta si es esta lista, y si no, se vuelve a
 * su raíz.
 */
export function backToList(
  formData: FormData,
  base: string,
  result: string,
  count: number,
): string {
  const given = String(formData.get("back") ?? "");
  const safe = given === base || given.startsWith(`${base}?`) ? given : base;
  const [path = base, search = ""] = safe.split("?");

  const query = new URLSearchParams(search);
  query.delete("estado");
  query.set("lote", result);
  query.set("n", String(count));
  return `${path}?${query}`;
}
