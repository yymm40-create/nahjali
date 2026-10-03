import type { Metadata, Viewport } from "next";
import { Amiri, IBM_Plex_Sans_Arabic } from "next/font/google";
import ThemeRoot from "@/components/mahdi/ThemeRoot";
import { getMahdiSession } from "@/lib/mahdi/server/session";
import { getShrines, pickShrine } from "@/lib/mahdi/server/snapshot";
import { t } from "@/lib/mahdi/i18n";
import { DEFAULT_THEME, MAHDI_THEMES } from "@config/mahdi";
import "./mahdi.css";

const sans = IBM_Plex_Sans_Arabic({ variable: "--font-plex", subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"] });
const display = Amiri({ variable: "--font-amiri", subsets: ["arabic"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: { default: t.brand, template: `%s · ${t.brand}` },
  description: t.auth.tagline,
};

export async function generateViewport(): Promise<Viewport> {
  const { profile } = await getMahdiSession();
  const theme = MAHDI_THEMES.find((x) => x.key === (profile?.theme ?? DEFAULT_THEME))!;
  return { themeColor: theme.themeColor, viewportFit: "cover", colorScheme: theme.key === "minimal" ? "light" : "dark" };
}

/** «لأجل المهدي»: its own look and fonts, separate from the rest of the site. */
export default async function MahdiLayout({ children }: { children: React.ReactNode }) {
  const [{ profile }, shrines] = await Promise.all([getMahdiSession(), getShrines().catch(() => [])]);
  return (
    <ThemeRoot
      initialTheme={profile?.theme ?? DEFAULT_THEME}
      initialVariant={profile?.themeVariant ?? ""}
      initialShrine={pickShrine(shrines, profile?.shrineId)}
      fontClass={`${sans.variable} ${display.variable}`}
      skipLabel={t.common.skipToContent}
    >
      {children}
    </ThemeRoot>
  );
}
