"use client";

import { useMemo } from "react";
import { FONTS, FONTS_CHECKED, STYLES, STYLE_ROLES, defaultDesign, fontById, styleById, type Design, type StyleId, type StyleRole } from "@config/jawad/student";
import { sampleHtml } from "@/lib/jawad/student/render/html";
import { fontFacesUrl } from "./client";

/** A live preview: the same HTML and CSS the PDF is printed from, with the chosen fonts. */
export function DesignPreview({ design, sample, height = 260 }: { design: Design; sample: string; height?: number }) {
  const html = useMemo(() => {
    const ids = [design.fonts.heading, design.fonts.body, design.fonts.accent];
    return sampleHtml(design, fontFacesUrl([...new Set(ids)].map((id) => fontById(id))), sample);
  }, [design, sample]);
  return <iframe title="معاينة التصميم" srcDoc={html} className="w-full rounded-lg border border-jw-line bg-white" style={{ height }} sandbox="" />;
}

export default function DesignPicker({ value, onChange, kind, sample }: { value: Design | undefined; onChange: (d: Design) => void; kind: "book" | "slides" | "doc"; sample: string }) {
  const d = value ?? defaultDesign(kind === "slides" ? "bento" : "notebook");
  const set = (patch: Partial<Design>) => onChange({ ...d, ...patch });
  const extra = Object.entries(d.roles) as [StyleRole, StyleId][];

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-sm font-semibold">الأسلوب الأساسي</h4>
        <div className="grid gap-3 md:grid-cols-2">
          {STYLES.map((s) => {
            const on = d.main === s.id && !d.custom;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ main: s.id, roles: d.roles, fonts: { ...s.pair }, custom: null })}
                className={`space-y-2 rounded-xl border p-3 text-start ${on ? "border-jw-accent bg-jw-accent-soft" : "border-jw-line hover:bg-jw-surface-2"}`}
              >
                <b className="block">
                  {s.letter} — {s.name} <span className="text-xs font-normal text-jw-faint" dir="ltr">{s.en}</span>
                </b>
                <span className="block text-xs text-jw-muted">{s.idea}</span>
                <span className="block text-xs text-jw-faint">{kind === "slides" ? s.inSlides : s.inPdf}</span>
                <span className="block text-xs text-jw-faint">يناسب: {s.suits}</span>
                <span className="flex gap-1" aria-hidden>
                  {Object.values(s.colors).slice(0, 6).map((c, i) => (
                    <span key={i} className="size-4 rounded-full border border-black/10" style={{ background: c }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">المزج بين الأساليب (اختياري)</h4>
          <p className="text-xs text-jw-muted">الأسلوب الأساسي يلبس الصفحات، ولكل وظيفة أدناه يمكن تعيين أسلوب آخر — مثال: الدفتر للمتن والهوامش، والبطاقات لصفحات المقارنة فقط.</p>
          {STYLE_ROLES.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-sm">
              <span className="w-44 shrink-0">{r.label}</span>
              <select
                className="jw-select"
                value={d.roles[r.id] ?? ""}
                onChange={(e) => {
                  const roles = { ...d.roles };
                  if (e.target.value) roles[r.id] = e.target.value as StyleId;
                  else delete roles[r.id];
                  set({ roles });
                }}
              >
                <option value="">نفس الأساسي ({styleById(d.main).name})</option>
                {STYLES.filter((s) => s.id !== d.main).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {extra.length > 0 && <p className="text-xs text-jw-faint">المزيج: {styleById(d.main).name} أساسي، {extra.map(([r, s]) => `${styleById(s).name} لـ${STYLE_ROLES.find((x) => x.id === r)?.label}`).join("، ")}.</p>}

          <h4 className="pt-2 text-sm font-semibold">الخطوط (خطان على الأقل، لكل خط دور)</h4>
          {(
            [
              ["heading", "العناوين"],
              ["body", "المتن"],
              ["accent", "الاقتباس والهوامش والنص المشكول"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <span className="w-44 shrink-0">{label}</span>
              <select className="jw-select" value={d.fonts[k]} onChange={(e) => set({ fonts: { ...d.fonts, [k]: e.target.value } })}>
                {FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label} — {f.role}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {d.fonts.heading === d.fonts.body && <p className="text-xs text-jw-warn">اختر خطًا مختلفًا للعناوين عن المتن ليتنوع التصميم بخطين.</p>}
          <p className="text-xs text-jw-faint">
            خطوط عربية حديثة برخصة مفتوحة (OFL) تسمح بتضمينها في PDF وPPTX — اختيرت ببحث في أقوى خطوط السنة ({FONTS_CHECKED}).
          </p>
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">معاينة حية على نص من مادتك</h4>
          <DesignPreview design={d} sample={sample} height={kind === "slides" ? 300 : 340} />
        </div>
      </div>
    </div>
  );
}
