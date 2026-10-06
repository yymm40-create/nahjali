"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FONT_BY_ID, FONT_KINDS, FONT_LIST, type FontKind } from "@/lib/editor/fonts";
import Icon from "../Icon";
import { familyOf, loadFont } from "./fontload";
import { familyFor } from "./render";

const OWN = [
  { id: "readex", ar: "حديث (ريدكس)" },
  { id: "naskh", ar: "نسخ" },
  { id: "kufi", ar: "كوفي" },
];
const SAMPLE = "خط عربي جميل";

export const fontName = (id: string) => OWN.find((f) => f.id === id)?.ar ?? FONT_BY_ID.get(id)?.ar ?? id;

/** One font, its name written in itself (its file is fetched when the row comes into view). */
function Row({ id, label, sub, on, disabled, onPick }: { id: string; label: string; sub?: string; on: boolean; disabled: boolean; onPick: () => void }) {
  const el = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(!FONT_BY_ID.has(id));
  useEffect(() => {
    if (ready || !el.current) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          io.disconnect();
          void loadFont(id, 700).then((ok) => ok && setReady(true));
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(el.current);
    return () => io.disconnect();
  }, [id, ready]);
  return (
    <button ref={el} type="button" role="option" aria-selected={on} disabled={disabled} onClick={onPick} className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-start ${on ? "border-jw-accent bg-jw-accent/10" : "border-transparent hover:bg-jw-surface-2"}`}>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg leading-8" style={{ fontFamily: ready ? familyFor(id) : undefined, opacity: ready ? 1 : 0.35 }}>
          {SAMPLE}
        </span>
        <span className="block truncate text-[10px] text-jw-muted">
          {label}
          {sub && <span dir="ltr"> · {sub}</span>}
        </span>
      </span>
      {on && <Icon name="check" size={14} className="text-jw-accent" />}
    </button>
  );
}

/** «الخط»: the page's three fonts and the catalogue's 100, by style or by name. */
export default function FontPicker({ value, onPick, disabled }: { value: string; onPick: (id: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FontKind | "all">("all");
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return FONT_LIST.filter((f) => (kind === "all" || f.kind === kind) && (!s || f.ar.includes(q.trim()) || f.family.toLowerCase().includes(s)));
  }, [kind, q]);
  // the picked font is shown in itself on the button
  useEffect(() => {
    if (FONT_BY_ID.has(value)) void loadFont(value, 700);
  }, [value]);
  return (
    <div className="space-y-1.5">
      <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 rounded-lg border border-jw-line px-2.5 py-1.5 text-start hover:border-jw-line-strong">
        <span className="text-xs text-jw-muted">الخط</span>
        <span className="min-w-0 flex-1 truncate text-base" style={{ fontFamily: FONT_BY_ID.has(value) ? `"${familyOf(value)}", inherit` : familyFor(value) }}>
          {fontName(value)}
        </span>
        <span className="text-[10px] text-jw-faint">{FONT_LIST.length + OWN.length} خط</span>
        <Icon name={open ? "chevronUp" : "chevronDown"} size={14} />
      </button>
      {open && (
        <div className="space-y-2 rounded-xl border border-jw-line bg-jw-surface p-2">
          <input className="jw-input !min-h-9 w-full text-sm" placeholder="ابحث باسم الخط…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex flex-wrap gap-1">
            {(["all", ...Object.keys(FONT_KINDS)] as (FontKind | "all")[]).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`jw-chip !px-2 !py-0.5 !text-[11px] ${kind === k ? "!border-jw-accent !text-jw-ink" : ""}`}>
                {k === "all" ? "الكل" : FONT_KINDS[k]}
              </button>
            ))}
          </div>
          <div role="listbox" aria-label="الخطوط" className="jw-scroll max-h-72 space-y-0.5 overflow-y-auto">
            {kind === "all" && !q && OWN.map((f) => <Row key={f.id} id={f.id} label={f.ar} on={value === f.id} disabled={disabled} onPick={() => onPick(f.id)} />)}
            {list.map((f) => (
              <Row key={f.id} id={f.id} label={f.ar} sub={f.family} on={value === f.id} disabled={disabled} onPick={() => onPick(f.id)} />
            ))}
            {!list.length && <p className="p-2 text-center text-xs text-jw-muted">ما لقينا خط بهالاسم.</p>}
          </div>
          <details className="text-[10px] leading-4 text-jw-faint">
            <summary className="cursor-pointer">حقوق الخطوط</summary>
            كل الخطوط برخص مفتوحة (أغلبها SIL OFL 1.1)، لأصحابها: {FONT_LIST.map((f) => `${f.family} (${f.license})`).join("، ")}.
          </details>
        </div>
      )}
    </div>
  );
}
