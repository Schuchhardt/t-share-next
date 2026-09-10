/**
 * T-share API endpoint map, carried over from the Angular app's
 * `src/environments/environment{,.prod}.ts`.
 *
 * Nothing in the UI calls these yet — the screens read from `src/lib/data.ts`.
 * This module exists so that wiring the real backend is a change in one place
 * rather than a hunt through the components.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://new-api.t-share.org/api";

export const endpoints = {
  base: API_BASE,
  usuarios: `${API_BASE}/usuarios`,
  actividades: `${API_BASE}/actividades`,
  colegios: `${API_BASE}/colegios`,
  materiales: `${API_BASE}/materiales`,
  recursos: `${API_BASE}/recursos`,
  instrucciones: `${API_BASE}/instrucciones`,
  comentarios: `${API_BASE}/comentarios`,
  ramos: `${API_BASE}/ramos`,
  cursos: `${API_BASE}/cursos`,
  subscriptor: `${API_BASE}/subscriptor`,
  unidades: `${API_BASE}/unidades`,
  secciones: `${API_BASE}/secciones`,
  habilidades: `${API_BASE}/habilidades`,
  tbk: `${API_BASE}/tbk`,
  subscripciones: `${API_BASE}/subscripciones`,
  tiposRecursos: `${API_BASE}/tiposrecursos`,
  notificaciones: `${API_BASE}/notificaciones`,
  eventos: `${API_BASE}/eventos`,
  reactions: `${API_BASE}/reactions`,
} as const;

export const ROLES = ["admin", "cliente", "usuario"] as const;
export type Rol = (typeof ROLES)[number];
