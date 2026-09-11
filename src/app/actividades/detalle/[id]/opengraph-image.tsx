import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getActivity } from "@/lib/activities";
import { metaLine } from "@/lib/format";

/**
 * The card a shared activity previews as.
 *
 * Drawn here rather than pointing `og:image` at the activity's own portada:
 * the bucket is private, so a cover resolves to a signed URL that expires in
 * six hours, and a link shared on Monday would preview as a broken image by
 * Tuesday. This is a stable URL that says what the activity is — the title,
 * the ficha line and who wrote it — in the site's own brand.
 */
export const alt = "Actividad en T-share";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const [bold, regular] = await Promise.all([
  readFile(join(process.cwd(), "public/fonts/Raleway-Bold.ttf")),
  readFile(join(process.cwd(), "public/fonts/Raleway-Regular.ttf")),
]);

/** Long titles exist; the card has room for about this much. */
function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}

export default async function ActivityOpengraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const activity = await getActivity(Number(id));

  const title = activity ? clip(activity.title, 110) : "Actividades de clase, listas para usar.";
  const meta = activity ? metaLine(activity) : "";
  const author = activity?.author ? `Creada por ${activity.author.name}` : "";
  // A long title needs smaller type to stay on the card.
  const titleSize = title.length > 75 ? 52 : title.length > 45 ? 62 : 72;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fff",
          padding: "68px 80px",
          fontFamily: "Raleway",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 32,
              background: "#363795",
              color: "#fff",
              fontSize: 38,
              fontWeight: 700,
            }}
          >
            T
          </div>
          <div style={{ fontSize: 30, color: "#3D3B96", letterSpacing: "0.12em", fontWeight: 700 }}>
            T-SHARE
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {meta && (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                color: "#5FC79A",
                letterSpacing: "0.08em",
                fontWeight: 700,
                marginBottom: 20,
              }}
            >
              {clip(meta, 64)}
            </div>
          )}
          <div
            style={{
              display: "flex",
              fontSize: titleSize,
              lineHeight: 1.1,
              color: "#2B2A55",
              letterSpacing: "-0.02em",
              fontWeight: 700,
            }}
          >
            {title}
          </div>
          {author && (
            <div style={{ display: "flex", marginTop: 24, fontSize: 28, color: "#6E6C8F" }}>
              {author}
            </div>
          )}
        </div>

        <div style={{ display: "flex", height: 10, background: "#5FC79A", borderRadius: 5 }} />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Raleway", data: bold, style: "normal", weight: 700 },
        { name: "Raleway", data: regular, style: "normal", weight: 400 },
      ],
    },
  );
}
