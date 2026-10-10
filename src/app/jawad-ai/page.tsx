import Link from "next/link";
import AdsGrid from "@/components/jawad/AdsGrid";
import Home from "@/components/jawad/Home";
import Landing, { type LandingTool } from "@/components/jawad/Landing";
import { loadCreditSettings } from "@/lib/credits/settings";
import { liveAds } from "@/lib/jawad/server/ads";
import { canUseJawad, jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { barSections } from "@/lib/jawad/server/bar";
import { worksPage } from "@/lib/jawad/server/works";
import type { WorkItem } from "@/lib/jawad/labels";
import { JAWAD } from "@config/jawad/brand";
import { COURSE } from "@config/course";
import { LEARN } from "@config/learn";

export const dynamic = "force-dynamic";

const BLURB: Record<string, string> = {
  "studio:image": "صور من النص أو من مراجعك، بالنسب والدقة التي تختارها.",
  "studio:video": "فيديو من النص أو من إطار أول وأخير أو مراجع متعددة.",
  "studio:audio": "كلام منطوق بأصوات مختلفة ووصف أداء منفصل.",
  film: "فيلم أو مسلسل بحلقاته ومشاهده: من الفكرة إلى السيناريو والشيتات والمقاطع، خطوة بخطوة.",
  student: "ارفع مادتك الدراسية: ملخص، شرح، كتاب PDF، عرض PPTX، تسجيل صوتي واختبار.",
  editor: "مونتاج من الجوال أو الكمبيوتر: قص وترتيب ونصوص، وتصدير 720p أو 1080p.",
};

/** A finished work's picture (or video poster) for the «آخر أعمالك» strip. */
function thumb(w: WorkItem): { url: string; kind: "image" | "video" | "audio"; href: string; label: string } | null {
  if (w.type === "film") return w.url ? { url: w.url, kind: w.kind, href: w.href, label: w.projectTitle } : null;
  const o = w.outputs.find((x) => x.url);
  if (w.status !== "succeeded" || !o?.url) return null;
  return { url: o.url, kind: o.kind, href: `/jawad-ai/${w.sectionId}?tab=works`, label: w.prompt || w.generatorName };
}

// The visitor's front page: each tool as a card (the section's own name from the dashboard, a line, an icon and a colour)
const TOOL: Record<string, { icon: string; line: string; tint: string }> = {
  "studio:image": { icon: "🖼️", line: "صور من وصفك أو من صورك، بأي مقاس وجودة.", tint: "#f97316" },
  "studio:video": { icon: "🎬", line: "فيديو من نص أو صورة، بحركة سينمائية وصوت.", tint: "#22d3ee" },
  "studio:audio": { icon: "🎙️", line: "تعليق صوتي وأصوات وموسيقى ومؤثرات.", tint: "#14b8a6" },
  film: { icon: "🎞️", line: "فيلم أو مسلسل من فكرتك، مشهد بمشهد.", tint: "#e9b546" },
  editor: { icon: "✂️", line: "مونتاج من الجوال أو الكمبيوتر، مع «حيدرة».", tint: "#b8f53d" },
  content: { icon: "✍️", line: "«محمد باقر»: كاروسيل وريلز ومحتوى يبيع.", tint: "#f472b6" },
  designer: { icon: "🎨", line: "«كاظم»: بطاقات وإعلانات بخطوط عربية.", tint: "#a78bfa" },
  photo: { icon: "📸", line: "«زهراء»: تحرير صورك وتصاميمك بلمسة محترف.", tint: "#fb7185" },
  booklet: { icon: "📘", line: "«نور»: كتيب جداول وتحفيز بصورة طفلك أو صورتك.", tint: "#38bdf8" },
  student: { icon: "🎒", line: "ملخصات وشرح واختبارات من مادتك.", tint: "#7c3aed" },
  games: { icon: "🎮", line: "«قنبر»: صمّم لعبتك وخلّ الموقع يبنيها وتلعبها برابط.", tint: "#34d399" },
  islamic: { icon: "🕌", line: "أسئلتك الدينية بإجابات من مصادرها.", tint: "#10b981" },
};

/** JAWAD AI's home: a visitor gets the front page; a signed-in person gets the same colours: says what to make and starts, their latest works, every section as a card, the packages, the ads. */
export default async function JawadHome() {
  const [rt, ads, { user, owner }] = await Promise.all([loadRuntime(), liveAds(), jawadSession()]);
  if (!user) {
    const credits = await loadCreditSettings();
    const tools: LandingTool[] = rt.sections
      .filter((s) => s.enabled && s.implementation !== "islamic")
      .map((s) => {
        const t = TOOL[s.implementation];
        return t ? { href: s.path, name: s.name, ...t } : null;
      })
      .filter((t): t is LandingTool => !!t);
    const live = rt.generators.filter((g) => g.live);
    const samples = [...new Set(live.map((g) => g.sampleUrl).filter((u): u is string => !!u && /\.(png|jpe?g|webp)(\?|$)/i.test(u)))].slice(0, 12);
    const models = [...new Set(live.map((g) => g.name))].slice(0, 14);
    return <Landing loginHref={jawadLogin(JAWAD.base)} samples={samples} tools={tools} models={models} packs={credits.packs} featured={credits.featured} />;
  }
  const hasAds = Boolean(ads.main || ads.side_top || ads.side_bottom);
  // every branch this person may open (the same as the top bar), the owner's hidden ones too
  const sections = (await barSections(rt, user, owner)).filter((s) => s.enabled || owner);
  const allowed = await canUseJawad(user);
  const recent = allowed ? (await worksPage(user.id, "all", null).catch(() => null))?.items.map(thumb).filter((t): t is NonNullable<typeof t> => Boolean(t)).slice(0, 10) ?? [] : [];
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const first = String(meta.full_name || meta.name || "").trim().split(/\s+/)[0] ?? "";

  return (
    <Home
      first={first}
      owner={owner}
      userId={user.id}
      sections={sections.map((s) => ({ id: s.id, name: s.name, path: s.path, output: s.output, implementation: s.implementation }))}
      tools={[
        ...sections.map((s) => ({ href: s.path, name: s.name, ...(TOOL[s.implementation] ?? { icon: "✨", line: BLURB[s.implementation] ?? "", tint: "#8b5cf6" }) })),
        // the branches outside the registry: the course and the lessons of those who bought it
        { href: COURSE.base, name: COURSE.name, icon: "🎓", line: "تعلّم تصنع بالذكاء الاصطناعي خطوة بخطوة.", tint: "#fbbf24" },
        { href: LEARN.base, name: "دوراتي", icon: "📺", line: "دروس الدورات اللي اشتركت فيها.", tint: "#60a5fa" },
      ]}
      recent={recent}
      ads={hasAds ? <AdsGrid ads={ads} emptyHint={owner ? <Link href="/jawad-ai/admin/ads" className="text-xs underline">خانة فارغة: أضف إعلانًا</Link> : null} /> : null}
    />
  );
}
