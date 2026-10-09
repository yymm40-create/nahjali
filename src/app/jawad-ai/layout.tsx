import type { Metadata, Viewport } from "next";
import { Readex_Pro } from "next/font/google";
import { coinBalance } from "@/lib/coins";
import { createClient } from "@/lib/supabase/server";
import { getUsername } from "@/lib/username";
import { headers } from "next/headers";
import { gamesAllowed, getVisibility } from "@/lib/games/access";
import { contentAllowed, getVisibility as contentVisibility } from "@/lib/content/access";
import { designerAllowed, getVisibility as designerVisibility } from "@/lib/designer/access";
import { photoAllowed, getVisibility as photoVisibility } from "@/lib/photo/access";
import { jawadSession, jawadVisibleTo, freeFor } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import InDevelopment from "@/components/jawad/InDevelopment";
import JawadHeader from "@/components/jawad/JawadHeader";
import { JAWAD_PATH_HEADER } from "@config/site";
import { JAWAD } from "@config/jawad/brand";
import "./jawad.css";
import "./sections.css";

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
  const [rt, { user, owner }, h] = await Promise.all([loadRuntime(), jawadSession(), headers()]);
  // In development: only those «السماح» lets in (and the owners) see the platform; the sign-in page stays open
  const allowed = await jawadVisibleTo(user);
  const path = h.get(JAWAD_PATH_HEADER) ?? "";
  // (the dashboard keeps its own owner check: a plain JAWAD 404 for everyone else)
  const preview = !allowed && path !== `${JAWAD.base}/login` && path !== `${JAWAD.base}/username` && !path.startsWith(`${JAWAD.base}/admin`) && path !== `${JAWAD.base}/course`;
  const [balance, username] = user && !preview
    ? await Promise.all([coinBalance(user.id), getUsername(await createClient(), user.id).catch(() => null)])
    : [null, null];
  // «صانع الألعاب» shows in the bar by the owner's switch (/admin/games); the owner sees it hidden while it is "owner" only
  // (and «صانع المحتوى» the same way, by its switch in /admin/content)
  // (and «المصمم الذكي» by its switch in /admin/designer)
  const [gamesOk, gamesVis, contentOk, contentVis, designerOk, designerVis, photoOk, photoVis] = await Promise.all([
    user ? gamesAllowed(user.email) : false,
    owner ? getVisibility() : "all",
    user ? contentAllowed(user.email) : false,
    owner ? contentVisibility() : "all",
    user ? designerAllowed(user.email) : false,
    owner ? designerVisibility() : "all",
    user ? photoAllowed(user.email) : false,
    owner ? photoVisibility() : "all",
  ]);
  const bar = {
    ...rt,
    sections: rt.sections
      .filter((s) => (s.implementation !== "games" || gamesOk) && (s.implementation !== "content" || contentOk) && (s.implementation !== "designer" || designerOk) && (s.implementation !== "photo" || photoOk))
      .map((s) => (s.implementation === "games" ? { ...s, enabled: gamesVis !== "owner" } : s.implementation === "content" ? { ...s, enabled: contentVis !== "owner" } : s.implementation === "designer" ? { ...s, enabled: designerVis !== "owner" } : s.implementation === "photo" ? { ...s, enabled: photoVis !== "owner" } : s)),
  };
  return (
    <div className={`jw ${readex.variable}`} dir="rtl" lang="ar" style={{ ["--jw-accent" as string]: rt.brand.accent }} suppressHydrationWarning>
      {/* «عرض الديسكتوب» remembered on this device: applied before the first paint (LayoutToggle) */}
      <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('jw-layout')==='wide')document.currentScript.parentElement.classList.add('jw-wide')}catch(e){}" }} />
      <a href="#jw-main" className="sr-only z-50 rounded-lg bg-jw-accent px-3 py-2 text-white focus:not-sr-only focus:fixed focus:start-3 focus:top-3">
        تخطَّ إلى المحتوى
      </a>
      <JawadHeader rt={bar} user={user} owner={owner || (user ? await freeFor(user) : false)} balance={balance} username={username} preview={!allowed} />
      <main id="jw-main">{preview ? <InDevelopment logoUrl={rt.brand.logoUrl} customLogo={rt.brand.customLogo} /> : children}</main>
    </div>
  );
}
