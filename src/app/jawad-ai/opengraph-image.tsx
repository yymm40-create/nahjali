import { ImageResponse } from "next/og";
import { logoPng } from "@/lib/jawad/server/logo";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { JAWAD } from "@config/jawad/brand";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "JAWAD AI";
export const revalidate = 600;

/** The picture shown when a JAWAD AI link is shared (its own identity, not «نهج علي»'s). */
export default async function OpenGraph() {
  const [logo, rt] = await Promise.all([logoPng(360), loadRuntime().catch(() => null)]);
  const accent = rt?.brand.accent ?? JAWAD.defaultAccent;
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "0 96px",
          background: `radial-gradient(900px 500px at 20% 20%, ${accent}33, transparent 70%), #0b0c0f`,
          color: "#eef1f6",
        }}
      >
        <img src={src} width={360} height={360} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: 2 }}>{JAWAD.nameEn}</div>
          <div style={{ fontSize: 34, color: "#a3abb9" }}>Images · Video · Audio · Film</div>
        </div>
      </div>
    ),
    size,
  );
}
