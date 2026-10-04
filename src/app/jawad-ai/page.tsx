import Image from "next/image";
import Link from "next/link";
import AdsGrid from "@/components/jawad/AdsGrid";
import Icon from "@/components/jawad/Icon";
import { liveAds } from "@/lib/jawad/server/ads";
import { jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { JAWAD } from "@config/jawad/brand";

export const dynamic = "force-dynamic";

const BLURB: Record<string, string> = {
  "studio:image": "صور من النص أو من مراجعك، بالنسب والدقة التي تختارها.",
  "studio:video": "فيديو من النص أو من إطار أول وأخير أو مراجع متعددة.",
  "studio:audio": "كلام منطوق بأصوات مختلفة ووصف أداء منفصل.",
  film: "من الفكرة إلى السيناريو والشيتات والمقاطع، خطوة بخطوة.",
};

/** JAWAD AI's home: the three ads first, then the sections. */
export default async function JawadHome() {
  const [rt, ads, { owner }] = await Promise.all([loadRuntime(), liveAds(), jawadSession()]);
  const hasAds = Boolean(ads.main || ads.side_top || ads.side_bottom);
  const sections = rt.sections.filter((s) => s.enabled);

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 px-3 py-5 sm:px-5 sm:py-6">
      {hasAds ? (
        <section aria-label="إعلانات">
          <AdsGrid ads={ads} emptyHint={owner ? <Link href="/jawad-ai/admin/ads" className="text-xs underline">خانة فارغة: أضف إعلانًا</Link> : null} />
        </section>
      ) : (
        // Nothing published yet: an honest welcome, not made-up ads
        <section className="jw-panel relative overflow-hidden px-6 py-10 sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -end-24 -top-24 size-80 rounded-full bg-jw-accent opacity-[0.08] blur-3xl" aria-hidden />
          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <Image src={rt.brand.logoUrl} alt="" width={96} height={96} unoptimized={rt.brand.customLogo} className="size-20 rounded-full sm:size-24" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold sm:text-3xl">
                <span dir="ltr">{JAWAD.nameEn}</span> <span className="text-jw-muted">·</span> {JAWAD.nameAr}
              </h1>
              <p className="max-w-xl text-jw-muted">{JAWAD.tagline}</p>
              {owner && (
                <p className="text-xs text-jw-faint">
                  لا توجد إعلانات منشورة بعد. <Link href="/jawad-ai/admin/ads" className="text-jw-accent underline">أضف الإعلانات الثلاثة</Link>
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="jw-sections" className="space-y-3">
        <h2 id="jw-sections" className="text-sm font-medium text-jw-muted">الأقسام</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {sections.map((s) => (
            <li key={s.id}>
              <Link href={s.path} className="jw-panel group flex h-full items-start gap-3 p-4 transition-colors hover:border-jw-line-strong hover:bg-jw-surface-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-jw-accent-soft text-jw-accent">
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
          ))}
        </ul>
      </section>
    </div>
  );
}
