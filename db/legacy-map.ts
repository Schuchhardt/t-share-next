/**
 * Legacy MySQL export -> Supabase schema.
 *
 * # The header problem
 *
 * The CSVs in `t-share-back/db_export_backup2026/` have a header row whose
 * names are sorted alphabetically while the values below stay in the table's
 * real column order. Reading them by header name silently shuffles every field
 * — `users.csv` puts the id under `active` and the email under `avatar`.
 *
 * So the header row is discarded and each file is read positionally, against
 * the `legacy` arrays below. Those orders were recovered from the Laravel
 * migrations in `t-share-back/database/migrations/` and confirmed against the
 * data (column 0 is unique in every file, dates land on date columns, bcrypt
 * hashes land on `password`, and every foreign key resolves).
 *
 * # Normalisation
 *
 * Columns that carried nothing (`materiales.apellido`), that only restated
 * another column (`actividades.avatar_public`, `recursos.archivo_public`,
 * `actividades_habilidades.nombre`) or that encoded a polymorphic relation with
 * a single member (`notifications.notifiable_type`) are dropped here rather
 * than carried into the new schema. Every drop is noted on the spec.
 */

export type LegacyRow = Record<string, string>;
export type NewRow = Record<string, unknown>;

export type TableSpec = {
  /** File name inside the export directory. */
  csv: string;
  /** Destination table. */
  table: string;
  /** Legacy column names, in the order the values actually appear. */
  legacy: string[];
  /** Rows this spec depends on being loaded first. */
  deps?: string[];
  /**
   * Columns of the destination table that carry a unique index. The legacy
   * data repeats some of these pairs, so the loader keeps the lowest id and
   * drops the rest.
   */
  uniqueBy?: string[];
  /** Returns the new row, or null to skip this record. */
  map: (row: LegacyRow, ctx: MigrationContext) => NewRow | null;
};

export type MigrationContext = {
  /** Ids that exist in an already-loaded table, used to drop orphans. */
  known: Map<string, Set<string>>;
  /** Rows dropped or altered, with the reason, for the run summary. */
  notes: { table: string; reason: string; id: string }[];
};

// ---------------------------------------------------------------------------
// Value coercion
// ---------------------------------------------------------------------------

/** MySQL wrote `''` for NULL and, in a few free-text columns, the word "null". */
export function text(v: string | undefined): string | null {
  if (v === undefined) return null;
  const trimmed = v.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'null') return null;
  return trimmed;
}

/** For NOT NULL text columns: same cleaning, but an absent value becomes ''. */
export function textOrEmpty(v: string | undefined): string {
  return text(v) ?? '';
}

export function int(v: string | undefined): number | null {
  const t = text(v);
  if (t === null) return null;
  const n = Number.parseInt(t, 10);
  return Number.isNaN(n) ? null : n;
}

export function num(v: string | undefined): number | null {
  const t = text(v);
  if (t === null) return null;
  const n = Number.parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

export function bool(v: string | undefined): boolean {
  const t = text(v);
  return t === '1' || t?.toLowerCase() === 'true';
}

/**
 * Legacy timestamps are naive strings written by Laravel, which ran in UTC.
 * Tag them as UTC rather than letting the loader guess a local zone.
 */
export function ts(v: string | undefined): string | null {
  const t = text(v);
  if (t === null) return null;
  const iso = t.replace(' ', 'T');
  // `0000-00-00 00:00:00`, MySQL's zero date, is not a real instant.
  if (iso.startsWith('0000-')) return null;
  return `${iso}Z`;
}

export function date(v: string | undefined): string | null {
  const t = text(v);
  if (t === null) return null;
  // `0001-01-01` is the placeholder the old signup form wrote for "no date".
  if (t.startsWith('0000-') || t === '0001-01-01') return null;
  return t.slice(0, 10);
}

/** `created_at`/`updated_at` are NOT NULL; fall back to the other, then to now. */
function stamps(row: LegacyRow, created = 'created_at', updated = 'updated_at') {
  const c = ts(row[created]);
  const u = ts(row[updated]);
  const fallback = c ?? u ?? new Date().toISOString();
  return { created_at: c ?? fallback, updated_at: u ?? fallback };
}

/** An S3 key, or null. Laravel's `/storage/...` public paths are not keys. */
export function fileKey(v: string | undefined): string | null {
  const t = text(v);
  if (t === null) return null;
  if (t.startsWith('/storage/')) return t.replace(/^\/storage\//, '');
  return t;
}

/**
 * `App\Notifications\ActividadGuardada` and the mangled `AppNotificationsActividadGuardada`
 * (the export lost the backslashes) both name the same event.
 */
const NOTIFICATION_TYPES: Record<string, string> = {
  ActividadGuardada: 'activity_saved',
  ActividadSubida: 'activity_published',
  ActividadDescargada: 'activity_downloaded',
  ActividadComentada: 'activity_commented',
  ActividadSolicitaAutorizacion: 'activity_authorization_requested',
  EdicionActividadAutorizada: 'activity_edit_authorized',
  AutorizaEdicionActividad: 'activity_edit_authorization_granted',
  DeniegaEdicionActividad: 'activity_edit_authorization_denied',
  UsuarioSeguidor: 'user_followed',
  UsuarioMensaje: 'user_message',
};

export function notificationType(raw: string | undefined): string {
  const t = textOrEmpty(raw);
  const name = t.replace(/^App\\+Notifications\\+/, '').replace(/^AppNotifications/, '');
  return NOTIFICATION_TYPES[name] ?? 'unknown';
}

function json(v: string | undefined): unknown {
  const t = text(v);
  if (t === null) return {};
  try {
    return JSON.parse(t) as unknown;
  } catch {
    // A handful of payloads were truncated by the export; keep the raw text.
    return { raw: t };
  }
}

/** True when a foreign key resolves; notes the row when it does not. */
function requireRef(
  ctx: MigrationContext,
  table: string,
  refTable: string,
  value: number | null,
  id: string,
): boolean {
  if (value === null) return false;
  const set = ctx.known.get(refTable);
  if (!set || set.has(String(value))) return true;
  ctx.notes.push({ table, reason: `detached: no ${refTable} #${value} in the export`, id });
  return false;
}

// ---------------------------------------------------------------------------
// Table specs, in load order
// ---------------------------------------------------------------------------

export const SPECS: TableSpec[] = [
  {
    csv: 'paises.csv',
    table: 'tshare_countries',
    legacy: ['id', 'nombre', 'nacionalidad', 'created_at', 'updated_at'],
    map: (r) => ({
      id: int(r.id),
      name: textOrEmpty(r.nombre),
      nationality: text(r.nacionalidad),
      ...stamps(r),
    }),
  },

  {
    csv: 'labels.csv',
    table: 'tshare_labels',
    uniqueBy: ['country_id', 'key'],
    legacy: ['id', 'nombre', 'label', 'pais_id', 'created_at', 'updated_at'],
    deps: ['tshare_countries'],
    map: (r) => ({
      id: int(r.id),
      key: textOrEmpty(r.nombre),
      label: textOrEmpty(r.label),
      country_id: int(r.pais_id),
      ...stamps(r),
    }),
  },

  {
    csv: 'roles.csv',
    table: 'tshare_roles',
    uniqueBy: ['slug'],
    legacy: ['id', 'name', 'guard_name', 'deleted_at', 'created_at', 'updated_at'],
    map: (r) => ({
      id: int(r.id),
      name: textOrEmpty(r.name),
      slug: textOrEmpty(r.guard_name),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'cursos.csv',
    table: 'tshare_grades',
    legacy: ['id', 'nombre', 'descripcion', 'created_at', 'updated_at', 'deleted_at'],
    map: (r) => ({
      id: int(r.id),
      name: textOrEmpty(r.nombre),
      description: text(r.descripcion),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'ramos.csv',
    table: 'tshare_subjects',
    // `descripcion` was dropped from this table before the export was taken.
    legacy: ['id', 'nombre', 'imagen', 'created_at', 'updated_at', 'deleted_at', 'pais_id'],
    deps: ['tshare_countries'],
    map: (r) => ({
      id: int(r.id),
      name: textOrEmpty(r.nombre),
      image: text(r.imagen),
      country_id: int(r.pais_id),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'equivalencias.csv',
    table: 'tshare_subject_equivalences',
    legacy: ['id', 'equivalencia', 'ramo_id', 'created_at', 'updated_at'],
    deps: ['tshare_subjects'],
    map: (r) => ({
      id: int(r.id),
      equivalence_group: int(r.equivalencia) ?? 0,
      subject_id: int(r.ramo_id),
      ...stamps(r),
    }),
  },

  {
    csv: 'ramos_cursos.csv',
    table: 'tshare_subject_grades',
    legacy: ['id', 'deleted_at', 'created_at', 'updated_at', 'ramo_id', 'curso_id'],
    deps: ['tshare_subjects', 'tshare_grades'],
    map: (r) => ({
      id: int(r.id),
      subject_id: int(r.ramo_id),
      grade_id: int(r.curso_id),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'unidades.csv',
    table: 'tshare_units',
    legacy: [
      'id',
      'nombre',
      'descripcion',
      'deleted_at',
      'created_at',
      'updated_at',
      'ramo_curso_id',
    ],
    deps: ['tshare_subject_grades'],
    map: (r) => ({
      id: int(r.id),
      name: textOrEmpty(r.nombre),
      description: text(r.descripcion),
      subject_grade_id: int(r.ramo_curso_id),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'habilidades.csv',
    table: 'tshare_skills',
    // `actividad_id` was NULL in all 12 rows — this is a catalogue, not a join.
    legacy: ['id', 'nombre', 'descripcion', 'created_at', 'updated_at', 'actividad_id'],
    map: (r) => ({
      id: int(r.id),
      name: textOrEmpty(r.nombre),
      description: text(r.descripcion),
      ...stamps(r),
    }),
  },

  {
    csv: 'secciones.csv',
    table: 'tshare_sections',
    // Same: `actividad_id` was NULL in all 3 rows.
    legacy: ['id', 'nombre', 'descripcion', 'created_at', 'updated_at', 'actividad_id'],
    map: (r) => ({
      id: int(r.id),
      name: textOrEmpty(r.nombre),
      description: text(r.descripcion),
      position: int(r.id) ?? 0,
      ...stamps(r),
    }),
  },

  {
    csv: 'tipo_recurso.csv',
    table: 'tshare_resource_types',
    legacy: ['id', 'nombre', 'deleted_at', 'created_at', 'updated_at'],
    map: (r) => ({
      id: int(r.id),
      name: textOrEmpty(r.nombre),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'materiales_sugeridos.csv',
    table: 'tshare_suggested_materials',
    legacy: ['id', 'nombre', 'descripcion', 'created_at', 'updated_at'],
    map: (r) => ({
      id: int(r.id),
      name: textOrEmpty(r.nombre),
      description: text(r.descripcion),
      ...stamps(r),
    }),
  },

  {
    csv: 'colegios.csv',
    table: 'tshare_schools',
    legacy: [
      'id',
      'nombre',
      'direccion',
      'rbd',
      'deleted_at',
      'cod_region',
      'comuna',
      'created_at',
      'updated_at',
    ],
    map: (r) => ({
      id: int(r.id),
      name: textOrEmpty(r.nombre),
      address: text(r.direccion),
      rbd: int(r.rbd),
      region_code: int(r.cod_region),
      commune: text(r.comuna),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'users.csv',
    table: 'tshare_users',
    uniqueBy: ['email'],
    legacy: [
      'id',
      'name',
      'apellido',
      'email',
      'email_verified_at',
      'password',
      'dirigido',
      'genero',
      'nacimiento',
      'pais',
      'region',
      'sitio',
      'rut',
      'youtube',
      'twitter',
      'facebook',
      'instagram',
      'expired_at',
      'dias_restantes',
      'attemps_login',
      'active',
      'code_activate',
      'code_expiration',
      'descripcion',
      'verify_state',
      'remember_token',
      'created_at',
      'updated_at',
      'completa_datos',
      'avatar_public',
      'avatar',
      'deleted_at',
      'pais_id',
    ],
    deps: ['tshare_countries'],
    map: (r) => {
      const email = text(r.email);
      if (!email) return null;
      // `pais` is free text and often just holds the country id as a string.
      const countryName = text(r.pais);
      return {
        id: int(r.id),
        first_name: textOrEmpty(r.name),
        last_name: text(r.apellido),
        email: email.toLowerCase(),
        email_verified_at: ts(r.email_verified_at),
        password_hash: textOrEmpty(r.password),
        // Every migrated account still carries the Laravel hash, so every
        // account is asked for a new password the first time it signs in.
        must_change_password: true,
        login_attempts: int(r.attemps_login) ?? 0,
        remember_token: text(r.remember_token),
        bio: text(r.descripcion),
        audience: text(r.dirigido),
        gender: text(r.genero),
        birth_date: date(r.nacimiento),
        national_id: text(r.rut),
        country_id: int(r.pais_id),
        country_name: countryName && !/^\d+$/.test(countryName) ? countryName : null,
        region: text(r.region),
        website_url: text(r.sitio),
        youtube_url: text(r.youtube),
        twitter_url: text(r.twitter),
        facebook_url: text(r.facebook),
        instagram_url: text(r.instagram),
        // `avatar` and `avatar_public` held the same key in every row that had
        // one; keep the first that is set.
        avatar_key: fileKey(r.avatar) ?? fileKey(r.avatar_public),
        is_active: bool(r.active),
        is_verified: bool(r.verify_state),
        profile_completed: bool(r.completa_datos),
        activation_code: text(r.code_activate),
        activation_expires_on: date(r.code_expiration),
        subscription_expires_at: ts(r.expired_at),
        remaining_days: int(r.dias_restantes),
        deleted_at: ts(r.deleted_at),
        ...stamps(r),
      };
    },
  },

  {
    csv: 'roles_users.csv',
    table: 'tshare_user_roles',
    uniqueBy: ['user_id', 'role_id'],
    legacy: ['id', 'rol_id', 'user_id', 'created_at', 'updated_at'],
    deps: ['tshare_users', 'tshare_roles'],
    map: (r) => ({
      id: int(r.id),
      role_id: int(r.rol_id),
      user_id: int(r.user_id),
      ...stamps(r),
    }),
  },

  {
    csv: 'colegios_users.csv',
    table: 'tshare_school_users',
    uniqueBy: ['school_id', 'user_id'],
    legacy: ['id', 'colegio_id', 'user_id', 'created_at', 'updated_at'],
    deps: ['tshare_users', 'tshare_schools'],
    map: (r) => ({
      id: int(r.id),
      school_id: int(r.colegio_id),
      user_id: int(r.user_id),
      ...stamps(r),
    }),
  },

  {
    csv: 'ramos_users.csv',
    table: 'tshare_user_subjects',
    uniqueBy: ['user_id', 'subject_id'],
    legacy: ['id', 'created_at', 'updated_at', 'ramo_id', 'user_id'],
    deps: ['tshare_users', 'tshare_subjects'],
    map: (r) => ({
      id: int(r.id),
      subject_id: int(r.ramo_id),
      user_id: int(r.user_id),
      ...stamps(r),
    }),
  },

  {
    csv: 'users_cursos.csv',
    table: 'tshare_user_grades',
    uniqueBy: ['user_id', 'grade_id'],
    legacy: ['id', 'created_at', 'updated_at', 'user_id', 'curso_id'],
    deps: ['tshare_users', 'tshare_grades'],
    map: (r) => ({
      id: int(r.id),
      user_id: int(r.user_id),
      grade_id: int(r.curso_id),
      ...stamps(r),
    }),
  },

  {
    csv: 'users_habilidades.csv',
    table: 'tshare_user_skills',
    uniqueBy: ['user_id', 'skill_id'],
    legacy: ['id', 'created_at', 'updated_at', 'user_id', 'habilidad_id'],
    deps: ['tshare_users', 'tshare_skills'],
    map: (r) => ({
      id: int(r.id),
      user_id: int(r.user_id),
      skill_id: int(r.habilidad_id),
      ...stamps(r),
    }),
  },

  {
    csv: 'user_grupos.csv',
    table: 'tshare_user_groups',
    legacy: ['id', 'nombre', 'created_at', 'updated_at', 'deleted_at', 'user_id'],
    deps: ['tshare_users'],
    map: (r) => ({
      id: int(r.id),
      name: text(r.nombre),
      user_id: int(r.user_id),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'seguidores.csv',
    table: 'tshare_follows',
    uniqueBy: ['follower_id', 'followed_id'],
    legacy: ['id', 'created_at', 'updated_at', 'user_id', 'seguido_id'],
    deps: ['tshare_users'],
    map: (r, ctx) => {
      const follower = int(r.user_id);
      const followed = int(r.seguido_id);
      // A few legacy rows have a user following themselves, which the new
      // check constraint rejects.
      if (follower === null || followed === null || follower === followed) {
        ctx.notes.push({ table: 'tshare_follows', reason: 'dropped: follows itself', id: r.id });
        return null;
      }
      return { id: int(r.id), follower_id: follower, followed_id: followed, ...stamps(r) };
    },
  },

  {
    csv: 'actividades.csv',
    table: 'tshare_activities',
    legacy: [
      'id',
      'nombre',
      'objetivos',
      'avatar',
      'duracion',
      'avatar_public',
      'descripcion',
      'puntaje',
      'pdf',
      'pdf_public',
      'evaluation',
      'deleted_at',
      'created_at',
      'updated_at',
      'user_id',
    ],
    deps: ['tshare_users'],
    map: (r) => ({
      id: int(r.id),
      title: textOrEmpty(r.nombre),
      learning_objective: text(r.objetivos),
      description: text(r.descripcion),
      evaluation: text(r.evaluation),
      duration_minutes: int(r.duracion),
      rating: num(r.puntaje),
      // `avatar_public` repeated `avatar` wherever both were set, and was a
      // stock illustration elsewhere; `avatar` is the authored image.
      cover_image_key: fileKey(r.avatar) ?? fileKey(r.avatar_public),
      // `pdf` and `pdf_public` were identical in all 1172 rows.
      pdf_key: fileKey(r.pdf) ?? fileKey(r.pdf_public),
      user_id: int(r.user_id),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'actividades_ramos_cursos.csv',
    table: 'tshare_activity_subject_grades',
    legacy: ['id', 'deleted_at', 'created_at', 'updated_at', 'ramo_curso_id', 'actividad_id'],
    deps: ['tshare_activities', 'tshare_subject_grades'],
    map: (r) => ({
      id: int(r.id),
      activity_id: int(r.actividad_id),
      subject_grade_id: int(r.ramo_curso_id),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'unidades_actividades.csv',
    table: 'tshare_activity_units',
    uniqueBy: ['activity_id', 'unit_id'],
    legacy: ['id', 'created_at', 'updated_at', 'actividad_id', 'unidad_id'],
    deps: ['tshare_activities', 'tshare_units'],
    map: (r) => ({
      id: int(r.id),
      activity_id: int(r.actividad_id),
      unit_id: int(r.unidad_id),
      ...stamps(r),
    }),
  },

  {
    csv: 'actividades_secciones.csv',
    table: 'tshare_activity_sections',
    uniqueBy: ['activity_id', 'section_id'],
    legacy: ['id', 'created_at', 'updated_at', 'actividad_id', 'seccion_id'],
    deps: ['tshare_activities', 'tshare_sections'],
    map: (r) => ({
      id: int(r.id),
      activity_id: int(r.actividad_id),
      section_id: int(r.seccion_id),
      ...stamps(r),
    }),
  },

  {
    csv: 'actividades_habilidades.csv',
    table: 'tshare_activity_skills',
    uniqueBy: ['activity_id', 'skill_id'],
    // `nombre`/`descripcion` only repeated the skill's own row.
    legacy: [
      'id',
      'nombre',
      'descripcion',
      'created_at',
      'updated_at',
      'actividad_id',
      'habilidad_id',
    ],
    deps: ['tshare_activities', 'tshare_skills'],
    map: (r) => ({
      id: int(r.id),
      activity_id: int(r.actividad_id),
      skill_id: int(r.habilidad_id),
      ...stamps(r),
    }),
  },

  {
    csv: 'recursos.csv',
    table: 'tshare_activity_resources',
    // `archivo_public` was `archivo` under Laravel's /storage prefix.
    legacy: [
      'id',
      'nombre',
      'url',
      'archivo',
      'archivo_public',
      'deleted_at',
      'created_at',
      'updated_at',
      'actividad_id',
      'tipo_recurso_id',
    ],
    deps: ['tshare_activities', 'tshare_resource_types'],
    map: (r) => ({
      id: int(r.id),
      activity_id: int(r.actividad_id),
      resource_type_id: int(r.tipo_recurso_id),
      name: textOrEmpty(r.nombre),
      external_url: text(r.url),
      file_key: fileKey(r.archivo) ?? fileKey(r.archivo_public),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'instrucciones.csv',
    table: 'tshare_activity_instructions',
    legacy: [
      'id',
      'nombre',
      'descripcion',
      'url',
      'archivo',
      'archivo_public',
      'created_at',
      'updated_at',
      'deleted_at',
      'actividad_id',
    ],
    deps: ['tshare_activities'],
    map: (r) => ({
      id: int(r.id),
      activity_id: int(r.actividad_id),
      name: textOrEmpty(r.nombre),
      body: text(r.descripcion),
      external_url: text(r.url),
      file_key: fileKey(r.archivo) ?? fileKey(r.archivo_public),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'materiales.csv',
    table: 'tshare_activity_materials',
    // `apellido` was empty in all 3810 rows.
    legacy: [
      'id',
      'nombre',
      'apellido',
      'url',
      'archivo',
      'archivo_public',
      'deleted_at',
      'created_at',
      'updated_at',
      'actividad_id',
    ],
    deps: ['tshare_activities'],
    map: (r) => ({
      id: int(r.id),
      activity_id: int(r.actividad_id),
      name: textOrEmpty(r.nombre),
      external_url: text(r.url),
      file_key: fileKey(r.archivo) ?? fileKey(r.archivo_public),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'actividades_guardadas.csv',
    table: 'tshare_saved_activities',
    uniqueBy: ['activity_id', 'user_id'],
    legacy: ['id', 'created_at', 'updated_at', 'actividad_id', 'user_id'],
    deps: ['tshare_activities', 'tshare_users'],
    map: (r) => ({
      id: int(r.id),
      activity_id: int(r.actividad_id),
      user_id: int(r.user_id),
      ...stamps(r),
    }),
  },

  {
    csv: 'actividades_descargadas.csv',
    table: 'tshare_activity_downloads',
    uniqueBy: ['activity_id', 'user_id'],
    legacy: ['id', 'cantidad', 'created_at', 'updated_at', 'actividad_id', 'user_id'],
    deps: ['tshare_activities', 'tshare_users'],
    map: (r) => ({
      id: int(r.id),
      activity_id: int(r.actividad_id),
      user_id: int(r.user_id),
      quantity: int(r.cantidad) ?? 1,
      ...stamps(r),
    }),
  },

  {
    csv: 'user_autoriza_actividad.csv',
    table: 'tshare_activity_authorizations',
    legacy: ['id', 'status', 'created_at', 'updated_at', 'user_id', 'actividad_id'],
    deps: ['tshare_activities', 'tshare_users'],
    map: (r) => ({
      id: int(r.id),
      activity_id: int(r.actividad_id),
      user_id: int(r.user_id),
      is_granted: bool(r.status),
      ...stamps(r),
    }),
  },

  {
    csv: 'comentarios.csv',
    table: 'tshare_comments',
    legacy: [
      'id',
      'comentario',
      'puntaje',
      'status',
      'created_at',
      'updated_at',
      'user_id',
      'actividad_id',
    ],
    deps: ['tshare_activities', 'tshare_users'],
    map: (r) => ({
      id: int(r.id),
      activity_id: int(r.actividad_id),
      user_id: int(r.user_id),
      body: textOrEmpty(r.comentario),
      rating: num(r.puntaje),
      is_published: bool(r.status),
      ...stamps(r),
    }),
  },

  {
    csv: 'reactions.csv',
    table: 'tshare_comment_reactions',
    legacy: [
      'id',
      'comment',
      'is_comment',
      'is_like',
      'created_at',
      'updated_at',
      'comment_id',
      'user_id',
    ],
    deps: ['tshare_comments', 'tshare_users'],
    map: (r) => ({
      id: int(r.id),
      comment_id: int(r.comment_id),
      user_id: int(r.user_id),
      body: text(r.comment),
      is_comment: bool(r.is_comment),
      is_like: bool(r.is_like),
      ...stamps(r),
    }),
  },

  {
    csv: 'users_mensajes.csv',
    table: 'tshare_messages',
    legacy: [
      'id',
      'mensaje',
      'leido',
      'created_at',
      'updated_at',
      'deleted_at',
      'hash',
      'de',
      'para',
    ],
    deps: ['tshare_users'],
    map: (r) => ({
      id: int(r.id),
      sender_id: int(r.de),
      recipient_id: int(r.para),
      body: textOrEmpty(r.mensaje),
      is_read: bool(r.leido),
      thread_hash: text(r.hash),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'notifications.csv',
    table: 'tshare_notifications',
    // `notifiable_type` was App\User / App\Models\User in every row.
    legacy: [
      'id',
      'type',
      'notifiable_type',
      'notifiable_id',
      'data',
      'read_at',
      'created_at',
      'updated_at',
    ],
    deps: ['tshare_users'],
    map: (r, ctx) => {
      const userId = int(r.notifiable_id);
      // Two rows point at users that are not in the export; keep the
      // notification but detach it rather than fail the whole load.
      const owner = requireRef(ctx, 'tshare_notifications', 'tshare_users', userId, r.id)
        ? userId
        : null;
      return {
        id: text(r.id),
        user_id: owner,
        type: notificationType(r.type),
        data: json(r.data),
        read_at: ts(r.read_at),
        ...stamps(r),
      };
    },
  },

  {
    csv: 'eventos.csv',
    table: 'tshare_events',
    legacy: ['id', 'nombre', 'descripcion', 'fecha_evento', 'created_at', 'updated_at', 'user_id'],
    deps: ['tshare_users'],
    map: (r) => ({
      id: int(r.id),
      user_id: int(r.user_id),
      name: textOrEmpty(r.nombre),
      description: text(r.descripcion),
      event_at: ts(r.fecha_evento),
      ...stamps(r),
    }),
  },

  {
    csv: 'subscriptores.csv',
    table: 'tshare_newsletter_subscribers',
    uniqueBy: ['email'],
    legacy: [
      'id',
      'email',
      'nombre',
      'apellido',
      'correo_enviado',
      'intentos',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    map: (r) => {
      const email = text(r.email);
      if (!email) return null;
      return {
        id: int(r.id),
        email: email.toLowerCase(),
        first_name: text(r.nombre),
        last_name: text(r.apellido),
        emails_sent: int(r.correo_enviado) ?? 0,
        attempts: int(r.intentos) ?? 0,
        deleted_at: ts(r.deleted_at),
        ...stamps(r),
      };
    },
  },

  {
    csv: 'subscripcion.csv',
    table: 'tshare_plans',
    legacy: ['id', 'nombre', 'valor', 'duracion', 'created_at', 'updated_at', 'deleted_at'],
    map: (r) => ({
      id: int(r.id),
      name: text(r.nombre),
      price: int(r.valor),
      duration_days: int(r.duracion),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'subscripcion_detalle.csv',
    table: 'tshare_plan_features',
    legacy: [
      'id',
      'item',
      'valor',
      'created_at',
      'updated_at',
      'deleted_at',
      'subscripcion_id',
    ],
    deps: ['tshare_plans'],
    map: (r) => ({
      id: int(r.id),
      plan_id: int(r.subscripcion_id),
      item: text(r.item),
      value: text(r.valor),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'subscripcion_rol.csv',
    table: 'tshare_plan_roles',
    uniqueBy: ['plan_id', 'role_id'],
    legacy: ['id', 'created_at', 'updated_at', 'deleted_at', 'rol_id', 'subscripcion_id'],
    deps: ['tshare_plans', 'tshare_roles'],
    map: (r) => ({
      id: int(r.id),
      plan_id: int(r.subscripcion_id),
      role_id: int(r.rol_id),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'tbk_compra.csv',
    table: 'tshare_payments',
    legacy: [
      'id',
      'orden_compra',
      'valor',
      'detalle',
      'accountingDate',
      'buyOrder',
      'cardNumber',
      'cardExpirationDate',
      'authorizationCode',
      'paymentTypeCode',
      'responseCode',
      'sharesNumber',
      'amount',
      'commerceCode',
      'sessionId',
      'transactionDate',
      'VCI',
      'token_ws',
      'created_at',
      'updated_at',
      'deleted_at',
      'user_id',
    ],
    deps: ['tshare_users'],
    map: (r) => ({
      id: int(r.id),
      user_id: int(r.user_id),
      order_number: int(r.orden_compra),
      amount_clp: int(r.valor),
      detail: text(r.detalle),
      accounting_date: text(r.accountingDate),
      buy_order: text(r.buyOrder),
      card_last4: text(r.cardNumber),
      card_expiration: text(r.cardExpirationDate),
      authorization_code: text(r.authorizationCode),
      payment_type_code: text(r.paymentTypeCode),
      response_code: int(r.responseCode),
      installments: text(r.sharesNumber),
      amount: text(r.amount),
      commerce_code: text(r.commerceCode),
      session_id: text(r.sessionId),
      transaction_date: ts(r.transactionDate),
      vci: text(r.VCI),
      token_ws: text(r.token_ws),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },

  {
    csv: 'productos_compra.csv',
    table: 'tshare_purchase_items',
    legacy: [
      'id',
      'tipo',
      'valor',
      'created_at',
      'updated_at',
      'deleted_at',
      'subscripcion_id',
      'tbk_compra_id',
    ],
    deps: ['tshare_plans', 'tshare_payments'],
    map: (r) => ({
      id: int(r.id),
      payment_id: int(r.tbk_compra_id),
      plan_id: int(r.subscripcion_id),
      type: text(r.tipo),
      amount: int(r.valor),
      deleted_at: ts(r.deleted_at),
      ...stamps(r),
    }),
  },
];

/** Tables whose identity sequence has to be pushed past the imported ids. */
export const SEQUENCE_TABLES = SPECS.map((s) => s.table).filter(
  (t) => t !== 'tshare_notifications',
);
