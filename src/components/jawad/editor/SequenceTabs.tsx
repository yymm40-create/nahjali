"use client";

// «التسلسلات»: the project's timelines as tabs over the timeline (like Premiere's sequence tabs). A tap opens one,
// a double tap renames it, a right-click copies or deletes it, «+» makes a new empty one.

import { useState } from "react";
import { FIRST_SEQ, MAX_SEQS, type Timeline } from "@/lib/editor/model";
import type { Command } from "@/lib/editor/commands";
import Icon from "../Icon";
import ContextMenu, { type MenuItem } from "./ContextMenu";

export default function SequenceTabs({ tl, run, readOnly }: { tl: Timeline; run: (cmd: Command) => unknown; readOnly: boolean }) {
  const seqs = tl.seqs?.length ? tl.seqs : [{ id: FIRST_SEQ, name: "تسلسل 1", tl: null }];
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const rename = (id: string) => {
    const name = draft.trim();
    setEditing(null);
    if (name && name !== seqs.find((s) => s.id === id)?.name) run({ type: "seq_rename", id, name });
  };
  return (
    <div className="jw-scroll flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-jw-line bg-jw-surface/60 px-1.5 py-0.5" role="tablist" aria-label="التسلسلات" dir="rtl">
      {seqs.map((s) => {
        const open = !s.tl;
        return editing === s.id ? (
          <input
            key={s.id}
            autoFocus
            className="jw-input !w-36 !py-0.5 text-xs"
            value={draft}
            maxLength={40}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => rename(s.id)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") rename(s.id);
              if (e.key === "Escape") setEditing(null);
            }}
            aria-label="اسم التسلسل"
          />
        ) : (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={open}
            title={open ? "التسلسل المفتوح (ضغطتين تغيّر اسمه)" : "افتح هذا التسلسل"}
            className={`flex shrink-0 items-center gap-1 rounded-t-lg px-2.5 py-1 text-[11px] font-semibold ${open ? "bg-jw-bg-2 text-jw-ink shadow-[inset_0_-2px_0_var(--jw-accent)]" : "text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink"}`}
            onClick={() => !open && run({ type: "seq_open", id: s.id })}
            onDoubleClick={() => {
              if (readOnly) return;
              setDraft(s.name);
              setEditing(s.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (readOnly) return;
              setMenu({
                x: e.clientX,
                y: e.clientY,
                items: [
                  ...(open ? [] : [{ label: "افتحه", onClick: () => run({ type: "seq_open", id: s.id }) }]),
                  { label: "غيّر الاسم", onClick: () => { setDraft(s.name); setEditing(s.id); } },
                  { label: "نسخة منه", onClick: () => run({ type: "seq_duplicate", id: s.id }), disabled: seqs.length >= MAX_SEQS },
                  { label: "احذفه", onClick: () => confirm(`نحذف «${s.name}»؟ (تقدر تتراجع)`) && run({ type: "seq_delete", id: s.id }), disabled: seqs.length < 2, danger: true, sep: true },
                ],
              });
            }}
          >
            <Icon name="film" size={12} /> {s.name}
          </button>
        );
      })}
      {!readOnly && seqs.length < MAX_SEQS && (
        <button type="button" className="grid h-6 w-6 shrink-0 place-items-center rounded text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink" onClick={() => run({ type: "seq_new" })} title="تسلسل جديد (تايملاين ثاني بنفس المقاس)" aria-label="تسلسل جديد">
          <Icon name="plus" size={13} />
        </button>
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}
