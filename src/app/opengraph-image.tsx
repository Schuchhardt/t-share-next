import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The old site pointed `og:image` at an SVG, which most social networks refuse
// to render. This draws the same brand as a PNG at the size they expect.
export const alt = "T-share — Actividades de clase, listas para usar.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const raleway = await readFile(join(process.cwd(), "public/fonts/Raleway-Bold.ttf"));

export default function OpengraphImage() {
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
          padding: "72px 80px",
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
            }}
          >
            T
          </div>
          <div style={{ fontSize: 30, color: "#3D3B96", letterSpacing: "0.12em" }}>T-SHARE</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 76,
              lineHeight: 1.05,
              color: "#2B2A55",
              letterSpacing: "-0.02em",
            }}
          >
            <div>Actividades de clase,</div>
            <div>listas para usar.</div>
          </div>
          <div style={{ marginTop: 26, fontSize: 30, color: "#6E6C8F" }}>
            Un repositorio de actividades hechas por profesores.
          </div>
        </div>

        <div style={{ display: "flex", height: 10, background: "#5FC79A", borderRadius: 5 }} />
      </div>
    ),
    { ...size, fonts: [{ name: "Raleway", data: raleway, style: "normal", weight: 700 }] },
  );
}
