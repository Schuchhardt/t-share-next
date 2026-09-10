import Link from "next/link";
import { docsLine, metaLine } from "@/lib/format";
import type { ActivitySummary } from "@/lib/types";

/**
 * The list row used on the home, search and profile screens.
 * `showObjective` is off on the profile list, which drops the objective line.
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
      className="grid gap-[5px] border-b border-line py-[18px] pr-4 no-underline transition-colors hover:bg-row-hover hover:no-underline"
    >
      {meta && (
        <div className="text-[13px] font-semibold tracking-[0.04em] text-muted">{meta}</div>
      )}
      <div
        className={`font-semibold leading-[1.25] text-ink ${size === "lg" ? "text-[23px]" : "text-[22px]"}`}
      >
        {activity.title}
      </div>
      {showObjective && activity.learningObjective && (
        <div className="max-w-[70ch] text-[15px] text-pretty text-muted">
          {activity.learningObjective}
        </div>
      )}
      <div className="text-[13px] font-medium text-indigo">{docsLine(activity)}</div>
    </Link>
  );
}
