import Image from "next/image";
import Link from "next/link";
import AdsGrid from "@/components/jawad/AdsGrid";
import Icon from "@/components/jawad/Icon";
import QuickStart from "@/components/jawad/QuickStart";
import { liveAds } from "@/lib/jawad/server/ads";
import { canUseJawad, jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { worksPage } from "@/lib/jawad/server/works";
import type { WorkItem } from "@/lib/jawad/labels";
import { JAWAD } from "@config/jawad/brand";

export const dynamic = "force-dynamic";

const BLURB: Record<string, string> = {
  "studio:image": "صور من النص أو من مراجعك، بالنسب والدقة التي تختارها.",
  "studio:video": "فيديو من النص أو من إطار أول وأخير أو مراجع متعددة.",
  "studio:audio": "كلام منطوق بأصوات مختلفة ووصف أداء منفصل.",
  film: "من الفكرة إلى السيناريو والشيتات والمقاطع، خطوة بخطوة.",
  student: "ارفع مادتك الدراسية: ملخص، شرح، كتاب PDF، عرض PPTX، تسجيل صوتي واختبار.",
};

// Each section's own colour (the same as its page, sections.css), so the home already shows the difference
const TINT: Record<string, string> = {
  "studio:image": "#c2410c",
  "studio:video": "#22d3ee",
  "studio:audio": "#0f766e",
  film: "#e9b546",
  student: "#7c3aed",
};

/** A finished work's picture (or video poster) for the «آخر أعمالك» strip. */
function thumb(w: WorkItem): { url: string; kind: "image" | "video" | "audio"; href: string; label: string } | null {
  if (w.type === "film") return w.url ? { url: w.url, kind: w.kind, href: w.href, label: w.projectTitle } : null;
  const o = w.outputs.find((x) => x.url);
  if (w.status !== "succeeded" || !o?.url) return null;
  return { url: o.url, kind: o.kind, href: `/jawad-ai/${w.sectionId}?tab=works`, label: w.prompt || w.generatorName };
}

/** JAWAD AI's home: say what you want and start, your latest works, then the sections. */
export default async function JawadHome() {
  const [rt, ads, { user, owner }] = await Promise.all([loadRuntime(), liveAds(), jawadSession()]);
  const hasAds = Boolean(ads.main || ads.side_top || ads.side_bottom);
  const sections = rt.sections.filter((s) => s.enabled);
  const allowed = user ? await canUseJawad(user) : false;
  const recent = user && allowed ? (await worksPage(user.id, "all", null).catch(() => null))?.items.map(thumb).filter((t): t is NonNullable<typeof t> => Boolean(t)).slice(0, 8) ?? [] : [];

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 px-3 py-5 sm:px-5 sm:py-6">
      <QuickStart
        sections={sections.map((s) => ({ id: s.id, name: s.name, path: s.path, output: s.output, implementation: s.implementation }))}
        userId={user?.id ?? null}
        loginHref={user ? null : jawadLogin(JAWAD.base)}
      />

      {recent.length > 0 && (
        <section aria-labelledby="jw-recent" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="jw-recent" className="text-sm font-medium text-jw-muted">آخر أعمالك</h2>
            <Link href={`/jawad-ai/${sections.find((s) => s.output)?.id ?? "images"}?tab=works`} className="text-xs text-jw-accent hover:underline">كل أعمالي ←</Link>
          </div>
          <ul className="jw-scroll flex gap-2 overflow-x-auto pb-1">
            {recent.map((t, i) => (
              <li key={i} className="shrink-0">
                <Link href={t.href} className="group block w-36 overflow-hidden rounded-xl border border-jw-line bg-jw-surface transition-colors hover:border-jw-line-strong sm:w-44" title={t.label}>
                  <span className="relative block aspect-square bg-jw-bg-2">
                    {t.kind === "video" ? (
                      <video src={`${t.url}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover" />
                    ) : t.kind === "audio" ? (
                      <span className="grid size-full place-items-center text-jw-accent"><Icon name="audio" size={36} /></span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                      <img src={t.url} alt="" loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
                    )}
                    {t.kind === "video" && <span className="absolute bottom-1.5 end-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white"><Icon name="play" size={12} /></span>}
                  </span>
                  <span className="block truncate px-2 py-1.5 text-[11px] text-jw-muted" dir="auto">{t.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="jw-sections" className="space-y-3">
        <h2 id="jw-sections" className="text-sm font-medium text-jw-muted">الأقسام</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {sections.map((s) => {
            const tint = TINT[s.implementation] ?? "var(--jw-accent)";
            return (
              <li key={s.id}>
                <Link
                  href={s.path}
                  className="jw-panel group relative flex h-full items-start gap-3 overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:border-jw-line-strong"
                  style={{ borderTopColor: tint, borderTopWidth: 3 }}
                >
                  <span className="pointer-events-none absolute -end-10 -top-10 size-28 rounded-full opacity-[0.12] blur-2xl transition-opacity group-hover:opacity-25" style={{ background: tint }} aria-hidden />
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${tint} 16%, transparent)`, color: tint }}>
                    <Icon name={s.icon} size={20} />
                  </span>
                  <span className="min-w-0 space-y-1">
                    <span className="flex items-center gap-1 font-semibold">
                      {s.name}
                      <Icon name="chevronLeft" size={14} className="text-jw-faint transition-transform group-hover:-translate-x-0.5" />
                    </span>
                    <span className="block text-sm text-jw-muted">{BLURB[s.implementation] ?? ""}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {hasAds ? (
        <section aria-label="إعلانات">
          <AdsGrid ads={ads} emptyHint={owner ? <Link href="/jawad-ai/admin/ads" className="text-xs underline">خانة فارغة: أضف إعلانًا</Link> : null} />
        </section>
      ) : (
        <section className="jw-panel relative overflow-hidden px-6 py-8 sm:px-10">
          <div className="pointer-events-none absolute -end-24 -top-24 size-80 rounded-full bg-jw-accent opacity-[0.08] blur-3xl" aria-hidden />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <Image src={rt.brand.logoUrl} alt="" width={96} height={96} unoptimized={rt.brand.customLogo} className="size-16 rounded-full sm:size-20" />
            <div className="space-y-1">
              <p className="text-xl font-bold">
                <span dir="ltr">{JAWAD.nameEn}</span> <span className="text-jw-muted">·</span> {JAWAD.nameAr}
              </p>
              <p className="max-w-xl text-sm text-jw-muted">{JAWAD.tagline}</p>
              {owner && (
                <p className="text-xs text-jw-faint">
                  لا توجد إعلانات منشورة بعد. <Link href="/jawad-ai/admin/ads" className="text-jw-accent underline">أضف الإعلانات الثلاثة</Link>
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
