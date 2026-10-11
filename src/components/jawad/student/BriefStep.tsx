"use client";

// «الطالب الذكي» — the material's name (and, for a researched material, what صادق looks for and where), at the top of
// the material tier. No school level, audience or purpose any more (the owner's choice): each output has its own level
// (خفيف · متوسط · عميق · أعمق) and page count in «النواتج».

import { useState } from "react";
import Icon from "@/components/jawad/Icon";
import type { ProjectHook } from "./StudentProject";
import { ErrorLine, useAsync } from "./ui";

export default function BriefStep({ p, onSaved }: { p: ProjectHook; onSaved?: () => void }) {
  const { project } = p.state;
  const [title, setTitle] = useState(project.title);
  const [focus, setFocus] = useState(project.brief.focus);
  const [where, setWhere] = useState(project.brief.where);
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAsync();
  const research = project.brief.mode !== "files";
  const changed = title.trim() !== project.title || (research && (focus.trim() !== project.brief.focus || where.trim() !== project.brief.where));

  const save = () =>
    run(async () => {
      if (!title.trim()) throw new Error("اكتب اسم المادة.");
      await p.act({ action: "meta", title: title.trim(), level: project.level, audience: project.audience, brief: { ...project.brief, focus: focus.trim(), where: where.trim() } });
      setSaved(true);
      onSaved?.();
    });

  return (
    <div className="jw-panel space-y-3 p-4">
      <label className="block space-y-1">
        <span className="jw-label">📘 اسم المادة</span>
        <span className="flex gap-2">
          <input className="jw-input flex-1" value={title} onChange={(e) => (setTitle(e.target.value), setSaved(false))} placeholder="مثال: علوم — الفصل الثالث: الخلية" />
          {(changed || busy) && (
            <button type="button" className="jw-btn jw-btn-primary" disabled={busy} onClick={save}>
              <Icon name="check" size={16} /> احفظ
            </button>
          )}
        </span>
      </label>
      {research && (
        <div className="space-y-2">
          <textarea className="jw-textarea" rows={2} value={focus} onChange={(e) => (setFocus(e.target.value), setSaved(false))} placeholder="وش يبحث عنه صادق؟" aria-label="ما يبحث عنه صادق" />
          <textarea className="jw-textarea" rows={2} value={where} onChange={(e) => (setWhere(e.target.value), setSaved(false))} placeholder="وين يبحث؟ (اختياري) روابط أو مصادر يلتزم فيها" aria-label="وين يبحث صادق" />
        </div>
      )}
      {saved && !busy && <span className="text-sm text-jw-ok">✓ انحفظ</span>}
      <ErrorLine error={error} />
    </div>
  );
}
