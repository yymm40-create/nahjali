"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GeneratorDef, RefKind } from "@config/jawad/types";
import { promptAdvice, type Evaluation } from "@/lib/jawad/engine";
import { findMentions, looksLikeRef, sameName } from "@/lib/jawad/mentions";
import Icon from "../Icon";
import type { RefItem } from "./types";

const KIND_AR: Record<RefKind, string> = { image: "صورة", video: "فيديو", audio: "صوت" };
const NAME_CHAR = /[\p{L}\p{N}_-]/u;
const MENU_W = 248;

/** The «@query» being typed at the caret (start = the @), or null. */
function activeMention(text: string, caret: number) {
  let i = caret;
  while (i > 0 && NAME_CHAR.test(text[i - 1])) i--;
  if (i === 0 || text[i - 1] !== "@") return null;
  const at = i - 1;
  const before = at > 0 ? text[at - 1] : "";
  if (before && (NAME_CHAR.test(before) || before === "@")) return null;
  return { start: at, query: text.slice(i, caret) };
}

// Styles copied to an invisible twin of the text area to find where the caret is on screen
const MIRROR = ["box-sizing", "width", "padding-top", "padding-right", "padding-bottom", "padding-left", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "font-family", "font-size", "font-weight", "font-style", "letter-spacing", "line-height", "text-transform", "word-spacing", "text-indent", "direction", "text-align", "tab-size", "scrollbar-gutter"];
function caretPoint(el: HTMLTextAreaElement, pos: number) {
  const cs = getComputedStyle(el);
  const div = document.createElement("div");
  for (const p of MIRROR) div.style.setProperty(p, cs.getPropertyValue(p));
  Object.assign(div.style, { position: "absolute", visibility: "hidden", whiteSpace: "pre-wrap", overflowWrap: "break-word", overflow: "hidden", top: "0", left: "-9999px" });
  div.textContent = el.value.slice(0, pos);
  const span = document.createElement("span");
  span.textContent = ".";
  div.appendChild(span);
  document.body.appendChild(div);
  const rtl = cs.direction === "rtl";
  const x = rtl ? span.offsetLeft + span.offsetWidth : span.offsetLeft;
  const y = span.offsetTop - el.scrollTop;
  document.body.removeChild(div);
  return { x, y, rtl, line: parseFloat(cs.lineHeight) || 24 };
}

function RefChip({ r, size = 20 }: { r: RefItem; size?: number }) {
  return r.url && r.kind === "image" ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={r.url} alt="" className="shrink-0 rounded object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded bg-jw-surface-3 text-jw-accent" style={{ width: size, height: size }}>
      <Icon name={r.kind} size={Math.round(size * 0.6)} />
    </span>
  );
}

/**
 * The prompt, exactly as the user writes it (never translated or extended). Typing «@» lists the added references
 * and inserts the chosen one's name; mentions are lit in the text and shown under it with their reference.
 * For speech, the spoken text and the performance description are two separate fields, sent separately.
 */
export default function PromptBox({
  def,
  ev,
  prompt,
  instructions,
  refs,
  onPrompt,
  onInstructions,
  touched,
  onTouched,
}: {
  def: GeneratorDef;
  ev: Evaluation;
  prompt: string;
  instructions: string;
  /** The added references (their «@names» can be mentioned). */
  refs: RefItem[];
  onPrompt: (s: string) => void;
  onInstructions: (s: string) => void;
  /** "Write the prompt" is only shown once the field was used (never as an error on a fresh page). */
  touched: boolean;
  onTouched: () => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ start: number; query: string; left: number; top: number } | null>(null);
  const [active, setActive] = useState(0);
  // Where the caret goes after a chosen name is written (set in the same commit, before the next key press)
  const caretTo = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = area.current;
    const pos = caretTo.current;
    if (!el || pos == null) return;
    caretTo.current = null;
    el.focus();
    el.setSelectionRange(pos, pos);
  });

  const promptIssue = touched || prompt ? ev.issues.find((i) => i.field === "prompt")?.message : undefined;
  const instrIssue = ev.issues.find((i) => i.field === "instructions")?.message;
  const optional = !ev.mode.promptRequired;
  const advice = promptAdvice(def, prompt);
  // References can be mentioned only where the generator takes them
  const canMention = Boolean(def.refLabel) && ev.refStyles.length > 0;

  const mentions = useMemo(() => (canMention ? findMentions(prompt) : []), [canMention, prompt]);
  const refOf = (name: string) => refs.find((r) => sameName(r.name, name));
  const used = refs.filter((r) => mentions.some((m) => sameName(m.name, r.name)));
  // Not a reference and not obviously meant as one (those block sending, see the engine): sent as plain text
  const strays = [...new Set(mentions.filter((m) => !refOf(m.name) && !looksLikeRef(m.name)).map((m) => m.name))];

  const options = menu ? refs.filter((r) => r.name.toLocaleLowerCase().includes(menu.query.toLocaleLowerCase())) : [];

  function update(el: HTMLTextAreaElement) {
    if (!canMention) return;
    const caret = el.selectionStart;
    const m = el.selectionStart === el.selectionEnd ? activeMention(el.value, caret) : null;
    if (!m) return setMenu(null);
    const p = caretPoint(el, m.start);
    const width = el.clientWidth;
    const left = Math.max(0, Math.min(width - MENU_W, p.rtl ? p.x - MENU_W : p.x));
    if (!menu || menu.query !== m.query) setActive(0);
    setMenu({ start: m.start, query: m.query, left, top: p.y + p.line + 4 });
  }

  function choose(r: RefItem) {
    const el = area.current;
    if (!el || !menu) return;
    const caret = el.selectionStart;
    const insert = `@${r.name} `;
    const next = prompt.slice(0, menu.start) + insert + prompt.slice(caret).replace(/^ /, "");
    caretTo.current = menu.start + insert.length;
    onPrompt(next);
    setMenu(null);
  }

  // The text with its mentions lit, drawn exactly under the (transparent) text area
  const lit = useMemo(() => {
    const out: React.ReactNode[] = [];
    let at = 0;
    for (const m of mentions) {
      if (m.start > at) out.push(prompt.slice(at, m.start));
      const known = refs.some((r) => sameName(r.name, m.name));
      out.push(
        <mark key={m.start} className={`rounded-[4px] text-transparent ${known ? "bg-jw-accent/30" : looksLikeRef(m.name) ? "bg-jw-danger/30" : "bg-jw-warn/20"}`}>
          {prompt.slice(m.start, m.end)}
        </mark>,
      );
      at = m.end;
    }
    out.push(prompt.slice(at));
    return out;
  }, [mentions, prompt, refs]);

  return (
    <section className="space-y-3">
      <div>
        <label htmlFor="jw-prompt" className="jw-label flex items-center justify-between">
          <span>
            {def.prompt.label} {optional && <span className="text-jw-faint">(اختياري مع المراجع)</span>}
          </span>
          <span className={`tabular-nums ${prompt.length > def.prompt.max ? "text-jw-danger" : "text-jw-faint"}`} dir="ltr">{prompt.length}/{def.prompt.max}</span>
        </label>
        <div className="relative">
          {canMention && (
            <div ref={backdrop} aria-hidden dir="auto" className="jw-textarea pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-transparent [scrollbar-gutter:stable]">
              {lit}
              {"\n"}
            </div>
          )}
          <textarea
            ref={area}
            id="jw-prompt"
            dir="auto"
            rows={5}
            value={prompt}
            onChange={(e) => {
              onPrompt(e.target.value);
              update(e.target);
            }}
            onSelect={(e) => update(e.currentTarget)}
            onScroll={(e) => {
              if (backdrop.current) backdrop.current.scrollTop = e.currentTarget.scrollTop;
              if (menu) setMenu(null);
            }}
            onKeyDown={(e) => {
              if (!menu) return;
              if (e.key === "Escape") {
                e.preventDefault();
                setMenu(null);
              } else if (options.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                e.preventDefault();
                setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
              } else if (options.length && (e.key === "Enter" || e.key === "Tab")) {
                e.preventDefault();
                choose(options[Math.min(active, options.length - 1)]);
              }
            }}
            onBlur={() => {
              onTouched();
              setMenu(null);
            }}
            placeholder={def.prompt.placeholder}
            className={`jw-textarea relative block min-h-[132px] ${canMention ? "!bg-transparent [scrollbar-gutter:stable]" : ""} ${promptIssue ? "jw-invalid" : ""}`}
            aria-invalid={Boolean(promptIssue)}
            aria-describedby={promptIssue ? "jw-prompt-issue" : undefined}
            aria-autocomplete={canMention ? "list" : undefined}
            aria-controls={menu ? "jw-mention-list" : undefined}
            aria-activedescendant={menu && options.length ? `jw-mention-${Math.min(active, options.length - 1)}` : undefined}
          />
          {menu && (
            <div className="jw-panel absolute z-30 p-1 shadow-2xl shadow-black/60" style={{ left: menu.left, top: menu.top, width: MENU_W }}>
              {options.length ? (
                <ul id="jw-mention-list" role="listbox" aria-label="المراجع" className="jw-scroll max-h-56 overflow-y-auto">
                  {options.map((r, i) => (
                    <li
                      key={r.localId}
                      id={`jw-mention-${i}`}
                      role="option"
                      aria-selected={i === Math.min(active, options.length - 1)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        choose(r);
                      }}
                      onMouseEnter={() => setActive(i)}
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${i === Math.min(active, options.length - 1) ? "bg-jw-accent-soft" : ""}`}
                    >
                      <RefChip r={r} size={26} />
                      <span className="min-w-0 flex-1 truncate" dir="ltr" style={{ textAlign: "right" }}>@{r.name}</span>
                      <span className="text-[11px] text-jw-muted">{KIND_AR[r.kind]}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-2 py-2 text-xs text-jw-muted">{refs.length ? "لا يوجد مرجع بهذا الاسم." : "لا توجد مراجع بعد؛ أضفها من «+» في المراجع أولًا."}</p>
              )}
            </div>
          )}
        </div>
        {canMention && used.length > 0 && (
          // Each mentioned reference, shown with its file
          <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="المراجع المذكورة في البرومبت">
            {used.map((r) => (
              <span key={r.localId} className="flex items-center gap-1.5 rounded-full border border-jw-accent/40 bg-jw-accent-soft py-0.5 pe-2 ps-0.5 text-[11px]">
                <RefChip r={r} size={18} />
                <span dir="ltr">@{r.name}</span>
              </span>
            ))}
          </div>
        )}
        {canMention && !promptIssue && strays.length > 0 && (
          <p className="mt-1 text-[11px] text-jw-warn">
            {strays.map((n) => `«@${n}»`).join("، ")} ليس اسم مرجع مضاف؛ سيُرسل كنص عادي.
          </p>
        )}
        {canMention && refs.length > 0 && used.length === 0 && !promptIssue && (
          <p className="mt-1 text-[11px] text-jw-faint">اكتب ‎@ لتختار مرجعًا وتذكره في البرومبت؛ هذا يقلل أخطاء المولد.</p>
        )}
        {!def.prompt.arabic && def.prompt.arabicNote && !promptIssue && <p className="mt-1 text-[11px] text-jw-faint">{def.prompt.arabicNote}</p>}
        {advice && <p className="mt-1 text-[11px] text-jw-warn">{advice}</p>}
        {promptIssue && <p id="jw-prompt-issue" className="mt-1.5 text-xs text-jw-danger" role="alert">{promptIssue}</p>}
      </div>
      {def.extraText && (
        <div>
          <label htmlFor="jw-instr" className="jw-label flex items-center justify-between">
            <span>{def.extraText.label}</span>
            <span className="tabular-nums text-jw-faint" dir="ltr">{instructions.length}/{def.extraText.max}</span>
          </label>
          <textarea
            id="jw-instr"
            dir="auto"
            rows={2}
            value={instructions}
            onChange={(e) => onInstructions(e.target.value)}
            placeholder={def.extraText.placeholder}
            className={`jw-textarea ${instrIssue ? "jw-invalid" : ""}`}
          />
          <p className="mt-1 text-[11px] text-jw-faint">يُرسل منفصلًا عن النص المنطوق، ولا يُقرأ بصوت.</p>
          {instrIssue && <p className="mt-1.5 text-xs text-jw-danger" role="alert">{instrIssue}</p>}
        </div>
      )}
    </section>
  );
}
