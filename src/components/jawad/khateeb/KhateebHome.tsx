"use client";

// «الخطيب الذكي» — the branch's own first page (not the student's journey): the preacher says his topic and his goal, picks
// the occasion, the length and the file, and «الشيخ» does the rest by himself (KhateebRun): he researches the topic's text,
// finds the key verse and its tafsir, searches the poetry references for lines and the sources for stories, then writes the
// whole sermon by the method «المرجعية المأمونة».

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/jawad/Icon";
import RobotFace from "@/components/RobotFace";
import { SERMON_FORMATS, SERMON_LENGTHS, sermonFocus, type SermonAsk } from "@config/jawad/khateeb";
import { useBranch } from "@/components/jawad/student/branch";
import { post } from "@/components/jawad/student/client";
import { ErrorLine } from "@/components/jawad/student/ui";
import { MinbarScene, Turban } from "./KhateebArt";

interface Item {
  id: string;
  title: string;
  stage: string;
  expiresAt: string;
}

/** What «الشيخ» does after the preacher presses «ابدأ», in order. */
const STEPS = [
  { emoji: "📜", title: "يبحث في نصوص الموضوع", text: "الآيات والروايات والسيرة والمصيبة، من مصادر مدرسة أهل البيت بمصادرها" },
  { emoji: "📖", title: "الآية المفتاح وتفسيرها", text: "الآية من القرآن نصًا، وتفسيرها من «مجمع البيان» للطبرسي بأرقام الصفحات" },
  { emoji: "🪶", title: "الأبيات (الشطرين)", text: "يبحث في مراجع الشعر عن أبيات الموضوع، بنصها ورقم صفحتها" },
  { emoji: "🕌", title: "الخطبة كاملة", text: "المقدمة · صلب المجلس · الخاتمة والتخلّص · الرثاء — PDF و Word" },
];

export default function KhateebHome({ projects, refs }: { projects: Item[] | null; refs: { poetry: number; sources: number } }) {
  const { assistant: A, base, face, name } = useBranch();
  const router = useRouter();
  const [ask, setAsk] = useState<SermonAsk>({ topic: "", goal: "", occasion: "", length: "medium", format: "both", poems: "", poetry: refs.poetry > 0, sources: refs.sources > 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<SermonAsk>) => setAsk((a) => ({ ...a, ...p }));

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ask.topic.trim()) return setError("اكتب موضوع الخطبة.");
    if (!ask.goal.trim()) return setError("اكتب الغاية من الخطبة: وش تبي المستمع يطلع فيه.");
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ id: string }>("/api/jawad/student/projects", {
        title: ask.topic.trim().slice(0, 200),
        level: "",
        audience: "",
        branch: "khateeb",
        brief: { purpose: "understand", purposeNote: "", mode: "research", focus: sermonFocus(ask), where: "", auto: true, sermon: ask },
      });
      router.push(`${base}/${r.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-6 sm:py-12">
      <section className="st-rise grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <span className="jw-chip !px-3 !py-1 !text-sm">🕌 {name} · JAWAD AI</span>
          <h1 className="text-4xl leading-tight font-extrabold sm:text-5xl">
            قل موضوعك وغايتك،
            <br />
            و<span className="st-gradient-text">{A}</span> يحضّر خطبتك
          </h1>
          <p className="max-w-xl text-lg text-jw-muted">يبحث في نصوص الموضوع، ويجيب الآية وتفسيرها والأبيات بمصادرها وأرقام صفحاتها، ويكتب لك الخطبة كاملة على منهج «المرجعية المأمونة».</p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-jw-muted">
            <span className="inline-flex items-center gap-1.5">
              <Turban size={30} /> للمشايخ
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Turban sayyid size={30} /> وللسادة
            </span>
            <span>خطباء المنبر الحسيني</span>
          </p>
        </div>
        <MinbarScene className="mx-auto block w-full max-w-sm lg:max-w-md" />
      </section>

      {/* ───────── the request ───────── */}
      <form onSubmit={go} className="jw-panel st-rise space-y-5 p-5 sm:p-7" aria-labelledby="ask">
        <h2 id="ask" className="st-section-title flex items-center gap-2 text-xl">
          <RobotFace id={face} size={34} /> وش موضوع خطبتك؟
        </h2>
        <label className="block space-y-1.5">
          <b className="text-sm">الموضوع</b>
          <input className="jw-input w-full" value={ask.topic} onChange={(e) => set({ topic: e.target.value })} placeholder="مثل: الصبر في حياة السيدة زينب (ع)" maxLength={500} required />
        </label>
        <label className="block space-y-1.5">
          <b className="text-sm">الغاية</b>
          <textarea className="jw-textarea min-h-20 w-full" value={ask.goal} onChange={(e) => set({ goal: e.target.value })} placeholder="وش تبي المستمع يطلع فيه؟ مثل: أن الصبر موقف وقوة، مو ضعف" maxLength={1000} required />
        </label>
        <label className="block space-y-1.5">
          <b className="text-sm">المناسبة (اختياري)</b>
          <input className="jw-input w-full" value={ask.occasion} onChange={(e) => set({ occasion: e.target.value })} placeholder="مثل: ليلة السابع من محرم، وفاة السيدة زينب (ع)" maxLength={300} />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-sm font-bold">طول الخطبة</legend>
            <div className="jw-seg flex flex-wrap" role="radiogroup">
              {SERMON_LENGTHS.map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={ask.length === l.id} onClick={() => set({ length: l.id })}>
                  {l.label} · {l.minutes} د
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-sm font-bold">الملف</legend>
            <div className="jw-seg flex flex-wrap" role="radiogroup">
              {SERMON_FORMATS.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={ask.format === f.id} onClick={() => set({ format: f.id })}>
                  {f.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm font-bold">من وين ياخذ الشيخ؟</legend>
          <Check on={ask.poetry} disabled={!refs.poetry} onChange={(poetry) => set({ poetry })} label="الأبيات (الشطرين) من مراجع الشعر" hint={refs.poetry ? `${refs.poetry} مرجع جاهز` : "ما فيه مرجع شعر جاهز بعد"} />
          <Check on={ask.sources} disabled={!refs.sources} onChange={(sources) => set({ sources })} label="القصص والشواهد من المصادر" hint={refs.sources ? `${refs.sources} مصدر جاهز` : "ما فيه مصدر جاهز بعد"} />
        </fieldset>

        <details>
          <summary className="cursor-pointer text-sm font-bold">عندك أبيات تبيها في الخطبة؟ (اختياري)</summary>
          <textarea className="jw-textarea mt-2 min-h-24 w-full" value={ask.poems} onChange={(e) => set({ poems: e.target.value })} placeholder="اكتب الأبيات، وكل بيت في سطر، واسم الشاعر إذا تعرفه" maxLength={4000} />
        </details>

        <ErrorLine error={error} />
        <button type="submit" className="jw-btn jw-btn-primary !min-h-12 w-full !text-base sm:w-auto sm:!px-10" disabled={busy}>
          {busy ? <span className="jw-spinner" aria-hidden /> : <Icon name="plus" size={18} />} ابدأ — {A} يحضّر الخطبة
        </button>
      </form>

      {/* ───────── what the Sheikh does ───────── */}
      <section className="space-y-5" aria-labelledby="how">
        <h2 id="how" className="st-section-title text-xl">وش يسوي {A}؟</h2>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="jw-panel st-rise space-y-2 p-5" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="flex items-center justify-between">
                <span className="text-3xl" aria-hidden>
                  {s.emoji}
                </span>
                <span className="text-3xl font-black text-jw-surface-3">{i + 1}</span>
              </div>
              <b className="block text-lg">{s.title}</b>
              <p className="text-sm text-jw-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ───────── the preacher's sermons ───────── */}
      <section aria-labelledby="mine" className="space-y-5">
        <h2 id="mine" className="st-section-title text-xl">خطبي</h2>
        {projects === null ? (
          <p className="jw-panel p-5 text-sm text-jw-muted">القسم قيد التجهيز.</p>
        ) : projects.length === 0 ? (
          <p className="jw-panel p-5 text-center text-sm text-jw-muted">ما عندك خطب بعد — اكتب موضوعك فوق.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`${base}/${p.id}`} className="jw-panel block space-y-2 p-5 transition-transform hover:-translate-y-1">
                  <b className="block truncate">🕌 {p.title || "خطبة"}</b>
                  <span className="block text-[11px] text-jw-faint">تُحذف {new Date(p.expiresAt).toLocaleDateString("ar")} إن لم تُستخدم</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Check({ on, disabled, onChange, label, hint }: { on: boolean; disabled: boolean; onChange: (on: boolean) => void; label: string; hint: string }) {
  return (
    <label className={`flex items-center gap-3 rounded-2xl border border-jw-line bg-white p-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input type="checkbox" className="size-5 accent-[var(--jw-accent)]" checked={on && !disabled} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0">
        <b className="block text-sm">{label}</b>
        <span className="block text-[11px] text-jw-muted">{hint}</span>
      </span>
    </label>
  );
}
