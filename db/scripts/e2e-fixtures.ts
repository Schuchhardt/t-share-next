/**
 * The rows the Playwright suite expects to find.
 *
 * Kept apart from `seed-e2e.ts` so the test files can import the ids without
 * pulling in the Supabase client — importing the seed script would also run
 * it, and it demands credentials at module load.
 *
 * The ids sit from 900000 up, well clear of the migrated data.
 */

export const E2E = {
  legacyUser: {
    id: 900001,
    email: 'e2e.migrada@t-share.test',
    password: 'clave-antigua-2019',
    firstName: 'Marta',
    lastName: 'Migrada',
  },
  modernUser: {
    id: 900002,
    email: 'e2e.actual@t-share.test',
    password: 'clave-nueva-2026',
    firstName: 'Nadia',
    lastName: 'Nueva',
  },
  /**
   * A third account, used only by the password-recovery and access-link
   * specs. Those tests end up *changing* the password they signed in with, so
   * they get an account of their own rather than leaving `modernUser` in a
   * state the other files did not expect.
   */
  recoveryUser: {
    id: 900003,
    email: 'e2e.recupera@t-share.test',
    password: 'clave-recupera-2026',
    firstName: 'Rita',
    lastName: 'Recupera',
  },
  country: { id: 900010, name: 'Paisdemo' },
  subject: { id: 900011, name: 'Asignatura E2E' },
  grade: { id: 900012, name: '9 a 10 años E2E', description: 'Nivel E2E' },
  subjectGrade: { id: 900013 },
  otherSubject: { id: 900014, name: 'Materia E2E sin nada' },
  skill: { id: 900015, name: 'Habilidad E2E' },
  resourceType: { id: 900016, name: 'Guía E2E' },
  activity: {
    id: 900020,
    title: 'Actividad E2E de prueba',
    objective: 'Comprobar que el detalle carga desde Supabase',
  },
  quietActivity: { id: 900021, title: 'Sesión E2E sin documentos' },
} as const;
