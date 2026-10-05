"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Icon from "@/components/jawad/Icon";
import { LEVELS, OUTPUT_KINDS, STUDENT } from "@config/jawad/student";
import { post } from "./client";
import { KIND_LOOK, KindSample, STEP_LOOK, Tile } from "./look";
import { ErrorLine, useAsync } from "./ui";

const STAGE_INDEX: Record<string, number> = { sources: 0, review: 1, understanding: 2, scope: 3, outputs: 4 };

const HOW = [
  { emoji: "📤", grad: STEP_LOOK[0].grad, title: "ارفع مادتك", text: "نص، صور، أو ملفات PDF — بالترتيب الذي تريده." },
  { emoji: "🔍", grad: STEP_LOOK[1].grad, title: "راجع النص", text: "النص المستخرج كاملًا، صفحة صفحة أو كلها مرة وحدة." },
  { emoji: "🧠", grad: STEP_LOOK[2].grad, title: "اعتمد الفهم", text: "المساعد يشرح لك كيف فهم مادتك قبل أي شيء." },
  { emoji: "✨", grad: STEP_LOOK[4].grad, title: "اختر نواتجك", text: "ملخص، كتاب، عرض، صوت، اختبار… أو كلها." },
];

export default function StudentHome({
  name,
  projects,
  loginHref = null,
  left = null,
}: {
  /** materials this person can still make (null: no limit) */
  left?: number | null;
  name: string;
  /** signed-out visitor: where to sign in before making anything */
  loginHref?: string | null;
  projects: { id: string; title: string; level: string; stage: string; last_activity_at: string; expiresAt: string }[] | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLElement>(null);
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<string>("ثانوي");
  const [other, setOther] = useState("");
  const [audience, setAudience] = useState("");
  const { busy, error, run } = useAsync();

  // stays "busy" until the next page opens, so the button never looks like it did nothing
  const [going, setGoing] = useState(false);
  const create = () => {
    if (loginHref) {
      setGoing(true);
      router.push(loginHref);
      return;
    }
    return run(async () => {
      const r = await post<{ id: string }>("/api/jawad/student/projects", { title, level: level === "آخر" ? other : level, audience });
      setGoing(true);
      router.push(`${STUDENT.base}/${r.id}`);
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 py-8 sm:px-6 sm:py-12">
      {/* ───────── hero ───────── */}
      <section className="st-rise grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <span className="jw-chip !px-3 !py-1 !text-sm">✨ {name} · JAWAD AI</span>
          <h1 className="text-4xl leading-tight font-extrabold sm:text-5xl">
            ذاكر <span className="st-gradient-text">بذكاء</span>،
            <br />
            واصنع من مادتك أي شيء
          </h1>
          <p className="max-w-xl text-lg text-jw-muted">ارفع دروسك، ويحوّلها المساعد إلى ملخصات وكتب مصممة وعروض تقديمية وتسجيلات صوتية واختبارات — وأنت تعتمد كل خطوة.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="jw-btn jw-btn-primary !min-h-12 !px-7 !text-base" onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>
              <Icon name="plus" size={18} /> ابدأ مادة جديدة
            </button>
            {loginHref && (
              <a href={loginHref} className="jw-btn !min-h-12 !px-6">
                تسجيل الدخول
              </a>
            )}
            {projects && projects.length > 0 && (
              <a href="#my-materials" className="jw-btn !min-h-12 !px-6">
                موادي ({projects.length})
              </a>
            )}
          </div>
        </div>
        <div className="relative hidden h-72 lg:block" aria-hidden style={{ perspective: 900 }}>
          <div className="st-float absolute top-6 right-10" style={{ animationDuration: "8s" }}>
            <div className="st-book" style={{ transform: "scale(1.5)" }}>
              <span className="back" />
              <span className="pages" />
              <span className="cover" />
            </div>
          </div>
          <div className="st-float absolute top-40 left-6" style={{ animationDelay: "-3s" }}>
            <div className="st-pencil">
              <span className="face" />
              <span className="face b" />
              <span className="face c" />
              <span className="tip" />
              <span className="eraser" />
            </div>
          </div>
          <div className="st-float absolute top-2 left-16" style={{ animationDelay: "-5s", animationDuration: "10s" }}>
            <div className="st-cube">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="st-float absolute right-44 bottom-2" style={{ animationDelay: "-2s" }}>
            <div className="st-star" />
          </div>
        </div>
      </section>

      {/* ───────── how it works ───────── */}
      <section className="space-y-5" aria-labelledby="how">
        <h2 id="how" className="st-section-title text-xl">كيف يعمل؟</h2>
        <ol className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {HOW.map((h, i) => (
            <li key={h.title} className="jw-panel st-rise space-y-3 p-5" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="flex items-center justify-between">
                <Tile emoji={h.emoji} grad={h.grad} />
                <span className="text-3xl font-black text-jw-surface-3">{i + 1}</span>
              </div>
              <b className="block text-lg">{h.title}</b>
              <p className="text-sm text-jw-muted">{h.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ───────── what you can make ───────── */}
      <section className="space-y-5" aria-labelledby="make">
        <h2 id="make" className="st-section-title text-xl">ماذا تصنع من مادتك؟</h2>
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {OUTPUT_KINDS.map((k, i) => (
            <li key={k.kind} className="jw-panel st-rise space-y-3 p-4 transition-transform hover:-translate-y-1" style={{ animationDelay: `${i * 0.06}s` }}>
              <KindSample kind={k.kind} />
              <div className="flex items-center gap-2">
                <Tile emoji={KIND_LOOK[k.kind].emoji} grad={KIND_LOOK[k.kind].grad} size={34} />
                <b>{k.name}</b>
              </div>
              <p className="text-xs text-jw-muted">{k.blurb}</p>
            </li>
          ))}
          <li className="st-rise flex flex-col justify-center gap-2 rounded-[22px] p-5 text-white shadow-xl" style={{ background: "linear-gradient(135deg,#7c3aed,#db2777 55%,#f97316)" }}>
            <span className="text-2xl">🪄</span>
            <b className="text-lg">بـ GPT Image 2</b>
            <p className="text-sm text-white/90">عروض تُرسم شرائحها كاملة كلوحات فنية — أجمل بكثير.</p>
          </li>
        </ul>
      </section>

      {/* ───────── new material ───────── */}
      <section ref={formRef} className="jw-panel st-rise mx-auto max-w-3xl space-y-6 p-6 sm:p-8" aria-labelledby="new-material">
        <div className="space-y-1 text-center">
          <span className="text-4xl" aria-hidden>
            🎒
          </span>
          <h2 id="new-material" className="text-2xl font-bold">
            مادة جديدة
          </h2>
          <p className="text-sm text-jw-muted">ثلاث معلومات فقط، ثم ترفع مادتك.</p>
          {left !== null && <p className={`text-xs font-bold ${left ? "text-jw-accent" : "text-jw-danger"}`}>{left ? `متبقٍّ لك ${left === 1 ? "مادة واحدة" : `${left} مادتان`} من ٢` : "استخدمت المادتين المتاحتين لحسابك."}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="jw-label" htmlFor="st-title">اسم المادة</label>
            <input id="st-title" className="jw-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: الفصل الثالث — الخلية" />
          </div>
          <div>
            <label className="jw-label" htmlFor="st-aud">لمن؟ (اختياري)</label>
            <input id="st-aud" className="jw-input" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="لي للمراجعة، أو لزملائي" />
          </div>
        </div>
        <div className="space-y-2">
          <span className="jw-label">المستوى التعليمي</span>
          <div className="jw-seg justify-center" role="radiogroup" aria-label="المستوى التعليمي">
            {[...LEVELS, "آخر"].map((l) => (
              <button key={l} type="button" role="radio" aria-checked={level === l} onClick={() => setLevel(l)}>
                {l}
              </button>
            ))}
          </div>
          {level === "آخر" && <input className="jw-input" value={other} onChange={(e) => setOther(e.target.value)} placeholder="اكتب المستوى والتخصص" aria-label="المستوى والتخصص" />}
        </div>
        <ErrorLine error={error} />
        <div className="text-center">
          <button type="button" className="jw-btn jw-btn-primary !min-h-12 !px-10 !text-base" onClick={create} disabled={busy || going || left === 0}>
            {busy || going ? <span className="jw-spinner !border-white/40 !border-t-white" aria-hidden /> : <Icon name="sparkles" size={18} />}
            {loginHref ? "سجّل دخولك وابدأ" : going ? "جارٍ الفتح…" : "ابدأ"}
          </button>
          {loginHref && <p className="mt-2 text-xs text-jw-muted">التصفح مفتوح للجميع. لتصنع من مادتك سجّل دخولك أولًا، وترجع هنا مباشرة.</p>}
        </div>
      </section>

      {/* ───────── my materials ───────── */}
      {!loginHref && (
      <section id="my-materials" aria-labelledby="mine" className="space-y-5">
        <h2 id="mine" className="st-section-title text-xl">موادي</h2>
        {projects === null ? (
          <p className="jw-panel p-5 text-sm text-jw-muted">القسم قيد التجهيز.</p>
        ) : projects.length === 0 ? (
          <p className="jw-panel p-5 text-center text-sm text-jw-muted">ما عندك مواد بعد — ابدأ أول مادة من الأعلى 👆</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const i = STAGE_INDEX[p.stage] ?? 0;
              return (
                <li key={p.id}>
                  <Link href={`${STUDENT.base}/${p.id}`} className="jw-panel block space-y-3 p-5 transition-transform hover:-translate-y-1">
                    <div className="flex items-center gap-3">
                      <Tile emoji={STEP_LOOK[i].emoji} grad={STEP_LOOK[i].grad} size={40} />
                      <div className="min-w-0">
                        <b className="block truncate">{p.title || "مادة"}</b>
                        <span className="text-xs text-jw-muted">{p.level || "—"}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-2 overflow-hidden rounded-full bg-jw-surface-3">
                        <div className="h-full rounded-full" style={{ width: `${((i + 1) / 5) * 100}%`, background: "var(--st-grad)" }} />
                      </div>
                      <span className="text-xs text-jw-muted">المرحلة: {STEP_LOOK[i].label}</span>
                    </div>
                    <span className="block text-[11px] text-jw-faint">تُحذف {new Date(p.expiresAt).toLocaleDateString("ar")} إن لم تُستخدم</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      )}
    </div>
  );
}
