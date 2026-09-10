# T-share · Next.js + Supabase

Reemplaza los dos proyectos antiguos: el front Angular 11 de `../t-share-front` y
la API Laravel de `../t-share-back`, con su base MySQL. La UI sigue el rediseño de
`RedesignT-Share.org/T-share Rediseño.dc.html`.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind
CSS v4 · Supabase (Postgres) · S3 · Netlify.

```bash
npm run dev        # servidor de desarrollo
npm run build      # build de producción
npm run typecheck
npm run lint
npm test           # unitarios (Vitest)
npm run test:e2e   # end-to-end (Playwright)
```

## Cómo está armado

No hay backend separado: los Server Components leen Supabase y las Server
Actions escriben. La *service role key* nunca sale del servidor.

- **Sin Supabase Auth y sin RLS.** El servidor Next.js es el único cliente de la
  base, así que la autorización vive en las acciones y en `src/proxy.ts`. La
  sesión es un JWT firmado (`jose`) en una cookie httpOnly.
- **Todas las tablas con prefijo `tshare_`**, porque el proyecto Supabase es
  compartido con otras aplicaciones.
- **Todo dinámico.** Las asignaturas, niveles, habilidades y tipos de recurso
  salen de la base; agregar uno en Supabase basta para que aparezca en los
  filtros y en el formulario de subida.

```
db/                   esquema y migración de datos (ver db/README.md)
src/
  app/                rutas (App Router)
  components/         UI
  lib/
    supabase.ts       cliente service-role + nombres de tabla
    activities.ts     consultas de actividades
    catalog.ts        catálogos para filtros y formularios
    comments.ts       comentarios
    users.ts          cuentas y perfil
    storage.ts        S3: subida y URLs firmadas
    auth/             contraseñas, token de sesión, acciones de cuenta
    activity-actions.ts  guardar, descargar, comentar, publicar
    filters.ts        lectura de la query string
    format.ts         strings de presentación
  proxy.ts            rutas protegidas + cambio de contraseña forzado
tests/unit/           Vitest
tests/e2e/            Playwright
```

## Rutas

Las URLs se mantienen iguales a las del front Angular para no romper enlaces ni SEO.

| Ruta | Qué es | Acceso |
| --- | --- | --- |
| `/` | Portada: búsqueda, asignaturas y lo más reciente | público |
| `/actividades` | Buscador con filtros, orden y paginación | público |
| `/actividades/detalle/[id]` | Ficha, documentos, momentos de la clase, comentarios | público |
| `/actividades/crear` | Publicar una actividad, con subida de archivos | con cuenta |
| `/mi-perfil` | Subidas y guardadas | con cuenta |
| `/entrar`, `/registro` | Sesión | visitante |
| `/cambiar-password` | Cambio de contraseña (forzado tras la migración) | con cuenta |

## Puesta en marcha

1. **Base de datos.** Sigue [`db/README.md`](db/README.md): crear el proyecto
   Supabase, aplicar `db/schema.sql` y correr `npm run db:migrate`.
2. **Entorno.** `cp .env.example .env.local` y completar. `SESSION_SECRET` se
   genera con `openssl rand -base64 32`.
3. **S3.** El bucket actual se sigue usando tal cual: no se migra nada. Las
   subidas nuevas van al mismo bucket y guardan la URL en la base; los archivos
   antiguos se sirven con una URL firmada a partir de su *key*.

## Contraseñas migradas

Las cuentas traen el hash bcrypt de Laravel (`$2y$`). La aplicación lo acepta
—es el mismo algoritmo bajo otro prefijo—, así que cada profesor entra con la
contraseña que ya tenía; en ese mismo ingreso se le exige una nueva, que queda
guardada con el hash de esta aplicación. Detalle en `db/README.md`.

## Tests

`npm test` corre 122 pruebas unitarias sin necesidad de base de datos. Entre
otras cosas fijan el mapeo de la migración contra los CSV reales, la
verificación de los hashes `$2y$`, el token de sesión, el armado de filtros y el
formulario de subida.

`npm run test:e2e` maneja la aplicación real contra un proyecto Supabase. Antes:

```bash
npm run db:seed:e2e      # fixtures deterministas (ids desde 900000)
npm run test:e2e
npm run db:seed:e2e -- --drop   # limpiar
```

Sin credenciales en `.env.local` la suite se reporta como *skipped* en vez de
fallar, así que `npm test && npm run test:e2e` es seguro en cualquier máquina.

## Deploy en Netlify

`netlify.toml` ya está configurado con `@netlify/plugin-nextjs`, que corre los
Server Components, las Server Actions y el proxy como funciones.

En **Site configuration → Environment variables** hay que cargar las mismas
variables de `.env.example`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SESSION_SECRET`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY` y, si corresponde, `S3_PUBLIC_BASE_URL`.

```bash
netlify link      # una vez
netlify deploy --build --prod
```
