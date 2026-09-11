import { EmailLayout, P } from "@/emails/layout";

/** Laravel: `ActividadComentada`. */
export const ACTIVITY_COMMENTED_SUBJECT = "Han comentado tu actividad en T-share";

export function ActivityCommentedEmail({
  authorName,
  commenterName,
  activityId,
  activityTitle,
  appUrl,
}: {
  authorName: string;
  commenterName: string;
  activityId: number;
  activityTitle: string;
  appUrl: string;
}) {
  return (
    <EmailLayout
      appUrl={appUrl}
      preview={`${commenterName} comentó “${activityTitle}”.`}
      heading={`¡Hola ${authorName}!`}
      cta={{
        label: "Ver el comentario",
        url: `${appUrl}/actividades/detalle/${activityId}`,
      }}
    >
      <P>
        <strong>{commenterName}</strong> ha comentado tu actividad “{activityTitle}”.
      </P>
    </EmailLayout>
  );
}
