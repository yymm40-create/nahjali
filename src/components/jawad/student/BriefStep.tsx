"use client";

// «الطالب الذكي» — «الطلب»: the first page again, from inside a material. The student goes back and changes the name,
// level, audience, purpose and (for a researched material) what صادق looks for and where. What comes next is made with
// the new request; outputs already made keep their text until the student makes them again.

import { useState } from "react";
import Icon from "@/components/jawad/Icon";
import { LEVELS, PURPOSES, type PurposeId } from "@config/jawad/student";
import type { ProjectHook } from "./StudentProject";
import { ErrorLine, useAsync } from "./ui";

export default function BriefStep({ p, onSaved }: { p: ProjectHook; onSaved?: () => void }) {
  const { project, outputs } = p.state;
  const known = (LEVELS as readonly string[]).includes(project.level);
  const [title, setTitle] = useState(project.title);
  const [level, setLevel] = useState(known || !project.level ? project.level || "ثانوي" : "آخر");
  const [other, setOther] = useState(known ? "" : project.level);
  const [audience, setAudience] = useState(project.audience);
  const [purpose, setPurpose] = useState<PurposeId>(project.brief.purpose);
  const [purposeNote, setPurposeNote] = useState(project.brief.purposeNote);
  const [focus, setFocus] = useState(project.brief.focus);
  const [where, setWhere] = useState(project.brief.where);
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAsync();

  return (
    <section className="jw-panel space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold">🎯 طلبك</h2>
        <p className="text-sm text-jw-muted">غيّر أي شي وصادق يمشي عليه في اللي جاي.{outputs.length ? " النواتج اللي انصنعت تقدر تعيد صنعها من «النواتج» ← «ارجع وغيّر»." : ""}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="jw-label" htmlFor="br-title">اسم المادة أو الموضوع</label>
          <input id="br-title" className="jw-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="jw-label" htmlFor="br-aud">لمن؟ (اختياري)</label>
          <input id="br-aud" className="jw-input" value={audience} onChange={(e) => setAudience(e.target.value)} />
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
      <div className="space-y-2">
        <span className="jw-label">وش غرضك منها؟</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="الغرض">
          {PURPOSES.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={purpose === x.id} onClick={() => setPurpose(x.id)} className={`rounded-2xl border p-3 text-start transition-all ${purpose === x.id ? "border-transparent bg-white ring-4 ring-violet-300" : "border-jw-line bg-white"}`}>
              <b className="block text-sm">{x.label}</b>
              <span className="block text-[11px] text-jw-muted">{x.hint}</span>
            </button>
          ))}
        </div>
        <input className="jw-input" value={purposeNote} onChange={(e) => setPurposeNote(e.target.value)} placeholder={purpose === "other" ? "اكتب غرضك" : "تفاصيل تبي صادق يعرفها (اختياري)"} aria-label="تفاصيل الغرض" />
      </div>
      {project.brief.mode !== "files" && (
        <div className="space-y-2">
          <span className="jw-label">البحث</span>
          <textarea className="jw-textarea" rows={2} value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="وش يبحث عنه صادق؟" aria-label="ما يبحث عنه صادق" />
          <textarea className="jw-textarea" rows={2} value={where} onChange={(e) => setWhere(e.target.value)} placeholder="وين يبحث؟ (اختياري) روابط أو مصادر يلتزم فيها" aria-label="وين يبحث صادق" />
          <p className="text-[11px] text-jw-faint">لتبحث من جديد بهالكلام: روح «المادة» واضغط البحث مرة ثانية.</p>
        </div>
      )}
      <ErrorLine error={error} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="jw-btn jw-btn-primary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              if (purpose === "other" && !purposeNote.trim()) throw new Error("اكتب غرضك من المادة.");
              await p.act({ action: "meta", title: title.trim(), level: level === "آخر" ? other.trim() : level, audience: audience.trim(), brief: { purpose, purposeNote: purposeNote.trim(), focus: focus.trim(), where: where.trim() } });
              setSaved(true);
              onSaved?.();
            })
          }
        >
          <Icon name="check" size={16} /> احفظ طلبي
        </button>
        {saved && !busy && <span className="text-sm text-jw-ok">✓ انحفظ</span>}
      </div>
    </section>
  );
}
