import type { Metadata, Viewport } from "next";
import { Readex_Pro } from "next/font/google";
import { coinBalance } from "@/lib/coins";
import { createClient } from "@/lib/supabase/server";
import { getUsername } from "@/lib/username";
import { headers } from "next/headers";
import { jawadSession, jawadVisibleTo, freeFor } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { barSections } from "@/lib/jawad/server/bar";
import { giveSignupGift } from "@/lib/gift";
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
  const preview = !allowed && path !== `${JAWAD.base}/login` && path !== `${JAWAD.base}/username` && !path.startsWith(`${JAWAD.base}/admin`) && path !== `${JAWAD.base}/course` && !path.startsWith(`${JAWAD.base}/learn`);
  // the launch night's gift (once per account, until the offer ends), before the balance is read
  if (user && !preview) await giveSignupGift(user);
  const [balance, username] = user && !preview
    ? await Promise.all([coinBalance(user.id), getUsername(await createClient(), user.id).catch(() => null)])
    : [null, null];
  // «صانع الألعاب», «صانع المحتوى», «المصمم الذكي» and «زهراء» follow their own switches (see barSections)
  const bar = { ...rt, sections: await barSections(rt, user, owner) };
  return (
    <div className={`jw ${readex.variable}`} dir="rtl" lang="ar" style={{ ["--jw-accent" as string]: rt.brand.accent }} suppressHydrationWarning>
      {/* «عرض الديسكتوب» remembered on this device: applied before the first paint (LayoutToggle) */}
      <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('jw-layout')==='wide')document.currentScript.parentElement.classList.add('jw-wide')}catch(e){}" }} />
      <a href="#jw-main" className="sr-only z-50 rounded-lg bg-jw-accent px-3 py-2 text-white focus:not-sr-only focus:fixed focus:start-3 focus:top-3">
        تخطَّ إلى المحتوى
      </a>
      <JawadHeader rt={bar} user={user} owner={owner || (user ? await freeFor(user) : false)} boss={owner} balance={balance} username={username} preview={!allowed} version={(process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7)} />
      <main id="jw-main">{preview ? <InDevelopment logoUrl={rt.brand.logoUrl} customLogo={rt.brand.customLogo} /> : children}</main>
    </div>
  );
}
