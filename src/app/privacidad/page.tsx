import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "Política de privacidad",
  description:
    "Qué datos personales trata T-share (EDTEK SpA), con qué finalidad, con quién se comparten, por cuánto tiempo se conservan y cómo ejercer tus derechos.",
};

const CONTACTO = <a href={`mailto:${SITE.email}`}>{SITE.email}</a>;

/**
 * The inventories below describe what this application actually stores: the
 * columns in `db/schema.sql`, the session cookie in `src/lib/auth/session.ts`,
 * the S3 objects in `src/lib/storage.ts` and the services in `.env.example`.
 * Keep them in step when any of those change.
 */
const SECTIONS: LegalSection[] = [
  {
    id: "responsable",
    title: "Quién es responsable de tus datos",
    body: [
      {
        p: (
          <>
            El responsable del tratamiento de tus datos personales es <strong>EDTEK SpA</strong>{" "}
            (“EDTEK”, “T-share” o “nosotros”), sociedad chilena con domicilio en {SITE.address},{" "}
            {SITE.city}, que opera la plataforma disponible en t-share.org.
          </>
        ),
      },
      {
        p: (
          <>
            Para cualquier asunto relacionado con esta política, con tus datos o con el ejercicio de
            tus derechos, puedes escribirnos a {CONTACTO}.
          </>
        ),
      },
      {
        p: (
          <>
            Esta política se aplica al sitio y a la plataforma T-share. No se aplica a los sitios de
            terceros a los que puedas llegar desde enlaces publicados en la plataforma, incluidos
            los de nuestras organizaciones aliadas, que se rigen por sus propias políticas.
          </>
        ),
      },
    ],
  },
  {
    id: "datos",
    title: "Qué datos tratamos",
    body: [
      {
        p: "Tratamos tres grupos de datos: los que nos entregas al registrarte y usar la plataforma, los que se generan como consecuencia de ese uso, y los mínimos datos técnicos necesarios para que el sitio funcione.",
      },
      { p: <strong>a) Datos que nos entregas</strong> },
      {
        table: {
          head: ["Categoría", "Qué incluye", "Cuándo lo pedimos"],
          rows: [
            [
              "Identificación",
              "Nombre, apellido y correo electrónico.",
              "Al crear tu cuenta. Son obligatorios.",
            ],
            [
              "Autenticación",
              "Tu contraseña, guardada siempre cifrada mediante una función de hash (bcrypt). No la almacenamos ni podemos leerla en texto claro.",
              "Al crear tu cuenta y al cambiarla.",
            ],
            [
              "Perfil docente",
              "Biografía, tipo de usuario (profesor, generador de contenido u homeschooler), asignaturas, niveles y habilidades, establecimiento educacional, región y país, foto de perfil y enlaces a tus sitios o redes sociales.",
              "Opcional, al completar tu perfil.",
            ],
            [
              "Datos de perfil heredados",
              "Fecha de nacimiento, género y número de documento de identidad (RUT), en las cuentas migradas desde la versión anterior de T-share que los habían registrado.",
              "No se piden en el registro actual. Ver la sección de conservación.",
            ],
            [
              "Contenido que publicas",
              "Actividades y sus documentos adjuntos (guías, PDF, imágenes), objetivos de aprendizaje, descripciones, materiales e instrucciones, comentarios, valoraciones y reacciones.",
              "Cuando decides publicarlo.",
            ],
            [
              "Comunicaciones",
              "Mensajes que envías a otros usuarios dentro de la plataforma y los correos que nos escribes.",
              "Cuando los envías.",
            ],
          ],
        },
      },
      { p: <strong>b) Datos que se generan por tu uso</strong> },
      {
        list: [
          "Actividades que guardas y actividades que descargas, con la fecha y el número de descargas.",
          "Docentes a los que sigues y quiénes te siguen.",
          "Notificaciones generadas por la plataforma y si las has leído.",
          "Fecha de tu último inicio de sesión e intentos fallidos, para detectar accesos indebidos.",
          "Autorizaciones que otorgas a otros docentes sobre tus actividades.",
        ],
      },
      { p: <strong>c) Datos de pago</strong> },
      {
        p: (
          <>
            Si contratas un plan de pago, la transacción se realiza a través de{" "}
            <strong>Transbank (Webpay)</strong>. Los datos de tu tarjeta se ingresan directamente en
            el sitio de Transbank y <strong>nunca pasan por nuestros servidores</strong>. De la
            transacción conservamos únicamente el comprobante: monto, fecha, número de orden, código
            de autorización, tipo de pago, número de cuotas y los{" "}
            <strong>últimos cuatro dígitos</strong> de la tarjeta. No almacenamos el número completo
            de la tarjeta ni su código de seguridad.
          </>
        ),
      },
      { p: <strong>d) Datos que no recolectamos</strong> },
      {
        p: "Queremos ser explícitos sobre esto, porque no es lo habitual: T-share no incorpora herramientas de analítica web, no perfila tu comportamiento con fines publicitarios, no instala cookies de terceros, no usa píxeles de seguimiento de redes sociales y no vende ni cede tus datos a terceros con fines comerciales.",
      },
    ],
  },
  {
    id: "finalidades",
    title: "Para qué usamos tus datos",
    body: [
      {
        table: {
          head: ["Finalidad", "Datos involucrados", "Por qué podemos hacerlo"],
          rows: [
            [
              "Crear y mantener tu cuenta",
              "Identificación, autenticación.",
              "Ejecución del contrato que aceptas al registrarte.",
            ],
            [
              "Mostrar y buscar actividades",
              "Contenido publicado, perfil docente.",
              "Ejecución del contrato: es el servicio que solicitas.",
            ],
            [
              "Atribuir la autoría de lo que publicas",
              "Nombre, foto de perfil, tipo de usuario.",
              "Ejecución del contrato e interés legítimo en el funcionamiento colaborativo de la plataforma.",
            ],
            [
              "Habilitar la interacción entre docentes",
              "Comentarios, valoraciones, mensajes, seguimientos.",
              "Ejecución del contrato.",
            ],
            [
              "Proteger las cuentas y prevenir el uso indebido",
              "Registro de accesos e intentos fallidos.",
              "Interés legítimo en la seguridad del servicio.",
            ],
            [
              "Procesar pagos y emitir documentos tributarios",
              "Datos de la transacción.",
              "Ejecución del contrato y cumplimiento de obligaciones legales.",
            ],
            [
              "Pagar incentivos a docentes verificados",
              "Identificación y datos de pago que nos entregues para ese efecto.",
              "Ejecución del contrato y cumplimiento de obligaciones tributarias.",
            ],
            [
              "Enviarte avisos sobre el servicio",
              "Correo electrónico.",
              "Ejecución del contrato. Los correos meramente informativos o promocionales se envían con tu consentimiento y puedes darte de baja en cualquier momento.",
            ],
          ],
        },
      },
      {
        p: "No tomamos decisiones automatizadas que produzcan efectos jurídicos sobre ti ni elaboramos perfiles con ese fin.",
      },
    ],
  },
  {
    id: "publico",
    title: "Qué es visible para otras personas",
    body: [
      {
        p: "T-share es una plataforma colaborativa, así que parte de lo que registras es visible para otros. Conviene que tengas claro qué es público antes de publicarlo:",
      },
      {
        list: [
          <>
            <strong>Público para cualquier visitante:</strong> el título, objetivo, descripción y
            metadatos de las actividades que publicas, junto con tu nombre y foto de perfil como
            autor o autora, y los comentarios y valoraciones que dejas.
          </>,
          <>
            <strong>Visible para usuarios registrados:</strong> los documentos adjuntos a las
            actividades, tu perfil docente completo y tus enlaces a redes sociales, si los cargaste.
          </>,
          <>
            <strong>Privado:</strong> tu correo electrónico, tu contraseña, tus datos de perfil
            heredados (fecha de nacimiento, género, documento de identidad), tus datos de pago, las
            actividades que guardas y tus mensajes, que sólo ve su destinatario.
          </>,
        ],
      },
      {
        p: "Ten presente que otros usuarios pueden descargar el material que publicas. Una vez descargado, ese archivo queda fuera de nuestro control, por lo que eliminar una actividad de la plataforma no revierte las copias que ya se hicieron.",
      },
    ],
  },
  {
    id: "estudiantes",
    title: "Datos de estudiantes y de menores de edad",
    body: [
      {
        p: "T-share está dirigida a personas adultas —docentes, generadores de contenido y adultos a cargo de la enseñanza— y no está pensada para que la usen menores de edad. No creamos cuentas para estudiantes ni pedimos datos sobre ellos.",
      },
      {
        p: (
          <>
            Por lo mismo, te pedimos que{" "}
            <strong>no incluyas datos personales de estudiantes</strong> en el material que
            publicas: nombres, fotografías, evaluaciones, informes o cualquier antecedente que
            permita identificar a un niño, niña o adolescente. Antes de subir una guía, revisa que
            esté anonimizada.
          </>
        ),
      },
      {
        p: (
          <>
            Si detectamos material que contiene datos personales de estudiantes, podemos retirarlo
            sin aviso previo. Si crees que una actividad publicada expone datos de un menor,
            avísanos a {CONTACTO} y la revisaremos con prioridad.
          </>
        ),
      },
    ],
  },
  {
    id: "cookies",
    title: "Cookies",
    body: [
      {
        p: "T-share usa una sola cookie, estrictamente necesaria para que puedas mantener la sesión iniciada. No usamos cookies de analítica, de publicidad ni de terceros, por lo que no verás en este sitio un banner pidiéndote consentimiento para instalarlas.",
      },
      {
        table: {
          head: ["Cookie", "Para qué sirve", "Duración"],
          rows: [
            [
              "tshare_session",
              "Mantiene tu sesión iniciada. Contiene un identificador firmado criptográficamente; no guarda tu contraseña ni datos de tu perfil. Es httpOnly, por lo que ningún script del navegador puede leerla, y viaja sólo por HTTPS.",
              "30 días, o hasta que cierres sesión.",
            ],
          ],
        },
      },
      {
        p: "Puedes bloquear o borrar esta cookie desde tu navegador, pero en ese caso no podrás iniciar sesión ni usar las funciones que requieren cuenta.",
      },
    ],
  },
  {
    id: "terceros",
    title: "Con quién compartimos tus datos",
    body: [
      {
        p: "No vendemos tus datos. Los compartimos únicamente con los proveedores que necesitamos para operar el servicio, que actúan como encargados del tratamiento por cuenta nuestra y sólo pueden usarlos para prestarnos ese servicio:",
      },
      {
        table: {
          head: ["Proveedor", "Para qué", "Qué datos recibe"],
          rows: [
            [
              "Supabase",
              "Base de datos de la plataforma.",
              "Todos los datos de cuenta, perfil, contenido e interacciones.",
            ],
            [
              "Amazon Web Services (S3)",
              "Almacenamiento de archivos.",
              "Documentos de las actividades, imágenes de portada y fotos de perfil.",
            ],
            [
              "Netlify",
              "Alojamiento del sitio y ejecución del servidor.",
              "Datos técnicos de la conexión, como la dirección IP, en los registros del servidor.",
            ],
            [
              "Transbank",
              "Procesamiento de pagos.",
              "Los datos de tu tarjeta, que ingresas directamente en su plataforma, y el monto de la transacción.",
            ],
          ],
        },
      },
      {
        p: "Además, podemos entregar datos cuando una ley, una orden judicial o un requerimiento de autoridad competente nos obligue a hacerlo, y en caso de reorganización societaria, fusión o venta de EDTEK, en cuyo caso el adquirente queda sujeto a esta misma política.",
      },
    ],
  },
  {
    id: "transferencias",
    title: "Transferencias internacionales",
    body: [
      {
        p: "Algunos de los proveedores mencionados operan servidores fuera de Chile, principalmente en Estados Unidos. Eso significa que tus datos pueden ser almacenados o procesados en el extranjero.",
      },
      {
        p: "Cuando eso ocurre, contratamos proveedores que ofrecen garantías contractuales de confidencialidad y seguridad equivalentes a las exigidas por la legislación chilena, y les prohibimos usar los datos para fines distintos de la prestación del servicio.",
      },
    ],
  },
  {
    id: "conservacion",
    title: "Por cuánto tiempo conservamos tus datos",
    body: [
      {
        table: {
          head: ["Dato", "Plazo de conservación"],
          rows: [
            [
              "Cuenta y perfil",
              "Mientras tu cuenta esté activa. Si la eliminas, se suprimen o anonimizan dentro de los 30 días siguientes.",
            ],
            [
              "Actividades publicadas",
              "Mientras estén publicadas. Si eliminas una actividad o tu cuenta, puedes pedirnos que la retiremos, sin perjuicio de las copias que otros usuarios ya hayan descargado.",
            ],
            [
              "Comentarios y valoraciones",
              "Mientras exista la actividad comentada. Al eliminar tu cuenta pueden conservarse desvinculados de tu nombre, para no romper el hilo de la conversación.",
            ],
            ["Registros de acceso", "12 meses, con fines de seguridad."],
            [
              "Comprobantes de pago",
              "6 años, por las obligaciones contables y tributarias que nos exige la ley chilena.",
            ],
            [
              "Datos de perfil heredados",
              "Los estamos depurando: si no quieres esperar, escríbenos y los eliminamos de inmediato.",
            ],
            ["Cookie de sesión", "30 días desde el último inicio de sesión."],
          ],
        },
      },
    ],
  },
  {
    id: "seguridad",
    title: "Cómo protegemos tus datos",
    body: [
      {
        p: "Aplicamos medidas técnicas y organizativas proporcionadas al riesgo del tratamiento. Entre otras:",
      },
      {
        list: [
          "Las contraseñas se guardan cifradas con bcrypt y un factor de trabajo alto; nadie en EDTEK puede recuperarlas.",
          "Todo el tráfico del sitio viaja cifrado por HTTPS.",
          "La sesión se transporta en una cookie firmada, httpOnly y con SameSite, que un script no puede leer ni reutilizar desde otro sitio.",
          "Los documentos que subes se guardan en un bucket privado y se sirven mediante enlaces temporales que caducan a las pocas horas.",
          "La base de datos no es accesible desde el navegador: sólo el servidor de la aplicación puede consultarla.",
          "El acceso del equipo a los datos de producción está limitado a quienes lo necesitan para operar el servicio.",
        ],
      },
      {
        p: (
          <>
            Ninguna medida es infalible. Si detectamos una vulneración de seguridad que afecte tus
            datos personales y suponga un riesgo para ti, te lo informaremos y daremos aviso a la
            autoridad cuando corresponda. Si sospechas que alguien accedió a tu cuenta, cambia tu
            contraseña y avísanos a {CONTACTO}.
          </>
        ),
      },
    ],
  },
  {
    id: "derechos",
    title: "Tus derechos",
    body: [
      {
        p: "Respecto de tus datos personales, la ley chilena te reconoce los siguientes derechos, que puedes ejercer gratuitamente y en cualquier momento:",
      },
      {
        list: [
          <>
            <strong>Acceso:</strong> saber qué datos tuyos tratamos, de dónde provienen y para qué
            los usamos, y obtener una copia.
          </>,
          <>
            <strong>Rectificación:</strong> corregir los datos inexactos, desactualizados o
            incompletos. Buena parte los puedes editar tú mismo desde tu perfil.
          </>,
          <>
            <strong>Supresión o cancelación:</strong> pedir que eliminemos tus datos cuando ya no
            sean necesarios, cuando retires tu consentimiento o cuando el tratamiento carezca de
            fundamento legal.
          </>,
          <>
            <strong>Oposición:</strong> oponerte a un tratamiento determinado por motivos legítimos,
            incluidas las comunicaciones comerciales.
          </>,
          <>
            <strong>Portabilidad:</strong> recibir en un formato estructurado y de uso común los
            datos que nos entregaste, o pedir que los transfiramos a otro responsable cuando sea
            técnicamente posible.
          </>,
          <>
            <strong>Bloqueo:</strong> pedir la suspensión temporal del tratamiento mientras se
            resuelve una solicitud de rectificación u oposición.
          </>,
        ],
      },
      {
        p: (
          <>
            Para ejercerlos, escríbenos a {CONTACTO} desde el correo asociado a tu cuenta, indicando
            el derecho que quieres ejercer. Podemos pedirte antecedentes adicionales sólo si
            necesitamos verificar tu identidad. Responderemos a tu solicitud en el plazo que
            establezca la ley y, en todo caso, tan pronto como nos sea posible.
          </>
        ),
      },
      {
        p: "Si consideras que no atendimos correctamente tu solicitud, puedes reclamar ante la autoridad de protección de datos personales competente en Chile.",
      },
    ],
  },
  {
    id: "marco-legal",
    title: "Marco legal aplicable",
    body: [
      {
        p: "Esta política se rige por la legislación chilena sobre protección de la vida privada y de los datos personales, en particular la Ley N° 19.628 y la Ley N° 21.719, que la moderniza y crea la Agencia de Protección de Datos Personales. Cualquier controversia se somete a los tribunales de Santiago de Chile.",
      },
    ],
  },
  {
    id: "cambios",
    title: "Cambios a esta política",
    body: [
      {
        p: "Podemos actualizar esta política cuando cambien nuestras prácticas, los proveedores que utilizamos o la legislación aplicable. La versión vigente es siempre la publicada en esta página, con su fecha de última actualización arriba.",
      },
      {
        p: "Si el cambio es sustancial —por ejemplo, si empezamos a tratar datos para una finalidad nueva— te lo avisaremos por correo electrónico o mediante un aviso destacado en la plataforma antes de que entre en vigor.",
      },
    ],
  },
  {
    id: "contacto",
    title: "Contacto",
    body: [
      {
        p: (
          <>
            Si tienes dudas sobre esta política o sobre cómo tratamos tus datos, escríbenos a{" "}
            {CONTACTO} o a {SITE.address}, {SITE.city}.
          </>
        ),
      },
      {
        p: (
          <>
            Esta política complementa los <Link href="/terminos">términos y condiciones</Link>, que
            rigen el uso de la plataforma.
          </>
        ),
      },
    ],
  },
];

export default function PrivacidadPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Política de privacidad"
      updatedAt="10 de septiembre de 2026"
      showIndex
      intro={[
        {
          p: "Esta política explica qué datos personales tratamos cuando usas T-share, para qué los usamos, con quién los compartimos, cuánto tiempo los conservamos y qué puedes exigirnos respecto de ellos.",
        },
        {
          p: "Está escrita para que se entienda. Si algo no queda claro, prefiere preguntarnos antes que suponer.",
        },
      ]}
      sections={SECTIONS}
    />
  );
}
