"use client";

// «الطالب الذكي» — the short questions of each output (detail, page count, size, file type, slides, quiz…) and the
// design step (style, the student's ideas, fonts, page frame). Used by «النواتج» before «ابدأ», and again by an output
// the student goes back to («ارجع وغيّر»).

import { useState } from "react";
import { coinStr } from "@config/coins";
import { COUNTED_KINDS, chosenPages } from "@/lib/jawad/student/draw";
import { FONTS, FORMATS, MAX_PAGES, OUTPUT_KINDS, STYLES, isPaged, type DesignWish, type OutputKind } from "@config/jawad/student";
import { MAP_GRADES, MAP_TYPES, gradeOf } from "@/lib/jawad/student/mindmap";
import { PICTURE_KINDS } from "./autopilot";
import { fontFacesUrl } from "./client";
import type { ProjectHook } from "./StudentProject";
import Coined from "@/components/Coined";
import RobotFace from "@/components/RobotFace";

type S = Record<string, unknown>;

/** The level of a written output, from the lightest to the deepest. */
export const LEVEL_OPTIONS = [
  { id: "low", label: "خفيف" },
  { id: "medium", label: "متوسط" },
  { id: "high", label: "عميق" },
  { id: "max", label: "أعمق" },
];

/** The first answer of every question (what the assistant would choose). */
export function defaults(kind: OutputKind, level: string): S {
  const young = /ابتدائي|متوسط/.test(level);
  switch (kind) {
    case "summary":
    case "explain":
    case "preread":
      return { density: young ? "low" : "medium", pages: 0, page: "A4", format: "pdf", pictures: "" };
    case "book":
      return { writing: "explain", page: "A4", pages: 0, density: "medium", format: "pdf", pictures: "" };
    case "slides":
      return { density: "medium", count: 0, aspect: "16:9", notesMode: "both", render: "editable", imageQuality: "high" };
    case "audio":
      return { source: "text", mode: "single" };
    case "mindmap":
      return { mapType: "auto", scope: young ? "one" : "sections", render: "editable", imageQuality: "high", recall: true };
    case "quiz":
      return { count: 10, difficulty: young ? "easy" : "medium", types: young ? ["mcq", "tf"] : ["mcq", "tf", "short"], usage: "both" };
    default:
      return {};
  }
}

export function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.id)} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className={`rounded-full border px-3 py-1.5 text-sm transition-all ${value === o.id ? "border-transparent bg-violet-600 text-white" : "border-jw-line bg-white hover:border-violet-300"}`}>
            <Coined text={o.label} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** A number from a few chips, or any other number typed (0 = «حسب المادة»). */
export function Count({ label, value, options, max, unit, onChange }: { label: string; value: number; options: number[]; max: number; unit: string; onChange: (n: number) => void }) {
  const [typing, setTyping] = useState(() => value > 0 && !options.includes(value));
  return (
    <div className="space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={label}>
        {[0, ...options].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={!typing && value === n} onClick={() => { setTyping(false); onChange(n); }} className={`rounded-full border px-3 py-1.5 text-sm transition-all ${!typing && value === n ? "border-transparent bg-violet-600 text-white" : "border-jw-line bg-white hover:border-violet-300"}`}>
            {n === 0 ? "حسب المادة" : n.toLocaleString("ar")}
          </button>
        ))}
        <button type="button" role="radio" aria-checked={typing} onClick={() => setTyping(true)} className={`rounded-full border px-3 py-1.5 text-sm ${typing ? "border-transparent bg-violet-600 text-white" : "border-jw-line bg-white"}`}>
          عدد آخر
        </button>
        {typing && (
          <input type="number" inputMode="numeric" min={1} max={max} className="jw-input !w-24 !py-1.5" value={value || ""} onChange={(e) => onChange(Math.max(0, Math.min(max, Math.round(Number(e.target.value) || 0))))} aria-label={`${label} (رقم)`} placeholder={unit} />
        )}
      </div>
      {value > 0 && <p className="text-[11px] text-jw-faint">يلتزم صادق بالعدد بالضبط: {value.toLocaleString("ar")} {unit}.</p>}
    </div>
  );
}

/** «GPT Image 2 or Claude»: what each gives, and what drawing costs. */
export function MethodChoice({ what, value, quality, perUnit, free, onChange }: { what: "page" | "slide" | "map"; value: boolean; quality: string; perUnit: { high: number; medium: number }; free: boolean; onChange: (draw: boolean, quality: string) => void }) {
  const unit = what === "slide" ? "الشريحة" : what === "map" ? "الخريطة" : "الصفحة";
  const price = (q: "high" | "medium") => (free ? "مجانًا لك الحين" : `≈ ${coinStr(perUnit[q])} لكل ${what === "slide" ? "شريحة" : what === "map" ? "خريطة" : "صفحة"}`);
  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold">كيف تنصنع {what === "slide" ? "الشرائح" : what === "map" ? "الخريطة" : "الصفحات"}؟</span>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" aria-pressed={!value} onClick={() => onChange(false, quality)} className={`rounded-2xl border bg-white p-3 text-start ${!value ? "border-transparent ring-4 ring-violet-300" : "border-jw-line"}`}>
          <b className="block">🧩 صادق يصممها</b>
          <span className="block text-xs text-jw-muted">
            {what === "slide" ? "ملف PPTX تقدر تعدّل نصه بنفسك + PDF." : what === "map" ? "صورة PNG عالية الدقة (4K تقريبًا) + PDF، وتعدّل فروعها بنفسك قبل الرسم." : "PDF بخط عربي حقيقي، نصه قابل للنسخ والبحث."} بدون أخطاء في الكلمات. الأرخص: بدون تكلفة إضافية.
          </span>
        </button>
        <button type="button" aria-pressed={value} onClick={() => onChange(true, quality)} className={`rounded-2xl p-3 text-start text-white ${value ? "ring-4 ring-pink-300" : "opacity-90"}`} style={{ background: "linear-gradient(135deg,#7c3aed,#db2777 55%,#f97316)" }}>
          <b className="block">🪄 GPT Image 2 يرسمها</b>
          <span className="block text-xs text-white/90">كل {unit} لوحة فنية مرسومة، أجمل بكثير{what === "map" ? " (يرسمها على تصميم صادق نفسه، وتاخذ الاثنين)" : ""}. النص يصير صورة (ما ينعدل)، وقد يغلط في كلمة أحيانًا وتقدر تعيد رسمها. <Coined text={price(quality === "medium" ? "medium" : "high")} />.</span>
        </button>
      </div>
      {value && (
        <Choice
          label="جودة الرسم"
          value={quality}
          options={[
            { id: "high", label: `عالية${free ? "" : ` (${coinStr(perUnit.high)})`}` },
            { id: "medium", label: `متوسطة${free ? "" : ` (${coinStr(perUnit.medium)})`}` },
          ]}
          onChange={(q) => onChange(true, q)}
        />
      )}
    </div>
  );
}

export function Questions({ kind, s, set, chosen, prices, level = "" }: { kind: OutputKind; s: S; set: (patch: S) => void; chosen: OutputKind[]; prices: ProjectHook["state"]["prices"]; level?: string }) {
  // the level of each output (the owner's words): light, medium, deep, deepest — instead of a school level for the whole material
  const density = <Choice label="المستوى" value={String(s.density)} options={LEVEL_OPTIONS} onChange={(density) => set({ density })} />;
  const pages = PICTURE_KINDS.includes(kind) && (
    <>
      <MethodChoice what="page" value={Boolean(s.pictures)} quality={String(s.pictures || "high")} perUnit={prices.page} free={prices.free} onChange={(draw, q) => set({ pictures: draw ? q : "" })} />
      {/* the number of pages drawn is the number chosen above; with none chosen nothing is drawn by itself */}
      {s.pictures && !chosenPages(kind, s) && (
        <p className="rounded-xl border border-jw-warn/40 bg-jw-warn/10 p-3 text-sm" role="note">
          ⚠️ ما حدّدت عدد الصفحات. {COUNTED_KINDS.includes(kind) ? "اختر الرقم فوق وبيُرسم بالضبط" : "هذا الناتج ما له عدد صفحات تختاره"} — وبدونه ما يبدأ الرسم وحده: تضغط «ارسمها الآن» تحت الناتج، ويقول لك كم صفحة بتنرسم وكم تكلّف قبل ما توافق.
        </p>
      )}
    </>
  );
  // the written files: how many pages (kept exactly), the paper size and the file type (PDF / Word)
  const paged = isPaged(kind) && (
    <>
      {!(kind === "book" && s.writing === "verbatim") && <Count label="كم صفحة تبي؟" value={Number(s.pages) || 0} options={[1, 2, 5, 10, 20]} max={MAX_PAGES} unit="صفحة" onChange={(n) => set({ pages: n })} />}
      <Choice label="المقاس" value={String(s.page)} options={[{ id: "A4", label: "A4" }, { id: "A5", label: "A5 (صغير)" }]} onChange={(page) => set({ page })} />
      <Choice label="صيغة الملف" value={String(s.format ?? "pdf")} options={FORMATS.map((f) => ({ id: f.id, label: f.label }))} onChange={(format) => set({ format })} />
    </>
  );
  switch (kind) {
    case "summary":
    case "explain":
    case "preread":
      return (
        <>
          {density}
          {paged}
          {pages}
        </>
      );
    case "book":
      return (
        <>
          <Choice label="نوع الكتاب" value={String(s.writing)} options={[{ id: "explain", label: "كتاب شرح" }, { id: "summary", label: "كتاب ملخص" }, { id: "verbatim", label: "النص كامل كما هو" }]} onChange={(writing) => set({ writing })} />
          {s.writing !== "verbatim" && density}
          {paged}
          {pages}
        </>
      );
    case "slides":
      return (
        <>
          {density}
          <Count label="كم شريحة؟" value={Number(s.count) || 0} options={[8, 12, 20]} max={200} unit="شريحة" onChange={(count) => set({ count })} />
          <Choice label="الشرح وين؟" value={String(s.notesMode)} options={[{ id: "slide", label: "على الشريحة" }, { id: "notes", label: "في ملاحظات المحاضر" }, { id: "both", label: "الاثنين" }]} onChange={(notesMode) => set({ notesMode })} />
          <Choice label="الشكل" value={String(s.aspect)} options={[{ id: "16:9", label: "عريض 16:9" }, { id: "4:3", label: "4:3" }]} onChange={(aspect) => set({ aspect })} />
          <MethodChoice what="slide" value={s.render === "image"} quality={String(s.imageQuality || "high")} perUnit={prices.slide} free={prices.free} onChange={(draw, q) => set({ render: draw ? "image" : "editable", imageQuality: q })} />
        </>
      );
    case "audio": {
      const texts = chosen.filter((k) => k === "summary" || k === "explain" || k === "preread" || k === "book");
      return (
        <>
          <Choice label="وش يقرأ؟" value={String(s.source)} options={[{ id: "text", label: "المادة كاملة" }, ...texts.map((k) => ({ id: k, label: OUTPUT_KINDS.find((o) => o.kind === k)!.name }))]} onChange={(source) => set({ source })} />
          <Choice label="الملفات" value={String(s.mode)} options={[{ id: "single", label: "ملف واحد" }, { id: "multi", label: "ملف لكل قسم" }]} onChange={(mode) => set({ mode })} />
        </>
      );
    }
    case "quiz": {
      const types = (s.types as string[]) ?? [];
      const TYPES = [
        { id: "mcq", label: "اختيار متعدد" },
        { id: "tf", label: "صح وخطأ" },
        { id: "short", label: "قصيرة" },
        { id: "essay", label: "مقالية" },
      ];
      return (
        <>
          <Choice label="كم سؤال؟" value={Number(s.count)} options={[5, 10, 20, 30].map((n) => ({ id: n, label: n.toLocaleString("ar") }))} onChange={(count) => set({ count })} />
          <Choice label="المستوى" value={String(s.difficulty)} options={[{ id: "easy", label: "خفيف (سهل)" }, { id: "medium", label: "متوسط" }, { id: "hard", label: "عميق (صعب)" }]} onChange={(difficulty) => set({ difficulty })} />
          <div className="space-y-1">
            <span className="text-sm font-semibold">أنواع الأسئلة</span>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => {
                const on = types.includes(t.id);
                return (
                  <button key={t.id} type="button" aria-pressed={on} onClick={() => set({ types: on ? (types.length > 1 ? types.filter((x) => x !== t.id) : types) : [...types, t.id] })} className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-transparent bg-violet-600 text-white" : "border-jw-line bg-white"}`}>
                    {on ? "✓ " : ""}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <Choice label="كيف تستخدمه؟" value={String(s.usage)} options={[{ id: "interactive", label: "أحل هنا" }, { id: "sheet", label: "ورقة أطبعها" }, { id: "both", label: "الاثنين" }]} onChange={(usage) => set({ usage })} />
          {pages}
        </>
      );
    }
    case "mindmap":
      return (
        <>
          <Choice label="نوع الخريطة" value={String(s.mapType ?? "auto")} options={[{ id: "auto", label: "صادق يختار حسب المادة" }, ...MAP_TYPES.map((t) => ({ id: t.id, label: t.name }))]} onChange={(mapType) => set({ mapType })} />
          <p className="text-[11px] text-jw-faint">{s.mapType && s.mapType !== "auto" ? MAP_TYPES.find((t) => t.id === s.mapType)?.hint : "يختار الشكل اللي يناسب كل جزء: شعاعية للحفظ، شجرية للتصنيف، مفاهيمية للعلاقات، تسلسلية للخطوات."}</p>
          <Choice label="كم خريطة؟" value={String(s.scope ?? "one")} options={[{ id: "one", label: "خريطة وحدة للمادة كلها" }, { id: "sections", label: "خريطة شاملة + خريطة لكل قسم" }]} onChange={(scope) => set({ scope })} />
          <p className="text-[11px] text-jw-faint">الدرجة حسب مستواك ({MAP_GRADES[gradeOf(level)].name}): {MAP_GRADES[gradeOf(level)].says}.</p>
          <MethodChoice what="map" value={s.render === "image"} quality={String(s.imageQuality || "high")} perUnit={prices.map} free={prices.free} onChange={(draw, q) => set({ render: draw ? "image" : "editable", imageQuality: q })} />
          <button type="button" role="switch" aria-checked={s.recall !== false} onClick={() => set({ recall: s.recall === false })} className={`w-full rounded-2xl border p-3 text-start ${s.recall !== false ? "border-transparent bg-emerald-50 ring-4 ring-emerald-200" : "border-jw-line bg-white"}`}>
            <b className="block">{s.recall !== false ? "✓ " : ""}🧠 نسخة التسميع (أقوى طريقة للحفظ)</b>
            <span className="block text-xs text-jw-muted">نفس الخريطة بفروع فاضية: تملاها من ذاكرتك وتقارن بالأصل، وتعيدها بعد يوم وأسبوع وشهر. مجانية.</span>
          </button>
        </>
      );
    case "chat":
      return <p className="text-sm text-jw-muted">ما يحتاج إعدادات: تنفتح لك محادثة مع صادق على مادتك، تناقشه فيها وتسأله، ويبحث لك لو طلبت.</p>;
    default:
      return <p className="text-sm text-jw-muted">ما يحتاج أسئلة: المادة كاملة كما قرأها صادق، PDF ونص.</p>;
  }
}

/** «التصميم»: the student decides how it looks (a style, their ideas, fonts, a page frame), or skips and صادق picks. */
export function DesignStep({ wish, set }: { wish: DesignWish; set: (w: DesignWish) => void }) {
  const [fonts, setFonts] = useState(Boolean(wish.heading || wish.body));
  const patch = (x: Partial<DesignWish>) => set({ ...wish, ...x });
  return (
    <div className="space-y-4">
      <style>{fontFacesUrl(FONTS)}</style>
      <div className="space-y-2">
        <span className="text-sm font-semibold">الأسلوب</span>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="الأسلوب">
          <button type="button" role="radio" aria-checked={!wish.style} onClick={() => patch({ style: "" })} className={`rounded-2xl border bg-white p-3 text-start ${!wish.style ? "border-transparent ring-4 ring-violet-300" : "border-jw-line"}`}>
            <b className="flex items-center gap-1"><RobotFace id="sadiq" size={20} /> صادق يختار</b>
            <span className="block text-xs text-jw-muted">يختار الأنسب لمادتك وعمرك، ويطبّق أفكارك اللي تكتبها تحت.</span>
          </button>
          {STYLES.map((st) => (
            <button key={st.id} type="button" role="radio" aria-checked={wish.style === st.id} onClick={() => patch({ style: st.id })} className={`overflow-hidden rounded-2xl border text-start ${wish.style === st.id ? "border-transparent ring-4 ring-violet-300" : "border-jw-line"}`} style={{ background: st.colors.paper, color: st.colors.ink }}>
              <span className="flex h-3" aria-hidden>
                {[st.colors.accent, st.colors.accent2, st.colors.line, st.colors.bg].map((c) => (
                  <span key={c} className="flex-1" style={{ background: c }} />
                ))}
              </span>
              <span className="block p-3">
                <b className="block" style={{ color: st.colors.accent }}>{st.name}</b>
                <span className="block text-xs" style={{ color: st.colors.muted }}>{st.suits}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">أفكارك للتصميم (اختياري) — يطبّقها صادق كما هي</span>
        <textarea className="jw-textarea" rows={3} value={wish.ideas} onChange={(e) => patch({ ideas: e.target.value })} placeholder="مثال: ألوان كحلي وذهبي، عناوين كبيرة، جدول في كل فصل، صورة في بداية كل فصل، شكل رسمي للتقديم…" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" role="switch" aria-checked={wish.frame} onClick={() => patch({ frame: !wish.frame })} className={`rounded-full border px-3 py-1.5 text-sm ${wish.frame ? "border-transparent bg-violet-600 text-white" : "border-jw-line bg-white"}`}>
          {wish.frame ? "✓ " : ""}إطار حول كل صفحة
        </button>
        <button type="button" aria-expanded={fonts} onClick={() => { if (fonts) patch({ heading: "", body: "" }); setFonts(!fonts); }} className={`rounded-full border px-3 py-1.5 text-sm ${fonts ? "border-transparent bg-violet-600 text-white" : "border-jw-line bg-white"}`}>
          {fonts ? "✓ " : ""}أختار الخطوط بنفسي
        </button>
      </div>
      {fonts && (
        <div className="grid gap-3 sm:grid-cols-2">
          {([["heading", "خط العناوين"], ["body", "خط المتن"]] as const).map(([k, label]) => (
            <div key={k} className="space-y-1">
              <span className="text-sm font-semibold">{label}</span>
              <div className="flex flex-wrap gap-2">
                {FONTS.map((f) => (
                  <button key={f.id} type="button" aria-pressed={wish[k] === f.id} onClick={() => patch({ [k]: wish[k] === f.id ? "" : f.id })} title={f.role} className={`rounded-xl border px-3 py-1.5 text-base ${wish[k] === f.id ? "border-transparent bg-violet-600 text-white" : "border-jw-line bg-white"}`} style={{ fontFamily: `"${f.family}"` }}>
                    {k === "heading" ? "عنوان" : "متن"} · {f.label.replace(/ \(.+\)$/, "")}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

