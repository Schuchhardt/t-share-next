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
    preview.ts        qué archivos se pueden mostrar sin descargar
    seo.ts            canonical, snippets y datos estructurados
    email.ts          envío por Resend
    notifications.ts  los correos que manda la aplicación
    auth/             contraseñas y su formato, token de sesión, acciones de
                      cuenta, tokens de recuperación y de acceso
  emails/             las plantillas, en React Email
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
| `/mi-perfil/editar` | Nombre, foto de perfil y contraseña | con cuenta |
| `/entrar`, `/registro` | Sesión | visitante |
| `/cambiar-password` | Cambio de contraseña (forzado tras la migración) | con cuenta |
| `/recuperar-clave` | Pedir un enlace de recuperación por correo | público |
| `/cambiar-clave` | Elegir contraseña nueva desde ese enlace | con el token |
| `/acceso` | Enlace de acceso: entra y manda a elegir contraseña | con el token |
| `/sitemap.xml`, `/robots.txt` | Generados desde la base (ver [SEO](#seo)) | público |

## SEO

Las URLs son las mismas del sitio Angular, así que lo que ya estaba indexado
sigue resolviendo. Sobre eso:

- **`APP_URL` es el origen canónico.** De ahí salen el `metadataBase`, los
  `<link rel="canonical">`, el sitemap y las URLs de las imágenes sociales. En
  producción tiene que ser `https://t-share.org`; si queda apuntando a otro
  lado, el sitio se indexa con ese otro dominio.
- **`/sitemap.xml`** lista la portada, `/actividades`, cada asignatura con
  actividades detrás y las ~920 fichas, con la fecha de `updated_at`. Se
  regenera cada hora. **`/robots.txt`** lo anuncia y cierra las pantallas de
  cuenta.
- **Cada actividad tiene su propia tarjeta social**, dibujada en
  `opengraph-image.tsx` con el título, la ficha y el autor. No se usa la
  portada de la actividad: el bucket es privado, su URL firmada dura seis horas
  y un enlace compartido el lunes se vería roto el martes.
- **Datos estructurados** (JSON-LD): `Organization` y `WebSite` en todas las
  páginas, y en cada ficha un `LearningResource` con objetivo, asignatura,
  nivel y duración, más su `BreadcrumbList`. No se declara `aggregateRating`:
  la columna `rating` que llegó en la migración no tiene votos detrás, y una
  nota sin ellos es justo lo que Google penaliza.
- **Qué se indexa de `/actividades`.** La página base y la de una sola faceta
  —una asignatura, un nivel— son categorías reales y se indexan. Una búsqueda,
  varias facetas juntas o una página dos llevan `noindex, follow`: no entran al
  índice, pero el crawler igual pasa por ellas hasta las fichas.
- **Fuera del índice**: `/entrar`, `/registro`, `/mi-perfil`,
  `/actividades/crear` y las tres pantallas de contraseña.

## Puesta en marcha

1. **Base de datos.** Sigue [`db/README.md`](db/README.md): crear el proyecto
   Supabase, aplicar `db/schema.sql` y correr `npm run db:migrate`.
2. **Entorno.** `cp .env.example .env.local` y completar. `SESSION_SECRET` se
   genera con `openssl rand -base64 32`.
3. **S3.** El bucket actual se sigue usando tal cual: no se migra nada. Las
   subidas nuevas van al mismo bucket y guardan la URL en la base; los archivos
   antiguos se sirven con una URL firmada a partir de su *key*. El bucket es
   privado, así que `S3_PUBLIC_BASE_URL` tiene que quedar vacía. Cuánto puede
   pesar un archivo y por qué: ver [Subida de archivos](#subida-de-archivos).
4. **Correo.** `RESEND_API_KEY` y, en local, `APP_URL=http://localhost:9796`.
   Ver [Correo](#correo).

## Subida de archivos

Los archivos **no** viajan dentro del server action. Uno acepta 1 MB de cuerpo,
así que publicar con una guía adjunta moría con `Body exceeded 1 MB limit` y el
profesor perdía el formulario entero sin ver un mensaje. En vez de eso el
navegador los manda de a uno a `POST /api/subidas` —una ruta normal, sin ese
tope—, que los deja en el bucket y devuelve la *key*; el formulario manda
después solo esas referencias.

Como la *key* la manda el navegador, no se le cree sola: la ruta devuelve
también un *ticket* —un JWT firmado con `SESSION_SECRET` que ata esa *key* a ese
profesor— y `createActivity` solo acepta claves que vengan con el suyo
(`src/lib/upload-ticket.ts`). Sin eso, un formulario manipulado podría colgar de
su actividad cualquier objeto del bucket.

### Por qué 4 MB

Es el techo de la plataforma, no una decisión de diseño: la función de Netlify
que corre la ruta acepta 6 MB de payload, y como el binario viaja en base64 eso
deja unos 4,5 MB reales. Los máximos viven en `src/lib/uploads.ts` —4 MB por
documento, 3 MB la portada— y los usan el navegador y el servidor, para que el
aviso y la regla no puedan separarse.

Para subir más que eso hay que sacar los archivos del servidor: el navegador
tendría que escribir directo en S3 con una URL firmada, y para eso **el bucket
necesita una regla CORS que hoy no tiene** (responde `CORS is not enabled for
this bucket`). El día que se pueda configurar, en *S3 → el bucket → Permissions
→ Cross-origin resource sharing*:

```json
[
  {
    "AllowedOrigins": ["https://t-share.org", "http://localhost:9796"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3000
  }
]
```

## Contraseñas migradas

Las cuentas traen el hash bcrypt de Laravel (`$2y$`). La aplicación lo acepta
—es el mismo algoritmo bajo otro prefijo—, así que cada profesor entra con la
contraseña que ya tenía; en ese mismo ingreso se le exige una nueva, que queda
guardada con el hash de esta aplicación. Detalle en `db/README.md`.

## Correo

Se manda por **Resend**, desde `comunidad@email.t-share.org`. El remitente vive
en un subdominio a propósito: su SPF y su DKIM quedan aparte del MX de
t-share.org, así que autenticar lo que manda la aplicación no toca el buzón que
lee el equipo. Quien responda un correo llega igual a `comunidad@t-share.org`,
por el `Reply-To`.

Los tres correos que ya existían conservan el asunto palabra por palabra, para
no romper los filtros que los profesores tengan armados:

| Cuándo | Asunto | Antes era |
| --- | --- | --- |
| Al crear una cuenta | ¡Bienvenido a T-share! | `WelcomeUser` |
| Al pedir recuperar la contraseña | Recuperación de contraseña - T-share | `PasswordReset` |
| Al comentar la actividad de otro | Han comentado tu actividad en T-share | `ActividadComentada` |
| Tras dos contraseñas erradas | Tu enlace para entrar a T-share | (nuevo) |

Los otros tres que mandaba correo en Laravel (`UsuarioMensaje`,
`ActividadSolicitaAutorizacion` y `AutorizaEdicionActividad`) son de la
mensajería interna y de la autorización de edición, que esta aplicación todavía
no tiene. Cuando existan, los constructores van en `src/lib/notifications.ts`
junto a los otros.

Sin `RESEND_API_KEY` no falla nada: el envío se registra en consola y la acción
sigue. En local conviene poner `APP_URL=http://localhost:9796`, o los enlaces
de los correos apuntan a producción.

El envío nunca bloquea al usuario. El de bienvenida, el de comentario y el de
acceso salen con `after()` —después de la respuesta— y ninguno convierte un
fallo de Resend en un error de formulario.

### Las plantillas

Cada correo es un componente de **React Email** en `src/emails/`, sobre un
`EmailLayout` común: logo, encabezado, cuerpo, botón y pie, con los mismos
colores que `globals.css`. `src/lib/notifications.ts` lo renderiza dos veces, a
HTML y a texto plano, así que las dos partes de un mensaje no pueden quedar
desfasadas y React escapa solo lo que escribió un profesor —el título de una
actividad ya no se concatena a mano dentro del markup.

El logo va como PNG (`public/brand/tshare-logo-email.png`, generado desde el
SVG de la marca): Gmail y Outlook no muestran SVG.

### Recuperación de contraseña

`tshare_password_resets` guarda un SHA-256 del token, nunca el token: la única
copia del valor real es la que va en el correo. Dura una hora, sirve una sola
vez, y pedir otro invalida el anterior. Las rutas son las mismas del sitio
Angular (`/recuperar-clave` y `/cambiar-clave?token=…`).

### Enlace de acceso tras dos intentos fallidos

Errar la contraseña dos veces seguidas no es un dedazo: es no acordarse. A la
segunda, `signIn` manda un enlace que entra directo —`/acceso?token=…`— y deja
al profesor en `/cambiar-password` para que elija una nueva. Esa pantalla no le
pide la anterior: el enlace ya demostró que el correo es suyo, y la contraseña
vieja es justamente lo que no tiene. La sesión lleva firmado el flag
`viaAccessLink`, y es lo único que autoriza a saltarse esa verificación.

Las filas viven en la misma tabla, con la columna `purpose` separando las dos
clases de enlace: un token de recuperación pegado en `/acceso` es tan
desconocido como uno inventado. Dura 30 minutos, se gasta antes de entregar la
sesión —así que reenviarlo, o que lo abra un escáner de correo, no sirve de
nada— y mientras haya uno vivo no se manda otro, de modo que insistir con la
contraseña de un tercero no llena el buzón de nadie.

El aviso de "revisa tu correo" lo cuenta el navegador, no el servidor, y dice
"si existe una cuenta con ese correo": el formulario sigue sin delatar qué
direcciones están registradas.

## Tests

`npm test` corre 222 pruebas unitarias sin necesidad de base de datos. Entre
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
`S3_SECRET_ACCESS_KEY`, `RESEND_API_KEY`, `RESEND_EMAIL_ADDRESS`,
`MAIL_FROM_NAME`, `MAIL_REPLY_TO` y `APP_URL`.

**`S3_PUBLIC_BASE_URL` va vacía.** El bucket de producción es privado: si se
llena, la aplicación entrega la URL sin firmar y todas las imágenes y descargas
del sitio responden 403.

`netlify.toml` excluye `.next/cache/**` del escaneo de secretos. La caché
persistente de Turbopack anota las variables de entorno con las que compiló
—valor incluido— para saber cuándo invalidar, así que todos los secretos del
sitio aparecen dentro de esos `.sst` y el build falla con "Secrets scanning
found secrets in build". Esa caché no se publica: solo se guarda entre builds.
Se excluye la ruta y no la variable a propósito, porque `SECRETS_SCAN_OMIT_KEYS`
dejaría de revisar esa key también en el output que sí se sirve.

```bash
netlify link      # una vez
netlify deploy --build --prod
```
