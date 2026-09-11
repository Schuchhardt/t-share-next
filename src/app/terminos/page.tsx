import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { social } from "@/lib/seo";
import { SITE } from "@/lib/site";

const DESCRIPTION =
  "Términos y Condiciones de Servicio de EDTEK SpA, que rigen el uso de la plataforma T-share.";

export const metadata = {
  title: "Términos y condiciones",
  description: DESCRIPTION,
  alternates: { canonical: "/terminos" },
  ...social({ path: "/terminos", title: "Términos y condiciones", description: DESCRIPTION }),
};

/**
 * The terms carried over verbatim from the modal on the previous site. The
 * headings already carry their own roman numerals, so this page keeps them and
 * skips the generated index that `/privacidad` uses.
 */
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "I. Aceptación de estos Términos y Condiciones",
    body: [
      "Al usar, navegar o registrarte con una cuenta de Usuario en la Plataforma, o al usar cualquiera de los servicios que EDTEK presta, Tú estás aceptando estos Términos y Condiciones y, en consecuencia, te obligas a cumplirlos.",
      "Lee detenidamente lo que a continuación se señala y, si no estás de acuerdo, debes abstenerte de seguir utilizando la Plataforma.",
      "Debes, además, tener en consideración que al aceptar estos Términos y Condiciones declaras expresamente que:",
      "1. Los aceptas plenamente y no tienes reparos respecto de su aplicación.",
      "2. Estás capacitado jurídicamente para aceptarlos y que, en caso de registrarte en representación de otra persona, natural o jurídica, lo estás haciendo en la forma legal.",
      "3. Permites a EDTEK administrar la información o material que cargues en la Plataforma en el modo que más adelante se indica.",
    ],
  },
  {
    title: "II. Qué ofrece EDTEK",
    body: [
      "EDTEK pone a disposición de los distintos partícipes del mundo escolar un Buscador de material colaborativo. La Plataforma de EDTEK, en el mismo sentido, tiene por finalidad ser el lugar de encuentro entre profesores, instituciones escolares, padres y generadores de contenidos, donde todos ellos puedan interactuar difundiendo o accediendo a metodologías o trabajos destinados al aprendizaje.",
      "Para esos efectos, EDTEK clasifica a sus Usuarios registrados en 3 categorías:",
      "1. Generadores de Contenido: son las ONG, Startups y otras entidades o personas que crean el material educativo que estará disponible en el buscador.",
      "2. Profesores: son los profesores actuando por sí mismos o como parte de una determinada Institución Escolar.",
      "3. Homeschoolers: son los padres, madres o quienes tengan interés en enseñar una o más materias a niños fuera del aula escolar tradicional.",
      "Las tres categorías antes señaladas tienen tratamiento diferenciado en la Plataforma y puede ser que alguna de ellas tenga acceso a funcionalidades de la Plataforma a las que las demás no tengan derecho, o bien, que se apliquen tarifas distintas o exenciones. Por lo mismo, es importante que te registres en la categoría que más se adecúe a tu realidad y circunstancias.",
      "Si EDTEK nota comportamientos extraños o tendientes a concluir que un Usuario no se registró en la categoría correcta, podrá siempre verificar si la información entregada en el proceso de registro es veraz, por el medio que estime pertinente. Así, podrá hacerlo mediante correos electrónicos, llamadas telefónicas, notificaciones a través de la Plataforma, entre otros. EDTEK incluso podrá, a su solo arbitrio, optar por la suspensión o cierre de la cuenta.",
      "A su vez, EDTEK puede contar con los datos personales de las tres categorías de Usuarios mientras ellos se encuentren registrados en la Plataforma, y puede enviarles mediante correos electrónicos información y actualizaciones, con el fin de mantenerlos al tanto de todas las novedades de la misma.",
    ],
  },
  {
    title: "III. A qué te obligas",
    body: [
      "1. No compartirás tu cuenta con ninguna otra persona y respetarás nuestras normas. Las cuentas son de uso personal, es decir, sólo pueden ser utilizadas por la persona que las creó. Así, si Tú te registras como Homeschooler, no está permitido que cedas ni permanente ni momentáneamente tu cuenta a otra persona. Por otro lado, si te registras como Institución Escolar, por ejemplo, como Colegio, la cuenta deberá ser utilizada por el número de profesores que hayas señalado al momento del registro o que hayas informado a EDTEK en un momento posterior.",
      "En caso que tengas seguridad o sospeches que otra persona está haciendo uso de tu cuenta, deberás informarlo prontamente a nuestro soporte. EDTEK no será responsable de daño o perjuicio alguno ocasionado en caso de incumplimiento de esta obligación.",
      "2. Cumplirás con tus obligaciones de pago y aceptas que almacenemos tu información de pago.",
      "Por un lado, esto significa que aceptas que por ciertas funciones o por ciertos contenidos disponibles en la Plataforma considerados “premium” puede ser cobrado un determinado precio o comisión y que, por lo mismo, estarás obligado a pagarlos por acceder a ellos. Siempre que por una función o un contenido se cobre un precio o comisión, lo podrás ver previo a realizar la compra.",
      "Además de la función propia del Buscador, podrás pactar servicios especiales con EDTEK, quien tendrá completa libertad para prestarlos o no prestarlos. Estos pueden consistir, por ejemplo, en determinados reportes o boletines periódicos. El precio de ellos será adicional al base.",
      "Podrás cancelar tu suscripción en cualquier momento, sin embargo, considera que si ya ha comenzado un nuevo período de pago, se cobrará completo.",
      "Asimismo, puedes registrarte en la Plataforma y acceder a los beneficios gratuitos que ofrece EDTEK sin necesidad de ingresar tu información de pago.",
      "Por otro lado, en caso de contratar los servicios “premium” significa que autorizas a EDTEK a almacenar y continuar utilizando tu forma de pago (como una tarjeta de crédito) para fines de facturación, incluso después de haber caducado, para evitar la interrupción de los servicios y utilizarla para pagar otros que puedas adquirir.",
      `Puedes saber más sobre precios enviando un mensaje a ${SITE.email}.`,
      "3. Aceptas que EDTEK te envíe avisos, publicidad y mensajes a través de sitios web y aplicaciones, así como a través de la información que proporcionaste en la Plataforma.",
      "Estos avisos en muchas ocasiones pueden ser muy relevantes y de ellos depende en gran medida la relación que mantenemos con nuestros Usuarios. Por lo mismo, te recomendamos mantenerla actualizada siempre.",
      "4. Si eres Generador de contenido, aceptas que no podrás comunicarte por vías no contempladas en la Plataforma con Profesores y Homeschoolers.",
      "5. El Usuario acepta que el material publicado en la Plataforma es de uso exclusivo de esta, y ningún otro usuario y/o terceros pueden comercializar el contenido de esta.",
      "6. Aceptas que EDTEK y otras personas puedan ver, descargar, administrar y usar la información que compartes o proporcionas en la Plataforma.",
      "La información y el contenido que compartes o publicas pueden ser visibles para otras personas, incluso fuera de la Plataforma, quienes podrán verlos, copiarlos, usarlos e incluso modificarlos.",
      "Cuando se trate de tus publicaciones en otros sitios web conectados con la Plataforma de EDTEK y exista la posibilidad de establecer una configuración, respetaremos las opciones que elijas sobre quien puede tener acceso a ellas. EDTEK podrá utilizar y administrar el contenido o información que cargues en la Plataforma, sin perjuicio de respetar las Políticas de Privacidad que también forman parte de estos Términos y Condiciones.",
      "EDTEK no está obligado a publicar información o contenidos y podrá retirarlos a su entera discreción, en cualquier momento, con o sin aviso previo. Podremos retirarlos, especialmente y sin ser un listado excluyente, cuando notemos que exista o pueda existir uso de lenguaje inapropiado, fotografías o imágenes inadecuadas, links a sitios fraudulentos, reportes de otros Usuarios, spam y/o material con fines únicamente publicitarios.",
      "El retiro de contenido, sin embargo, no afecta de manera alguna los pagos a los que tiene derecho EDTEK. A modo de ejemplo, si para EDTEK nacieron derechos por redirección en virtud de publicidad cargada en la Plataforma, que luego se retiró, estos substistirán plenamente.",
    ],
  },
  {
    title: "IV. Propiedad Intelectual sobre el contenido",
    body: [
      "Los Usuarios son autores y propietarios del material que cargan en la plataforma, sin embargo, por la naturaleza colaborativa de la Plataforma de EDTEK, otros Usuarios podrán tener acceso a él e incluso podrán copiarlo, adecuarlo y/o modificarlo.",
      "Por ser el propietario, son de completa responsabilidad del Usuario el material o las actividades por él creadas.",
      "Como Usuario, podrás eliminar tu material de la Plataforma, pero debes tener en consideración que, si ya fue publicado, puede ocurrir que otras personas que tuvieron acceso a él lo hayan copiado, vuelto a compartir o almacenado.",
    ],
  },
  {
    title: "V. Incentivos",
    body: [
      "Con la finalidad de que los profesores tengan una participación activa en la plataforma, se ha creado un sistema de incentivos. A través de este medio, los profesores que tengan su perfil verificado, podrán acceder al plan de incentivos de T-SHARE. El pago de estos se llevará a efecto por medio de boleta de honorarios por monto bruto, el cual se desembolsará a fin de mes una vez superado el monto de $30.000 pesos chilenos, los cuales serán depositados en la cuenta bancaria del profesor y EDTEK se hará responsable del pago de la retención de impuestos de la misma.",
    ],
  },
  {
    title: "VI. Indemnización",
    body: [
      "El Usuario indemnizará, mantendrá indemne y defenderá a EDTEK por cualquier acción, reclamo o demanda de otro Usuario o de terceros por su comportamiento en la Plataforma, por su propio incumplimiento de estos Términos y Condiciones, o por la violación de leyes o derechos de terceros derivada de ese comportamiento.",
    ],
  },
  {
    title: "VII. Modificaciones de los Términos y Condiciones",
    body: [
      "EDTEK se reserva el derecho a modificar estos Términos y Condiciones en cualquier momento, y dichos cambios serán efectivos desde el momento en que se publiquen en la Plataforma. EDTEK informará de aquellos por las vías que estime pertinentes, haciendo esfuerzos razonables para informarlos a sus Usuarios.",
      "Sin perjuicio de lo anterior, el Usuario acepta que es de su responsabilidad mantenerse actualizado respecto del contenido de estos mismos Términos y Condiciones.",
    ],
  },
  {
    title: "VIII. Divisibilidad",
    body: [
      "En caso que cualquier cláusula o disposición de estos Términos y Condiciones fuera declarada inválida o inexigible, no será afectada la validez o exigibilidad de las demás.",
    ],
  },
];

/** `I. Aceptación de estos…` → `i-aceptacion-de-estos…`, for the anchor. */
function slug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const sections: LegalSection[] = [
  ...SECTIONS.map((section) => ({
    id: slug(section.title),
    title: section.title,
    body: section.body.map((paragraph) => ({ p: paragraph })),
  })),
  {
    id: "ix-contacto",
    title: "IX. Contacto",
    body: [
      {
        p: (
          <>
            Si tienes dudas o comentarios, puedes contactarnos a través de{" "}
            <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
          </>
        ),
      },
    ],
  },
];

export default function TerminosPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Términos y condiciones de servicios de EDTEK SpA"
      updatedAt="10 de septiembre de 2026"
      intro={[
        {
          p: (
            <>
              Los siguientes son los Términos y Condiciones de Servicio de EDTEK SPA (en adelante
              también “EDTEK” o “Nosotros”), los que aceptas al registrarte como Usuario (en
              adelante también “Tú”) de su Plataforma T-share o simplemente al navegar como
              visitador y que, en conjunto con la{" "}
              <Link href="/privacidad">política de privacidad</Link>, forman un contrato vinculante
              que rige las relaciones entre ambas partes.
            </>
          ),
        },
        {
          p: "Dependiendo del contexto, EDTEK puede también hacer referencia a los servicios, productos, sitio web, contenido o cualquier material que EDTEK provea en la Plataforma o fuera de la misma.",
        },
      ]}
      sections={sections}
    />
  );
}
