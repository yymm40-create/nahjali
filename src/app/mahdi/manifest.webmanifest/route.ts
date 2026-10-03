import { NextResponse } from "next/server";
import { DEFAULT_THEME, MAHDI_THEMES } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";

const color = MAHDI_THEMES.find((x) => x.key === DEFAULT_THEME)!.themeColor;

/** The web app manifest of «لأجل المهدي»: its own scope (/mahdi/), so installing it never touches the rest of the site. */
export function GET() {
  return NextResponse.json(
    {
      id: "/mahdi",
      name: t.brand,
      short_name: t.brand,
      description: t.pwa.description,
      lang: "ar",
      dir: "rtl",
      start_url: "/mahdi",
      scope: "/mahdi/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#ffffff", // the splash screen matches the white icon
      theme_color: color,
      categories: ["lifestyle", "productivity"],
      icons: [
        { src: "/mahdi/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/mahdi/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/mahdi/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" } },
  );
}
