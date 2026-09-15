/**
 * Lo que devuelve cada acción del panel: un error, o una confirmación.
 *
 * Vive en su propio módulo porque un archivo `"use server"` sólo puede
 * exportar funciones asíncronas — un tipo se borra al compilar y pasa, pero
 * las dos ayudantes de abajo no, y tenerlo todo junto es lo que evita que cada
 * archivo de acciones vuelva a escribirlas.
 */

export type AdminState = { error: string | null; notice: string | null };

export const ADMIN_STATE_EMPTY: AdminState = { error: null, notice: null };

export function failed(error: string): AdminState {
  return { error, notice: null };
}

export function done(notice: string): AdminState {
  return { error: null, notice };
}
