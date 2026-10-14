import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Almarai, Amiri, Cairo, Changa, IBM_Plex_Sans_Arabic, Lemonada, Marhey, Rubik, Tajawal } from "next/font/google";
import localFont from "next/font/local";
import RegisterSW from "@/components/mahdi/RegisterSW";
import ThemeRoot from "@/components/mahdi/ThemeRoot";
import { getMahdiSession } from "@/lib/mahdi/server/session";
import { getShrines, pickShrine } from "@/lib/mahdi/server/snapshot";
import { t } from "@/lib/mahdi/i18n";
import { PICK_COOKIE, resolveTheme } from "@/lib/mahdi/look-pick";
import { DEFAULT_THEME, LIGHT_THEMES, MAHDI_THEMES } from "@config/mahdi";
import "./mahdi.css";

const sans = IBM_Plex_Sans_Arabic({ variable: "--font-plex", subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"] });
const display = Amiri({ variable: "--font-amiri", subsets: ["arabic"], weight: ["400", "700"] });
// the letters of the looks «شفق» (Readex Pro), «نيون» (Lalezar) and «بوب» (Baloo Bhaijaan 2) — OFL, in assets/fonts
const readex = localFont({ variable: "--font-readex", src: "../../../assets/fonts/student/ReadexPro.ttf", weight: "160 700", display: "swap" });
const lalezar = localFont({ variable: "--font-lalezar", src: "../../../assets/fonts/Lalezar-Regular.ttf", weight: "400", display: "swap" });
// the letters of the other designs: loaded only on the screen that uses them (no preload)
const rubik = Rubik({ variable: "--font-rubik", subsets: ["arabic", "latin"], weight: ["400", "600", "800"], preload: false });
const tajawal = Tajawal({ variable: "--font-tajawal", subsets: ["arabic"], weight: ["400", "700", "900"], preload: false });
const cairo = Cairo({ variable: "--font-cairo", subsets: ["arabic"], weight: ["400", "700", "900"], preload: false });
const almarai = Almarai({ variable: "--font-almarai", subsets: ["arabic"], weight: ["400", "700", "800"], preload: false });
const lemonada = Lemonada({ variable: "--font-lemonada", subsets: ["arabic"], weight: ["400", "600"], preload: false });
const changa = Changa({ variable: "--font-changa", subsets: ["arabic"], weight: ["400", "700"], preload: false });
const marhey = Marhey({ variable: "--font-marhey", subsets: ["arabic"], weight: ["400", "700"], preload: false });
const baloo = localFont({ variable: "--font-baloo", src: "../../../assets/fonts/BalooBhaijaan2.ttf", weight: "400 800", display: "swap" });

export const metadata: Metadata = {
  title: { default: t.brand, template: `%s · ${t.brand}` },
  description: t.auth.tagline,
  // Installable app: its own manifest and scope, separate from the rest of the site
  manifest: "/mahdi/manifest.webmanifest",
  icons: { icon: "/mahdi/icons/icon-192-v3.png", apple: "/mahdi/icons/apple-touch-v3.png" },
  appleWebApp: { capable: true, title: t.brand, statusBarStyle: "black-translucent" },
};

export async function generateViewport(): Promise<Viewport> {
  const [{ profile }, jar] = await Promise.all([getMahdiSession(), cookies()]);
  // the style the person picked (kept on the device too, in case the account could not keep it)
  const picked = resolveTheme(profile?.theme ?? DEFAULT_THEME, profile?.userId, jar.get(PICK_COOKIE)?.value);
  const theme = MAHDI_THEMES.find((x) => x.key === picked) ?? MAHDI_THEMES[0];
  return { themeColor: theme.themeColor, viewportFit: "cover", colorScheme: LIGHT_THEMES.includes(theme.key) ? "light" : "dark" };
}

/** «لأجل المهدي»: its own look and fonts, separate from the rest of the site. */
export default async function MahdiLayout({ children }: { children: React.ReactNode }) {
  const [{ profile }, shrines, jar] = await Promise.all([getMahdiSession(), getShrines().catch(() => []), cookies()]);
  return (
    <ThemeRoot
      initialTheme={resolveTheme(profile?.theme ?? DEFAULT_THEME, profile?.userId, jar.get(PICK_COOKIE)?.value)}
      initialVariant={profile?.themeVariant ?? ""}
      initialShrine={pickShrine(shrines, profile?.shrineId)}
      initialPlace={profile?.shrinePlace}
      fontClass={`${sans.variable} ${display.variable} ${readex.variable} ${lalezar.variable} ${baloo.variable} ${rubik.variable} ${tajawal.variable} ${cairo.variable} ${almarai.variable} ${lemonada.variable} ${changa.variable} ${marhey.variable}`}
      skipLabel={t.common.skipToContent}
    >
      <RegisterSW />
      {children}
    </ThemeRoot>
  );
}
