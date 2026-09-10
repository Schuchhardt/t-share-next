# Migración de T-share a Supabase

Reemplaza la base MySQL que estaba detrás de `t-share-back` (Laravel) y
`t-share-front` (Angular). Todo queda en un proyecto Supabase con el prefijo
`tshare_`, sin Supabase Auth y sin RLS: el servidor Next.js es el único cliente
y usa la *service role key*.

| Archivo | Qué es |
| --- | --- |
| `schema.sql` | El esquema completo: 43 tablas, índices, triggers y dos funciones auxiliares. |
| `legacy-map.ts` | El mapeo columna a columna del export legacy al esquema nuevo. Es el corazón de la migración. |
| `scripts/loader.ts` | Lectura y normalización de los CSV (sin base de datos de por medio). |
| `scripts/migrate.ts` | Carga los datos en Supabase. |
| `scripts/verify.ts` | Compara lo cargado contra lo que el export contiene. |
| `scripts/inspect.ts` | Parsea el export sin escribir nada; sirve para revisar el mapeo. |
| `scripts/seed-e2e.ts` | Fixtures deterministas para la suite de Playwright. |

## El problema del encabezado

Los CSV de `t-share-back/db_export_backup2026/` tienen el encabezado **ordenado
alfabéticamente**, pero los valores siguen el orden real de columnas de la
tabla. Leerlos por nombre desordena todos los campos: en `users.csv` el `id`
queda bajo `active` y el email bajo `avatar`.

```
﻿active,apellido,attemps_login,avatar,...     <- encabezado alfabético
2296,Angela,Palma,angelapalmalc@gmail.com,... <- id, name, apellido, email
```

Por eso el loader descarta el encabezado y lee por posición contra los arreglos
`legacy` de `legacy-map.ts`. Ese orden se reconstruyó desde las migraciones de
Laravel (`t-share-back/database/migrations/`) y se verificó contra los datos:

- la columna 0 es única en los 43 archivos (es el `id`),
- las fechas caen en columnas de fecha y los hashes bcrypt en `password`,
- todas las llaves foráneas resuelven (salvo 2 notificaciones, ver abajo).

`tests/unit/legacy-map.test.ts` vuelve a comprobar esto contra el export real en
cada `npm test`, incluido el conteo de columnas de cada archivo.

## Normalización

Nombres de tabla y columna en inglés (`nombre` → `name`, `descripcion` →
`description`, `de`/`para` → `sender_id`/`recipient_id`). Además se descartaron
columnas que no aportaban nada:

| Se elimina | Por qué |
| --- | --- |
| `materiales.apellido` | Vacía en las 3 810 filas. |
| `actividades.avatar_public` | Repetía `avatar` en todas las filas que tenían ambos. |
| `actividades.pdf_public` | Idéntica a `pdf` en las 1 172 filas. |
| `recursos/instrucciones/materiales.archivo_public` | Era `archivo` con el prefijo `/storage/` de Laravel. |
| `actividades_habilidades.nombre` y `.descripcion` | Repetían la fila de `habilidades`. |
| `habilidades.actividad_id`, `secciones.actividad_id` | NULL en todas las filas: son catálogos, no relaciones. |
| `notifications.notifiable_type` | Siempre apuntaba a usuarios; la relación polimórfica colapsa a `user_id`. |
| `ramos.descripcion` | Ya no existía en el export. |

Otros ajustes:

- `notifications.type` pasa de `App\Notifications\ActividadGuardada` (y de la
  variante `AppNotificationsActividadGuardada`, con las barras perdidas en el
  export) a `activity_saved`.
- Las fechas `0001-01-01` que el formulario antiguo escribía en
  `code_expiration` quedan en NULL.
- Los timestamps se interpretan como UTC, que es donde corría Laravel.
- Se agregan `saved_count` y `download_count` a `tshare_activities`, mantenidas
  por triggers, para poder ordenar por "más usadas" sin un group by.

### Filas que se ajustan

- **Duplicados exactos del export** (73 en `actividades_ramos_cursos`, 6 en
  `actividades_guardadas`, y unos pocos más): se conserva la primera.
- **Pares repetidos** en tablas de unión (`roles_users`, `ramos_users`,
  `users_cursos`…) que ahora tienen índice único: se conserva el `id` menor.
- **2 notificaciones** apuntan a los usuarios 115 y 516, que no están en el
  export. La notificación se conserva con `user_id` en NULL.

## Cómo correrla

### 1. Crear el proyecto Supabase

Uno nuevo, dedicado a T-share. Anota la URL y la *service role key*
(Settings → API).

### 2. Aplicar el esquema

Desde el SQL editor del dashboard, pegando `schema.sql`, o por línea de comandos:

```bash
psql "$SUPABASE_DB_URL" -f db/schema.sql
```

Habilita `citext` y `pg_trgm`, que Supabase ya trae.

### 3. Configurar el entorno

```bash
cp .env.example .env.local
# y completar SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET y las S3_*
```

### 4. Revisar antes de escribir

```bash
npm run db:inspect                  # parsea todo el export, no toca la base
npm run db:inspect -- tshare_users  # además imprime las dos primeras filas
```

Debe reportar **75 177 filas en 43 tablas**.

### 5. Cargar

```bash
npm run db:migrate -- --dry-run   # una pasada más, sin escribir
npm run db:migrate                # la carga real
npm run db:verify                 # esperado vs. cargado, tabla por tabla
```

La carga hace *upsert* por llave primaria, así que volver a correrla repara una
carga parcial en vez de duplicarla. Al terminar recalcula los contadores de
actividades y reordena las secuencias de identidad, para que el primer registro
que inserte la aplicación no choque con un id migrado.

## Contraseñas

Las 2 986 cuentas traen el hash de Laravel, con prefijo `$2y$`. Es el mismo
bcrypt que `$2a$` — PHP eligió otro identificador — así que la aplicación lo
verifica tal cual y **el profesor entra con la contraseña que ya tenía**.

La migración marca `must_change_password = true` en todas. Entonces:

1. Entra con su contraseña de siempre.
2. `src/proxy.ts` lo lleva a `/cambiar-password` y no lo deja salir de ahí.
3. Define una contraseña nueva, que esta aplicación guarda con su propio costo
   bcrypt y baja la marca.

Nadie queda fuera y ningún hash de PHP sobrevive al primer ingreso.

## Archivos

El bucket S3 **no se migra**. Cada tabla con archivos tiene dos columnas:

- `*_key` — la llave del objeto S3, tal como la escribió Laravel. Son objetos
  privados, así que leerlos significa firmar una URL temporal (lo mismo que
  hacía `Storage::disk('s3')->temporaryUrl(...)`).
- `*_url` — una URL absoluta, que escriben las subidas nuevas.

`src/lib/storage.ts` resuelve la que exista. Si defines `S3_PUBLIC_BASE_URL`
—un CDN o un bucket público— se saltan las firmas.
