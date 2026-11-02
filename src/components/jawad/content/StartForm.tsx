"use client";

// «صانع المحتوى» — the start form (the owner's order: «يختار خيارات جاهزة ويكتب نصوصه، وتنرسل كلها برسالة وحدة»):
// the kind of work, ready choices for it as buttons, boxes for the topic and the person's own text, and the files.
// «ابدأ» sends ONE message (lib/content/brief.ts) and «محمد باقر» asks at most one batch about what is still missing,
// then makes it. The carousel's style is «اختر لي الأنسب» unless the person opens the table of 100.

import { useState } from "react";
import { BRIEF_KINDS, briefMessage, briefMissing, type BriefKind } from "@/lib/content/brief";
import { carouselLine } from "@/lib/content/marks";
import CarouselTable, { type CarouselItem } from "./CarouselTable";

export interface StartFormProps {
  kind: BriefKind;
  persona: string;
  disabled: boolean;
  /** files attached in the box below go with the message */
  files: number;
  table: { items: CarouselItem[]; niches: string[] } | null;
  onNeedTable: () => void;
  onAttach: () => void;
  onBack: () => void;
  onSend: (message: string) => void;
}

export default function StartForm({ kind, persona, disabled, files, table, onNeedTable, onAttach, onBack, onSend }: StartFormProps) {
  const def = BRIEF_KINDS[kind];
  const [picked, setPicked] = useState<Record<string, string[]>>(() => Object.fromEntries(def.fields.filter((f) => f.default).map((f) => [f.label, [f.default!]])));
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [style, setStyle] = useState<{ id: string; name: string } | null>(null);
  const [openTable, setOpenTable] = useState(false);

  const toggle = (label: string, o: string, multi: boolean) =>
    setPicked((p) => {
      const cur = p[label] ?? [];
      return { ...p, [label]: cur.includes(o) ? cur.filter((x) => x !== o) : multi ? [...cur, o] : [o] };
    });
  const missing = briefMissing(kind, { picked, topic, text, files });
  const send = () => {
    if (missing) return;
    onSend(briefMessage(kind, { picked, topic, text, notes, style: style ? carouselLine(style) : null }));
  };

  return (
    <div className="ct-msg bot ct-brief">
      <h3>{def.icon} {def.title}</h3>
      <p className="muted">اختر من الأزرار واكتب نصك، وكلها تروح لـ{persona} برسالة وحدة. اللي ما تختاره يختاره هو لك. وبعدها يسألك مرة وحدة بس عن اللي ناقص، ويبدأ الشغل.</p>

      <div className="ct-q">
        <b>الموضوع أو الفكرة{def.topicRequired ? " *" : ""}</b>
        <textarea className="ct-inline ct-brief-box" dir="auto" rows={2} maxLength={2000} value={topic} placeholder={def.topicHint} onChange={(e) => setTopic(e.target.value)} />
      </div>

      {def.fields.map((f) => (
        <div key={f.label} className="ct-q">
          <b>{f.title ?? f.label}{f.required ? " *" : ""}{f.multi ? " (يجوز أكثر من خيار)" : ""}</b>
          {f.hint && <p className="muted" style={{ margin: "4px 0 0" }}>{f.hint}</p>}
          <div className="ct-opts">
            {f.options.map((o) => (
              <button key={o} type="button" className="ct-opt" aria-pressed={(picked[f.label] ?? []).includes(o)} disabled={disabled} onClick={() => toggle(f.label, o, !!f.multi)}>
                {o}
              </button>
            ))}
          </div>
          {f.attach && (picked[f.label] ?? []).includes(f.attach) && (
            <div className="ct-opts">
              <button type="button" className="ct-opt ct-opt-write" disabled={disabled} onClick={onAttach}>📎 أرفق صورك الآن{files ? ` (${files} مرفق)` : ""}</button>
            </div>
          )}
        </div>
      ))}

      {kind === "carousel" && (
        <div className="ct-q">
          <b>شكل الكاروسيل</b>
          <div className="ct-opts">
            <button type="button" className="ct-opt" aria-pressed={!style && !openTable} disabled={disabled} onClick={() => { setStyle(null); setOpenTable(false); }}>🎲 {persona} يختار الأنسب (أسرع)</button>
            <button type="button" className="ct-opt" aria-pressed={openTable || !!style} disabled={disabled} onClick={() => { setOpenTable((v) => !v); onNeedTable(); }}>📋 {openTable ? "أغلق الجدول" : "أختار من جدول الستايلات"}</button>
            {style && <span className="ct-chip ct-picked">✓ {style.name} <button type="button" aria-label="ألغِ" onClick={() => setStyle(null)}>✕</button></span>}
          </div>
          {openTable &&
            (table ? (
              <CarouselTable
                items={table.items}
                niches={table.niches}
                disabled={disabled}
                onPick={(i) => { setStyle({ id: i.id, name: i.name }); setOpenTable(false); }}
                onHelp={() => { setStyle(null); setOpenTable(false); }}
                onOwn={(what) => { setNotes((n) => [n, `الشكل اللي أبيه: ${what}`].filter(Boolean).join("\n")); setStyle(null); setOpenTable(false); }}
              />
            ) : (
              <p className="muted">جاري تحميل الجدول…</p>
            ))}
        </div>
      )}

      <div className="ct-q">
        <b>{def.textTitle} (اختياري)</b>
        <textarea className="ct-inline ct-brief-box" dir="auto" rows={4} maxLength={6000} value={text} placeholder={def.textHint} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="ct-q">
        <b>ملاحظات أو أي شي ثاني (اختياري)</b>
        <textarea className="ct-inline ct-brief-box" dir="auto" rows={2} maxLength={1500} value={notes} placeholder="مثل: لا تذكر الأسعار، ركّز على الأمهات، أبي الخط عريض…" onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="ct-actions">
        <button type="button" className="ct-send" style={{ height: 44, minWidth: 0, padding: "0 22px" }} disabled={disabled || !!missing} onClick={send}>ابدأ ✅</button>
        <button type="button" className="ct-opt ct-opt-write" disabled={disabled} onClick={onAttach}>📎 أرفق ملفات{files ? ` (${files})` : ""}</button>
        <button type="button" className="ct-opt" disabled={disabled} onClick={onBack}>رجوع</button>
      </div>
      {missing && <p className="muted" style={{ marginTop: 6 }}>⬆️ {missing}</p>}
    </div>
  );
}
