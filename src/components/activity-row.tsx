import Link from "next/link";
import { ActivityCover } from "@/components/activity-cover";
import { docsLine, metaLine } from "@/lib/format";
import type { ActivitySummary } from "@/lib/types";

/**
 * The list row used on the home, search and profile screens.
 * `showObjective` is off on the profile list, which drops the objective line.
 *
 * The portada rides along at the left, the way the old Angular card showed it
 * — small enough to scan a list by, rather than the banner the detail screen
 * gets. The column is always reserved: 855 of the 922 activities have a cover,
 * so letting the other 67 pull their title leftwards would make the list look
 * ragged for the sake of a handful of rows.
 */
export function ActivityRow({
  activity,
  showObjective = true,
  size = "md",
}: {
  activity: ActivitySummary;
  showObjective?: boolean;
  size?: "md" | "lg";
}) {
  const meta = metaLine(activity);

  return (
    <Link
      href={`/actividades/detalle/${activity.id}`}
      className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-4 border-b border-line py-[18px] pr-4 no-underline transition-colors hover:bg-row-hover hover:no-underline sm:grid-cols-[104px_minmax(0,1fr)] sm:gap-[18px]"
    >
      <span className="block aspect-[4/3] overflow-hidden rounded-sm bg-lav">
        {activity.coverUrl && (
          <ActivityCover src={activity.coverUrl} title={activity.title} variant="thumb" />
        )}
      </span>

      <span className="grid gap-[5px]">
        {meta && (
          <span className="text-[13px] font-semibold tracking-[0.04em] text-muted">{meta}</span>
        )}
        <span
          className={`font-semibold leading-[1.25] text-ink ${size === "lg" ? "text-[23px]" : "text-[22px]"}`}
        >
          {activity.title}
        </span>
        {showObjective && activity.learningObjective && (
          <span className="max-w-[70ch] text-[15px] text-pretty text-muted">
            {activity.learningObjective}
          </span>
        )}
        <span className="text-[13px] font-medium text-indigo">{docsLine(activity)}</span>
      </span>
    </Link>
  );
}
