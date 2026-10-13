"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "./Icon";

export interface QuickSection {
  id: string;
  name: string;
  path: string;
  output: "image" | "video" | "audio" | null;
  implementation: string;
}

type Kind = "image" | "video" | "audio" | "film" | "student" | "editor";

const KIND_AR: Record<Kind, { label: string; icon: string; hint: string }> = {
  image: { label: "صورة", icon: "image", hint: "صف الصورة: مين؟ وين؟ أي لون؟" },
  video: { label: "فيديو", icon: "video", hint: "صف المشهد وحركته: مين يتحرك؟ وين تروح الكاميرا؟" },
  audio: { label: "صوت", icon: "audio", hint: "اكتب الكلام اللي تبيه ينقال." },
  film: { label: "فيلم كامل", icon: "film", hint: "اكتب فكرة قصتك بأسطر قليلة، والفيلم يبدأ خطوة بخطوة." },
  student: { label: "مادة دراسية", icon: "book", hint: "ارفع درسك ونحوّله لملخص وكتاب وعرض واختبار." },
  editor: { label: "مونتاج", icon: "scissors", hint: "ارفع مقاطعك وركّبها: قص وترتيب ونص، وصدّرها فيديو واحد." },
};

// Which section the words point to (the user can always change it with the chips)
function guessKind(text: string): Kind {
  const t = text.toLowerCase();
  if (/مونتاج|منتج|ممنتج|ركّب المقاطع|ركب المقاطع|قص المقطع|اقص|montage|edit my|video edit/.test(t)) return "editor";
  if (/فيلم|سيناريو|قصة طويلة|حلقة|مسلسل|movie|film/.test(t)) return "film";
  if (/درس|مادة|ملخص|اختبار|منهج|كتاب مدرسي|محاضرة|lesson|quiz|summar/.test(t)) return "student";
  if (/فيديو|مقطع|حركة|يمشي|يركض|يطير|كاميرا|لقطة|يتحرك|video|clip|camera|animate/.test(t)) return "video";
  if (/صوت|اقرأ|قل |يقول|تعليق صوتي|نطق|غنّ|أغنية|voice|speak|say|read aloud|narrat/.test(t)) return "audio";
  return "image";
}

const EXAMPLES: { kind: Kind; text: string }[] = [
  { kind: "image", text: "قطة صغيرة تلبس عباية ذهبية وتجلس على سجادة في بيت نجدي قديم، إضاءة دافئة" },
  { kind: "video", text: "فيديو لخيل عربي يركض على شاطئ عند الغروب والكاميرا تتبعه من الجنب" },
  { kind: "audio", text: "صوت يقرأ: أهلًا بك في الجواد الذكي، هنا تصنع أفكارك بنفسك" },
  { kind: "film", text: "فيلم عن طفل يتعلّم الصدق من جدّه في قرية صغيرة" },
];

const DRAFT = (userId: string | null, sectionId: string) => `jawad:draft:v1:${userId ?? "anon"}:${sectionId}`;

/**
 * JAWAD AI's front door: write what you want, we open the right section with your words already in the prompt box.
 * Prompt-first (like the leading creative tools), with the sections one tap away for people who know where to go.
 */
export default function QuickStart({ sections, userId, loginHref, freeImageAvailable = false, hero = false }: { sections: QuickSection[]; userId: string | null; loginHref: string | null; freeImageAvailable?: boolean; /** inside the home's hero (its own title above, its own colours: home.css) */ hero?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Kind | null>(null);
  // arriving with an idea (a shot «حيدرة كت» suggested, for one): it is already in the box
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const idea = q.get("idea")?.slice(0, 500);
    const kind = q.get("kind") as Kind | null;
    const t = setTimeout(() => {
      if (idea) setText(idea);
      if (kind && kind in KIND_AR) setPicked(kind);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const [going, setGoing] = useState(false);
  const kind: Kind = picked ?? guessKind(text);
  const info = KIND_AR[kind];

  const target = (k: Kind) =>
    k === "film" || k === "student" || k === "editor" ? sections.find((s) => s.implementation === k) : sections.find((s) => s.output === k);
  const available = (Object.keys(KIND_AR) as Kind[]).filter((k) => target(k));

  function go(t = text, k = kind) {
    const sec = target(k);
    if (!sec) return;
    setGoing(true);
    if (sec.output && t.trim()) {
      // the words go into that section's draft; the studio restores it on arrival
      try {
        const key = DRAFT(userId, sec.id);
        const cur = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>;
        localStorage.setItem(key, JSON.stringify({ ...cur, prompt: t.trim() }));
      } catch {
        // storage blocked: the section still opens
      }
    }
    const idea = t.trim() ? `?idea=${encodeURIComponent(t.trim().slice(0, 500))}` : "";
    if (k === "image" && freeImageAvailable && t.trim()) {
      router.push(`${sec.path}?welcomeFree=1&idea=${encodeURIComponent(t.trim().slice(0, 500))}`);
      return;
    }
    router.push(sec.output ? sec.path : k === "film" ? `${sec.path}/new${idea}` : k === "editor" ? sec.path : `${sec.path}${idea}`);
  }

  return (
    <section className={hero ? "hm-q" : "jw-panel relative overflow-hidden p-4 sm:p-6"} aria-labelledby={hero ? undefined : "jw-quick"} aria-label={hero ? "وش تبي تصنع اليوم؟" : undefined}>
      {!hero && <div className="pointer-events-none absolute -start-20 -top-24 size-72 rounded-full bg-jw-accent opacity-[0.1] blur-3xl" aria-hidden />}
      <div className="relative space-y-3">
        {!hero && <h1 id="jw-quick" className="text-xl font-bold sm:text-2xl">وش تبي تصنع اليوم؟</h1>}
        {hero && <p className="hm-q-kicker"><Icon name="sparkles" size={15} /> ابدأ من فكرتك — بدون خطوات تمهيدية</p>}
        <p className="hm-q-label">وش ودّك تصنع؟</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="نوع الناتج">
          {available.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setPicked(k)}
              className={`jw-chip hm-q-choice !px-3.5 !py-2 !text-sm transition-all ${kind === k ? "is-picked !border-jw-accent !bg-jw-accent-soft !text-jw-ink" : ""}`}
            >
              <Icon name={KIND_AR[k].icon} size={16} /> {KIND_AR[k].label}
              {kind === k && <span className="hm-q-check" aria-hidden>✓</span>}
              {!picked && kind === k && text.trim() && <span className="text-[10px] text-jw-muted">· مقترح</span>}
            </button>
          ))}
        </div>
        <label className="hm-q-input-label" htmlFor="jw-quick-prompt">اكتب فكرتك بطريقتك</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <textarea
            id="jw-quick-prompt"
            className="jw-textarea min-h-[88px] flex-1 text-base"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) go();
            }}
            placeholder={kind === "image" ? "مثال: صورة فنجان قهوة على طاولة خشب وقت الغروب…" : info.hint}
            aria-label="وصف ما تريد صنعه"
            dir="auto"
          />
          <button type="button" className="jw-btn jw-btn-primary sm:min-h-full sm:px-6" disabled={going || (kind === "image" && freeImageAvailable && !text.trim())} onClick={() => go()}>
            {going ? <span className="jw-spinner" aria-hidden /> : <Icon name="sparkles" size={18} />}
            {kind === "image" && freeImageAvailable ? (text.trim() ? "أنشئ صورتي المجانية" : "اكتب فكرتك للصورة المجانية") : kind === "image" ? "ابدأ بصورة" : text.trim() ? `ابدأ: ${info.label}` : `افتح: ${info.label}`}
          </button>
        </div>
        {kind === "image" && <p className="hm-q-note">{freeImageAvailable ? "حسابك جديد: اكتب أي وصف، وننشئ لك صورة واحدة مجانًا الآن." : "اكتب فكرتك واضغط «ابدأ بصورة» — نجهّزها لك في استوديو الصور مباشرة."}</p>}
        {!userId && loginHref && <p className="text-xs text-jw-muted">تقدر تكتب وتشوف الأقسام بدون حساب، والصنع يحتاج دخول.</p>}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-jw-faint">جرّب مثال:</span>
          {EXAMPLES.filter((e) => target(e.kind)).map((e) => (
            <button key={e.text} type="button" className="jw-chip !text-xs hover:!border-jw-accent-line" onClick={() => { setText(e.text); setPicked(e.kind); }}>
              <Icon name={KIND_AR[e.kind].icon} size={12} /> {e.text.length > 44 ? `${e.text.slice(0, 44)}…` : e.text}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
