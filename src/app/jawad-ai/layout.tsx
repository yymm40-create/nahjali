import type { Metadata, Viewport } from "next";
import { Readex_Pro } from "next/font/google";
import { coinBalance } from "@/lib/coins";
import { createClient } from "@/lib/supabase/server";
import { getUsername } from "@/lib/username";
import { jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import JawadHeader from "@/components/jawad/JawadHeader";
import { JAWAD } from "@config/jawad/brand";
import "./jawad.css";

const readex = Readex_Pro({ variable: "--font-readex", subsets: ["arabic", "latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: `${JAWAD.nameEn} · ${JAWAD.nameAr}`, template: `%s · ${JAWAD.nameEn}` },
  description: JAWAD.tagline,
  applicationName: JAWAD.nameEn,
  openGraph: { title: `${JAWAD.nameEn} · ${JAWAD.nameAr}`, description: JAWAD.tagline, siteName: JAWAD.nameEn, locale: "ar", type: "website" },
  twitter: { card: "summary_large_image", title: `${JAWAD.nameEn} · ${JAWAD.nameAr}`, description: JAWAD.tagline },
};

export const viewport: Viewport = { themeColor: "#0b0c0f", colorScheme: "dark" };

/**
 * «الجواد الذكي!» | JAWAD AI: its own identity, header and sections bar, separate from «نهج علي» (the site's chrome
 * steps aside for /jawad-ai, see SiteChrome). Same sign-in, same coins.
 */
export default async function JawadLayout({ children }: { children: React.ReactNode }) {
  const [rt, { user, owner }] = await Promise.all([loadRuntime(), jawadSession()]);
  const [balance, username] = user
    ? await Promise.all([coinBalance(user.id), getUsername(await createClient(), user.id).catch(() => null)])
    : [null, null];
  return (
    <div className={`jw ${readex.variable}`} dir="rtl" lang="ar" style={{ ["--jw-accent" as string]: rt.brand.accent }}>
      <a href="#jw-main" className="sr-only z-50 rounded-lg bg-jw-accent px-3 py-2 text-white focus:not-sr-only focus:fixed focus:start-3 focus:top-3">
        تخطَّ إلى المحتوى
      </a>
      <JawadHeader rt={rt} user={user} owner={owner} balance={balance} username={username} />
      <main id="jw-main">{children}</main>
    </div>
  );
}
