"use client";

// «صانع المحتوى» — the projects and the conversation with «محمد باقر», in the film maker's way and paper look (the owner,
// 23 Nov 2026: «منطقة المحادثة صغيرة»): a home of big project cards with the four paths to start from; inside a project a
// full-width page that scrolls as a whole — a top bar (back, title, what it cost, its ring, «📚 المكتبة», «🗄️ الخزان»),
// the stages as a rail of pills, his answers as cards (long ones in sections), his questions as buttons (the table of 104
// carousel styles, the list of 50 fonts, and the galleries), the carousel's slides appearing as they are drawn (each
// downloadable, each with its check and a way to draw it again), the edit rooms he opens in «حيدرة كت», and the box to
// write in held at the bottom of the screen. The look is content.css.

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Coined from "@/components/Coined";
import { coinStr } from "@config/coins";
import ClaudeModelPicker from "@/components/robots/ClaudeModelPicker";
import MicButton from "@/components/robots/MicButton";
import { useClaudeModel } from "@/components/robots/claude-model";
import { api, postJson } from "@/lib/fetch";
import { probeFile, putWithProgress } from "@/components/jawad/studio/upload";
import QuickReplies, { Swatches } from "@/components/jawad/QuickReplies";
import { answerLine, decisionsOf, pathLine, CAROUSEL_HELP_LINE, carouselLine, carouselOwnLine, DELEGATE_LINE, FONT_AUTO_LINE, fontLine, fontStyleLine, moodLine, MOTION_CAROUSEL_HELP_LINE, motionCarouselLine, motionCarouselOwnLine, motionLine, PALETTE_LABEL, PALETTE_STYLE_LINE, paletteLine, stripMarks, styleLine, templateLine } from "@/lib/content/marks";
import { CONTENT_PATHS, findPath, type ContentPath } from "@config/content-paths";
import { CONTENT_CLAUDE_MODEL } from "@config/claude-models";
import CarouselTable, { type CarouselItem } from "./CarouselTable";
import FontTable, { type FontItem } from "./FontTable";
import MotionCarouselTable from "./MotionCarouselTable";
import { JAWAD_ATTACHMENT_LIMIT } from "@config/jawad/limits";
import { drawWithCode, pngBody, smallJpeg } from "@/components/claude-code/draw";
import { downloadYoutube, sheetOf, soundOnlyAsk, youtubeLinks } from "./media-prep";
import { joinSlidesToReel } from "./slides-reel";
import StorePanel from "./StorePanel";
import ContentLibrary from "./ContentLibrary";

interface FileView { id: string; kind: "image" | "video" | "audio" | "doc"; name: string; durationMs: number | null; url?: string | null }
interface SlideView { n: number; fileId: string; name: string; text: string; url: string | null; download: string | null; flag?: string; fixed?: boolean; video?: string; videoUrl?: string | null; videoDownload?: string | null }
interface FailView { n: number; reason: string; detail?: string; text: string }
/** «حيدرا ماكس» designs and moves the slides with «الرشيق» (the owner, 17 Nov 2026: «خله بنموذج الرشيق!!»). */
const HAIDARA_MODEL = "claude-sonnet-5-5";

/** Ways to spend less, shown to the person under the chat (the owner, 17 Nov 2026: «حطها كنصائح تطلع للعميل»). */
const SAVING_TIPS = [
  "«الرشيق» هو النموذج الافتراضي هنا ويكفي لأغلب الشغل. بدّل لـ«الأصيل» من زر 🧠 بس إذا تبي كتابة إبداعية أعمق: سعره الضعف.",
  "أزرار الموقع (الألوان، الخط، ستايل الحركة، طريقة الصنع) مجانية: اضغط الزر وبس وما ينحسب عليك شي. اللي له سعر هو الكتابة لمحمد باقر، فلا تكتب جنب الزر إلا إذا تبي تغيّر شي.",
  "اجمع طلباتك في رسالة وحدة (عدد الشرائح، الشخصية، الصوت، الخاتمة) بدل عدة رسائل.",
  "في الموشن كاروسيل: «حيدرا ماكس بالكود فقط» الأرخص بفرق كبير؛ اختر صور GPT Image 2 بس إذا تحتاج شخصية أو مشهد مرسوم.",
  "قلّل عدد الشرائح: كل شريحة صورة وتصميم وحركة، و٥ شرائح غالبًا تكفي.",
  "راجع صور المرحلة الأولى زين قبل «اعتمد»: إعادة صورة وحدة أرخص بكثير من إعادة شريحة متحركة كاملة.",
  "إذا عندك صوت المقطع ارفعه ملف صوت (MP3/M4A) بدل فيديو طويل.",
];

interface SlidesView { aspect: string; items: SlideView[]; todo: number[]; failed: FailView[]; running: boolean; total: number; report?: string; maker?: "code"; mix?: boolean; gpt26?: "sunburst" | "flare"; motion?: unknown; phase?: "pictures" | "approve"; deferred?: number[] ; approved?: boolean; split?: boolean }
interface MediaView {
  id: string; kind: "image" | "video"; name: string; aspect: string; refs?: string[]; state: "todo" | "running" | "done" | "failed";
  url?: string | null; download?: string | null; error?: string; detail?: string; transient?: boolean; tries?: number;
  desk?: { generator: string; coins: number; free: boolean };
}
interface Question { label: string; kind: "choice" | "templates" | "styles" | "motion" | "moods" | "palettes" | "carousels" | "fonts" | "motioncarousels"; options: string[]; multi: boolean }
interface Msg {
  role: "user" | "assistant";
  text: string;
  files?: FileView[];
  questions?: Question[];
  slides?: SlidesView;
  media?: { items: MediaView[] };
  editor?: { id: string; title: string; lab?: string };
  error?: boolean;
  /** written on this page (the opening of a path), never saved with the conversation */
  local?: boolean;
  /** the project's second chat («✍️ الكتابة والموشن») */
  thread?: "design";
  /** the delivery message the first chat handed to the second */
  handoff?: boolean;
}
interface ChatItem { id: string; title: string; updatedAt?: string }
interface Pending { total: number; mode: "all" | "fix"; todo: number[] }
interface Palette { name: string; bg: string; text: string; primary: string; accent: string }
interface GalleryItem { id: string; group: string; name: string; description: string; bestFor: string; image: string | null; icon?: string; palettes?: Palette[]; structures?: string[]; swatch?: string[] }
interface Galleries { templates: GalleryItem[]; styles: GalleryItem[]; motion?: GalleryItem[]; moods?: GalleryItem[]; palettes?: GalleryItem[]; carousels?: (CarouselItem & { font?: string })[]; niches?: string[]; fonts?: FontItem[]; fontGroups?: string[] }
type GalleryKind = "templates" | "styles" | "motion" | "moods" | "palettes";

/** What each gallery says on its buttons, and the line a pick becomes in the message. */
const GALLERY: Record<GalleryKind, { open: string; none: string; line: (p: { id: string; name: string }) => string }> = {
  templates: { open: "🖼️ افتح معرض القوالب", none: "🚫 بدون قالب — صمّم لي بحرية", line: templateLine },
  styles: { open: "🎨 افتح معرض الستايلات الكرتونية", none: "🚫 بدون ستايل كرتوني", line: styleLine },
  motion: { open: "🎬 افتح معرض مهارات الموشن", none: "🎲 اختر لي المهارة الأنسب", line: motionLine },
  moods: { open: "🎭 افتح معرض مشاعر الموشن", none: "🎲 اختر لي المزاج الأنسب", line: moodLine },
  palettes: { open: "🎨 افتح معرض الألوان (١٠٠ لوحة)", none: "🎲 اختر لي الألوان الأنسب", line: paletteLine },
};

// the start cards are the four paths (config/content-paths.ts)

const KIND_IC = { image: "🖼️", video: "🎞️", audio: "🎧", doc: "📄" } as const;

/** The answer's light markdown (headings, lists, tables, bold, rules; colours as swatches) as elements. */
function Rich({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => (/^\*\*[^*]+\*\*$/.test(p) ? <b key={i}>{p.slice(2, -2)}</b> : /^`[^`]+`$/.test(p) ? <code key={i}>{p.slice(1, -1)}</code> : <Swatches key={i} text={p} cls="ct" />));
  // a line break the model writes inside a table cell («<br>») is a break, never shown as code
  const cell = (s: string) => s.split(/<br\s*\/?>/i).map((p, i) => <Fragment key={i}>{i > 0 && <br />}{inline(p.trim())}</Fragment>);
  const out: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let table: string[][] | null = null;
  const flush = () => {
    if (list) {
      const Tag = list.ordered ? "ol" : "ul";
      out.push(<Tag key={out.length}>{list.items.map((x, i) => <li key={i}>{inline(x)}</li>)}</Tag>);
      list = null;
    }
    if (table) {
      const [head, ...rows] = table;
      out.push(
        <table key={out.length}>
          <thead><tr>{head.map((c, i) => <th key={i}>{cell(c)}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{cell(c)}</td>)}</tr>)}</tbody>
        </table>,
      );
      table = null;
    }
  };
  for (const line of text.split("\n")) {
    const tr = /^\s*\|(.+)\|\s*$/.exec(line);
    if (tr) {
      const cells = tr[1].split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      if (list) flush();
      (table ??= []).push(cells);
      continue;
    }
    const li = /^\s*(?:([-•*])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (li) {
      const ordered = Boolean(li[2]);
      if (table || (list && list.ordered !== ordered)) flush();
      (list ??= { ordered, items: [] }).items.push(li[3]);
      continue;
    }
    flush();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) out.push(h[1].length <= 2 ? <h3 key={out.length}>{inline(h[2])}</h3> : h[1].length === 3 ? <h4 key={out.length}>{inline(h[2])}</h4> : <h5 key={out.length}>{inline(h[2])}</h5>);
    else if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) out.push(<hr key={out.length} />);
    else if (line.trim()) out.push(<p key={out.length}>{inline(line)}</p>);
  }
  flush();
  return <>{out}</>;
}

/** An answer cut at its headings: the words before the first heading, then each section (title and body). */
export function splitAnswer(text: string): { intro: string; sections: { title: string; body: string }[] } {
  const intro: string[] = [];
  const sections: { title: string; lines: string[] }[] = [];
  for (const line of text.replace(/\r/g, "").split("\n")) {
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    if (h) sections.push({ title: h[1].replace(/\*\*/g, "").trim(), lines: [] });
    else (sections.length ? sections[sections.length - 1].lines : intro).push(line);
  }
  return { intro: intro.join("\n").trim(), sections: sections.map((s) => ({ title: s.title, body: s.lines.join("\n").trim() })).filter((s) => s.title || s.body) };
}

const preview = (body: string) => body.replace(/[#*`>|_-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);

/** «محمد باقر»'s answer on its card: a long one (several sections) opens one section at a time, like the film maker's replies. */
export function Answer({ text }: { text: string }) {
  const [all, setAll] = useState<boolean | null>(null);
  const { intro, sections } = splitAnswer(text);
  if (sections.length < 2 || (text.length <= 900 && sections.length <= 2)) return <Rich text={text} />;
  return (
    <div className="ct-secs">
      <div className="ct-secs-all">
        <button type="button" onClick={() => setAll(!(all ?? false))}>{all ? "سكّر الأقسام" : `افتح كل الأقسام (${sections.length.toLocaleString("ar")})`}</button>
      </div>
      {intro && <Rich text={intro} />}
      {sections.map((s, i) => (
        <details key={`${i}-${all}`} className="ct-sec" open={(all ?? i === 0) || undefined}>
          <summary>
            <span>{s.title}</span>
            {s.body && <small>{preview(s.body)}</small>}
          </summary>
          {s.body && <Rich text={s.body} />}
        </details>
      ))}
    </div>
  );
}

/** The project's ring: how much of its stages is done (a conic ring like the film maker's). */
function Ring({ percent, busy }: { percent: number; busy?: boolean }) {
  return (
    <div className="ct-ring" style={{ ["--p" as string]: percent }} data-busy={busy || undefined} role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="اكتمال المشروع">
      <span>{percent}%</span>
    </div>
  );
}

export type StageKey = "idea" | "pictures" | "design" | "delivery" | "editor";
export interface StageView { key: StageKey; label: string; state: "done" | "open" | "locked"; ask: boolean }

/**
 * The project's stages as the rail shows them, read from its messages: a carousel of two chats (idea → pictures →
 * writing and motion → delivery), of one chat (idea → design → delivery), or a motion piece (idea → the edit room).
 * Each is done, open or locked, and `ask` when it waits for the person (pictures to approve, questions to answer).
 */
export function stagesOf(msgs: Msg[], path: string | null): StageView[] {
  const real = msgs.filter((m) => !m.error);
  const blocks = real.filter((m) => m.slides).map((m) => ({ s: m.slides!, design: m.thread === "design" }));
  // (a two-chat carousel shows its four stages from the start, before its pictures are handed on)
  const twoChats = real.some((m) => m.thread === "design") || blocks.some((b) => b.s.split);
  const lastBot = (design?: boolean) => [...real].reverse().find((m) => m.role === "assistant" && (design === undefined || (m.thread === "design") === design));
  const asks = (m?: Msg) => !!m?.questions?.length;
  const finished = (s: SlidesView) => !s.running && s.items.length > 0 && s.todo.length === 0 && s.phase !== "approve" && s.phase !== "pictures";
  const approving = blocks.some((b) => !b.design && b.s.phase === "approve" && !b.s.running);
  const st = (done: boolean, open: boolean): StageView["state"] => (done ? "done" : open ? "open" : "locked");

  if ((path === "motion-graphics" || path === "reel-graphics") && !blocks.length) {
    const room = real.some((m) => m.editor);
    return [
      { key: "idea", label: "الفكرة", state: st(room, true), ask: !room && asks(lastBot()) },
      { key: "editor", label: "🎬 غرفة المونتاج", state: st(room, false), ask: false },
    ];
  }
  const started = blocks.length > 0;
  if (twoChats) {
    const pics = blocks.filter((b) => !b.design);
    const made = blocks.some((b) => b.design && finished(b.s));
    return [
      { key: "idea", label: "الفكرة والنصوص", state: st(started, true), ask: !started && asks(lastBot(false)) },
      { key: "pictures", label: "🖼️ الصور", state: st(!approving && !pics.some((b) => b.s.running), pics.length > 0), ask: approving },
      { key: "design", label: "✍️ الكتابة والموشن", state: st(made, true), ask: !made && asks(lastBot(true)) },
      { key: "delivery", label: "🎬 التسليم", state: st(made, false), ask: false },
    ];
  }
  const made = blocks.some((b) => finished(b.s));
  return [
    { key: "idea", label: "الفكرة والنصوص", state: st(started, true), ask: !started && asks(lastBot()) },
    { key: "design", label: "🎨 التصميم", state: st(made, started), ask: approving || (started && !made && asks(lastBot())) },
    { key: "delivery", label: "🎬 التسليم", state: st(made, false), ask: false },
  ];
}

const DIGITS = ["١", "٢", "٣", "٤", "٥"];
const PATHS_KEY = "jw-content-paths";

/** A thumbnail of a gallery item: its picture, or (no picture yet) a template's palette or a style's family icon. */
function Thumb({ item, big }: { item: GalleryItem; big?: boolean }) {
  // a palette: its four colours side by side, their codes on the enlarged one
  if (item.swatch)
    return (
      <div className={`ct-thumb ${big ? "big" : ""}`} style={{ display: "flex", overflow: "hidden", ...(big ? { width: "100%", height: 220 } : {}) }} aria-label={item.name}>
        {item.swatch.map((c) => (
          <i key={c} style={{ flex: 1, background: c, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 6, fontStyle: "normal", fontSize: 11, color: "#fff", textShadow: "0 1px 2px #000" }}>{big ? c : ""}</i>
        ))}
      </div>
    );
  if (item.image) return <img src={item.image} alt={item.name} loading="lazy" className={`ct-thumb ${big ? "big" : ""}`} />;
  const p = item.palettes?.[0];
  return (
    <div className={`ct-thumb ct-thumb-ph ${big ? "big" : ""}`} style={{ background: p?.bg ?? "#222" }} aria-label={item.name}>
      {p ? (
        <>
          <b style={{ color: p.text }}>{item.name}</b>
          <span><i style={{ background: p.text }} /><i style={{ background: p.primary }} /><i style={{ background: p.accent }} /></span>
        </>
      ) : (
        <b style={{ color: "#fff" }}>{item.icon ?? "🎨"} {item.name}</b>
      )}
    </div>
  );
}

/** One of the two galleries: small pictures grouped, a press enlarges, «اختر» picks, with a way out and a way to write. */
export function Gallery({ kind, items, onPick, onNone, onWrite }: { kind: GalleryKind; items: GalleryItem[]; onPick: (i: GalleryItem) => void; onNone: () => void; onWrite: () => void }) {
  const [view, setView] = useState<GalleryItem | null>(null);
  const groups = [...new Set(items.map((i) => i.group))];
  useEffect(() => {
    if (!view) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setView(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [view]);
  return (
    <div className="ct-gal">
      {groups.map((g) => (
        <section key={g}>
          <h5>{g}</h5>
          <div className={`ct-gal-grid ${kind}`}>
            {items.filter((i) => i.group === g).map((i) => (
              <figure key={i.id} className="ct-gal-card">
                <button type="button" className="ct-gal-open" onClick={() => setView(i)} aria-label={`كبّر ${i.name}`}>
                  <Thumb item={i} />
                  <span className="zoom" aria-hidden>🔍</span>
                </button>
                <figcaption>
                  <b>{i.name}</b>
                  <button type="button" className="ct-mini" onClick={() => onPick(i)}>اختر</button>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
      <div className="ct-actions">
        <button type="button" className="ct-opt" onClick={onNone}>{GALLERY[kind].none}</button>
        <button type="button" className="ct-opt ct-opt-write" onClick={onWrite}>✍️ أكتب وصفي الخاص</button>
      </div>
      {view && (
        <div className="ct-lightbox" role="dialog" aria-modal="true" aria-label={view.name} onClick={() => setView(null)}>
          <div className="ct-lightbox-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ct-lightbox-x" onClick={() => setView(null)} aria-label="أغلق">✕</button>
            <Thumb item={view} big />
            <h4>{view.name} <small>({view.group})</small></h4>
            <p>{view.description}</p>
            <p className="muted">يناسب: {view.bestFor}</p>
            {view.structures && <p className="muted">بنيات تناسبه: {view.structures.join("، ")}</p>}
            {view.palettes && (
              <div className="ct-pals">
                {view.palettes.map((p) => (
                  <span key={p.name} className="ct-pal">
                    <i style={{ background: p.bg }} /><i style={{ background: p.text }} /><i style={{ background: p.primary }} /><i style={{ background: p.accent }} />
                    {p.name}
                  </span>
                ))}
              </div>
            )}
            <div className="ct-actions">
              <button type="button" className="ct-send" style={{ height: 42 }} onClick={() => { onPick(view); setView(null); }}>اختر هذا</button>
              <button type="button" className="ct-opt" onClick={() => setView(null)}>رجوع للمعرض</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The carousel style picked in the messages before message `at` (its [كاروسيل:id] mark), for the font that comes with it. */
const styleBefore = (msgs: Msg[], at: number) => {
  for (let k = at - 1; k >= 0; k--) {
    if (msgs[k].role !== "user") continue;
    const id = [...msgs[k].text.matchAll(/\[كاروسيل:([a-z0-9-]+)\]/g)].at(-1)?.[1];
    if (id) return id;
  }
  return null;
};

/** The questions of an answer as buttons. One plain question sends on a press; a batch collects the answers first. */
export function Questions({ questions, gal, styleId, disabled, onSend, onWrite }: { questions: Question[]; gal: Galleries | null; styleId?: string | null; disabled: boolean; onSend: (text: string) => void; onWrite: () => void }) {
  const [picked, setPicked] = useState<Record<number, string[]>>({});
  const [other, setOther] = useState<Record<number, string>>({});
  const [openOther, setOpenOther] = useState<Record<number, boolean>>({});
  // the table of carousel styles (or the list of fonts) opens by itself: it is the question
  const [gallery, setGallery] = useState<number | null>(() => {
    const i = questions.findIndex((x) => x.kind === "carousels" || x.kind === "fonts" || x.kind === "motioncarousels");
    return i < 0 ? null : i;
  });
  const [lines, setLines] = useState<Record<number, string>>({});

  // one plain question: a press sends it
  if (questions.length === 1 && questions[0].kind === "choice" && !questions[0].multi) {
    return <QuickReplies cls="ct" options={questions[0].options} disabled={disabled} onPick={(o) => onSend(o)} onWrite={onWrite} />;
  }

  const toggle = (qi: number, o: string, multi: boolean) =>
    setPicked((p) => {
      const cur = p[qi] ?? [];
      return { ...p, [qi]: cur.includes(o) ? cur.filter((x) => x !== o) : multi ? [...cur, o] : [o] };
    });
  const answerOf = (qi: number): string | null => {
    const q = questions[qi];
    if (q.kind !== "choice") return lines[qi] ?? null;
    const a = [...(picked[qi] ?? []), ...(other[qi]?.trim() ? [other[qi].trim()] : [])];
    return a.length ? answerLine(q.label, a) : null;
  };
  const answered = questions.map((_, i) => answerOf(i)).filter((x): x is string => !!x);
  const send = (delegate: boolean) => onSend([...answered, ...(delegate ? [DELEGATE_LINE] : [])].join("\n"));
  const chosenName = (qi: number) => (lines[qi] ? stripMarks(lines[qi]).replace(/^•\s*[^:]+:\s*/, "") : "");
  // the chosen style's ready font, offered first in the list of fonts
  const readyId = styleId ? gal?.carousels?.find((c) => c.id === styleId)?.font : undefined;
  const readyFont = readyId ? (gal?.fonts?.find((f) => f.id === readyId) ?? null) : null;
  // a pick in the table: alone it sends at once; with other questions it waits for their answers
  const pickCarousel = (qi: number, line: string) => {
    if (questions.length === 1) return onSend(line);
    setLines((s) => ({ ...s, [qi]: line }));
    setGallery(null);
  };

  return (
    <div className="ct-qs">
      {questions.map((q, qi) => (
        <div key={qi} className="ct-q">
          <b>{qi + 1}) {q.label}{q.multi ? " (يجوز أكثر من خيار)" : ""}</b>
          {q.kind === "choice" ? (
            <div className="ct-opts">
              {q.options.map((o) => (
                <button key={o} type="button" className="ct-opt" aria-pressed={(picked[qi] ?? []).includes(o)} disabled={disabled} onClick={() => toggle(qi, o, q.multi)}>
                  <Swatches text={o} cls="ct" />
                </button>
              ))}
              <button type="button" className="ct-opt ct-opt-write" aria-pressed={!!openOther[qi]} disabled={disabled} onClick={() => setOpenOther((s) => ({ ...s, [qi]: !s[qi] }))}>✍️ غير ذلك</button>
              {openOther[qi] && <input className="ct-inline" dir="auto" value={other[qi] ?? ""} placeholder="اكتب إجابتك" onChange={(e) => setOther((s) => ({ ...s, [qi]: e.target.value.slice(0, 200) }))} />}
            </div>
          ) : q.kind === "fonts" ? (
            <div className="ct-opts">
              <button type="button" className="ct-opt" aria-pressed={gallery === qi} disabled={disabled} onClick={() => setGallery(gallery === qi ? null : qi)}>
                🔤 {gallery === qi ? "أغلق قائمة الخطوط" : "افتح قائمة الخطوط (٥٠ خطًا عربيًا)"}
              </button>
              {chosenName(qi) && (
                <span className="ct-chip ct-picked">✓ {chosenName(qi)} <button type="button" aria-label="ألغِ" onClick={() => setLines((s) => { const n = { ...s }; delete n[qi]; return n; })}>✕</button></span>
              )}
              {gallery === qi && (
                gal?.fonts ? (
                  <FontTable
                    items={gal.fonts}
                    groups={gal.fontGroups ?? []}
                    ready={readyFont}
                    recommended={q.options}
                    disabled={disabled}
                    onPick={(f) => pickCarousel(qi, fontLine({ id: f.id, name: f.name }))}
                    onReady={(f) => pickCarousel(qi, fontStyleLine(f.name))}
                    onAuto={() => pickCarousel(qi, FONT_AUTO_LINE)}
                  />
                ) : (
                  <p className="muted">جاري تحميل الخطوط…</p>
                )
              )}
            </div>
          ) : q.kind === "motioncarousels" ? (
            <div className="ct-opts">
              <button type="button" className="ct-opt" aria-pressed={gallery === qi} disabled={disabled} onClick={() => setGallery(gallery === qi ? null : qi)}>
                🎬 {gallery === qi ? "أغلق جدول الحركة" : "افتح جدول ستايلات الحركة (٢٢ ستايل)"}
              </button>
              {chosenName(qi) && (
                <span className="ct-chip ct-picked">✓ {chosenName(qi)} <button type="button" aria-label="ألغِ" onClick={() => setLines((s) => { const n = { ...s }; delete n[qi]; return n; })}>✕</button></span>
              )}
              {gallery === qi && (
                <MotionCarouselTable
                  recommended={q.options}
                  disabled={disabled}
                  onPick={(m) => pickCarousel(qi, motionCarouselLine({ id: m.id, name: m.name }))}
                  onHelp={() => onSend([...answered, MOTION_CAROUSEL_HELP_LINE].join("\n"))}
                  onOwn={(what) => pickCarousel(qi, motionCarouselOwnLine(what))}
                />
              )}
            </div>
          ) : q.kind === "carousels" ? (
            <div className="ct-opts">
              <button type="button" className="ct-opt" aria-pressed={gallery === qi} disabled={disabled} onClick={() => setGallery(gallery === qi ? null : qi)}>
                📋 {gallery === qi ? "أغلق جدول الستايلات" : "افتح جدول الستايلات (١٠٤ ستايل حسب المجال)"}
              </button>
              {chosenName(qi) && (
                <span className="ct-chip ct-picked">✓ {chosenName(qi)} <button type="button" aria-label="ألغِ" onClick={() => setLines((s) => { const n = { ...s }; delete n[qi]; return n; })}>✕</button></span>
              )}
              {gallery === qi && (
                gal?.carousels ? (
                  <CarouselTable
                    items={gal.carousels}
                    niches={gal.niches ?? []}
                    recommended={q.options}
                    disabled={disabled}
                    onPick={(i) => pickCarousel(qi, carouselLine({ id: i.id, name: i.name }))}
                    onHelp={() => onSend([...answered, CAROUSEL_HELP_LINE].join("\n"))}
                    onOwn={(what) => pickCarousel(qi, carouselOwnLine(what))}
                  />
                ) : (
                  <p className="muted">جاري تحميل الجدول…</p>
                )
              )}
            </div>
          ) : (
            <div className="ct-opts">
              {q.kind === "palettes" && q.label === PALETTE_LABEL && (
                // the colour step after the carousel style: its own colours are the default, the gallery changes them
                <button type="button" className="ct-opt" aria-pressed={lines[qi] === PALETTE_STYLE_LINE} disabled={disabled} onClick={() => { setLines((s) => ({ ...s, [qi]: PALETTE_STYLE_LINE })); setGallery(null); }}>
                  ✅ ألوان الستايل نفسها (الافتراضي)
                </button>
              )}
              <button type="button" className="ct-opt" aria-pressed={gallery === qi} disabled={disabled} onClick={() => setGallery(gallery === qi ? null : qi)}>
                {q.kind === "palettes" && q.label === PALETTE_LABEL ? "🎨 غيّر الألوان من المعرض (١٠٠ لوحة)" : GALLERY[q.kind as GalleryKind].open}
              </button>
              {chosenName(qi) && (
                <span className="ct-chip ct-picked">✓ {chosenName(qi)} <button type="button" aria-label="ألغِ" onClick={() => setLines((s) => { const n = { ...s }; delete n[qi]; return n; })}>✕</button></span>
              )}
              {gallery === qi && (
                gal ? (
                  <Gallery
                    kind={q.kind as GalleryKind}
                    items={(gal[q.kind as GalleryKind] ?? []) as GalleryItem[]}
                    onPick={(i) => { setLines((s) => ({ ...s, [qi]: GALLERY[q.kind as GalleryKind].line({ id: i.id, name: i.name }) })); setGallery(null); }}
                    onNone={() => { setLines((s) => ({ ...s, [qi]: GALLERY[q.kind as GalleryKind].line({ id: "none", name: "" }) })); setGallery(null); }}
                    onWrite={onWrite}
                  />
                ) : (
                  <p className="muted">جاري تحميل المعرض…</p>
                )
              )}
            </div>
          )}
        </div>
      ))}
      <div className="ct-actions">
        <button type="button" className="ct-send" style={{ height: 42, minWidth: 0, padding: "0 18px" }} disabled={disabled || answered.length === 0} onClick={() => send(false)}>أرسل الإجابات ✅</button>
        <button type="button" className="ct-opt" disabled={disabled} onClick={() => send(true)}>🎲 اختر أنت لكل ما لم أحدده</button>
        <button type="button" className="ct-opt ct-opt-write" disabled={disabled} onClick={onWrite}>✍️ اكتب إجابة مختلفة</button>
      </div>
    </div>
  );
}

/** A rendered slide's MP4 put up as the person's upload (signed, then checked by the server); its upload id. */
async function putVideo(blob: Blob, fileName: string): Promise<string> {
  const signed = await postJson<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: "video", mime: "video/mp4", bytes: blob.size, fileName });
  await putWithProgress(signed.signedUrl, new File([blob], fileName, { type: "video/mp4" }), "video/mp4", () => {});
  const conf = await postJson<{ upload: { id: string; status: string; error: string | null } }>("/api/jawad/uploads/confirm", { id: signed.id });
  if (conf.upload?.status !== "ready") throw new Error(conf.upload?.error ?? "تعذّر رفع فيديو الشريحة.");
  return conf.upload.id;
}

/** «🎬 حوّله ريل»: the carousel's slides joined in order into one 9:16 video (lib: ./slides-reel), downloaded. */
/** Words that ask for a page button's job (the owner, 18 Nov 2026: «كل زر يستخدم فالمحادثة عادي ينرسل كتابة»). */
export function pageAction(t: string): "reel" | "download" | null {
  const s = t.trim().replace(/[.!؟?،,]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s || s.length > 50 || /(غي[ّ]?ر|عد[ّ]?ل|بدل|شيل|لكن)/.test(s)) return null;
  if (/^(يلا\s+)?((حو[ّ]?ل|سو[ّ]?ي?|اجمع|طل[ّ]?ع)(ه|ها|هم)?|ابي|أبي|ابغى|ابغا)?\s*(لي\s*)?(ال)?ريل(\s*(منها|منهم|واحد|مقطع واحد))?$/.test(s)) return "reel";
  if (/^(حم[ّ]?ل|ابي احمل|أبي أحمل|تحميل)\s*(لي\s*)?(كل\s*)?(ال)?(شرائح|سلايدات|صور|فيديوهات|الكل|كلها)$/.test(s) || /^(نز[ّ]?ل)\s*(لي\s*)?(كل\s*)?(ال)?(شرائح|سلايدات)\s*(عندي|على جهازي)?$/.test(s)) return "download";
  return null;
}

function ReelButton({ items, go = 0 }: { items: SlideView[]; go?: number }) {
  const [p, setP] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // asked in words: the same as pressing it
  const lastGo = useRef(go);
  useEffect(() => {
    if (go === lastGo.current) return;
    lastGo.current = go;
    if (p == null) void make();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go]);
  async function make() {
    setErr(null);
    setP(0);
    try {
      const ordered = [...items].sort((a, b) => a.n - b.n);
      const blob = await joinSlidesToReel(ordered.map((x) => ({ video: x.videoUrl ?? null, image: x.url })), setP);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ريل_الكاروسيل.mp4";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ما قدرنا نطلّع الريل.");
    } finally {
      setP(null);
    }
  }
  return (
    <>
      <button className="ct-mini" type="button" disabled={p != null} onClick={() => void make()} title="الشرائح كلها بالترتيب في مقطع واحد 9:16 بصوتها">
        {p != null ? `🎬 أجمع الريل… ${Math.round(p * 100)}٪` : "🎬 حوّله ريل (مقطع واحد)"}
      </button>
      {err && <small style={{ color: "#f87171" }}>{err}</small>}
    </>
  );
}

/** The carousel of an answer: tiles in order, the drawing ones as moving placeholders, each made one with its check. */
/** «✏️ عدّل الشريحة»: a slide's own rules as ready choices — each press adds one clear line to the change. */
export const SLIDE_RULES: { label: string; opts: string[] }[] = [
  { label: "حركة الدخول", opts: ["من اليمين", "من اليسار", "من تحت", "من فوق", "تكبير من الوسط", "ظهور ناعم", "كلمة كلمة", "بدون حركة دخول"] },
  { label: "السرعة", opts: ["أبطأ", "أسرع", "هادئة وثابتة"] },
  { label: "مكان الصورة", opts: ["فوق", "في الوسط", "تحت", "تملأ الشريحة", "يمين", "يسار"] },
  { label: "مكان الكتابة", opts: ["فوق", "في الوسط", "تحت"] },
  { label: "حجم الكتابة", opts: ["أكبر", "أصغر"] },
];

/** The line a ready choice adds to the change («حركة الدخول: من اليمين»), once. */
export function addRule(said: string, label: string, value: string): string {
  const lines = said.split("\n").filter((l) => l.trim() && !l.startsWith(`${label}:`));
  return [...lines, `${label}: ${value}`].join("\n");
}

/** «0:12», «١٢», «1:05.5» or «12.5» → seconds; null when it is not a time. */
export function parseClock(v: string): number | null {
  const t = v.trim().replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[٫,]/g, ".").replace(/[؛:]/g, ":");
  if (!t) return null;
  const m = /^(?:(\d{1,2}):)?(\d{1,2}(?:\.\d+)?)$/.exec(t);
  if (!m) return null;
  const sec = Number(m[2]);
  if (m[1] !== undefined && sec >= 60) return null;
  const all = Number(m[1] ?? 0) * 60 + sec;
  return Number.isFinite(all) ? all : null;
}

export function SlidesBox({ s, busy, owner, onRetry, onDownloadAll, onResume, onApprove, onRedoPicture, onChangeApproved, onSoundTime, onEditSlide, fonts, reelGo, step }: { s: SlidesView; busy: boolean; owner: boolean; onRetry: (ns: number[] | "failed") => void; onDownloadAll: () => void; onResume?: () => void; onApprove?: () => void; onRedoPicture?: (n: number, note: string) => void; onChangeApproved?: (n: number, note: string) => void; onSoundTime?: (n: number, from: number, to: number, retext: boolean) => void; onEditSlide?: (ns: number[], said: string) => void; fonts?: FontItem[]; reelGo?: number; step?: string | null }) {
  const ns = [...new Set([...s.items.map((i) => i.n), ...s.todo])].sort((a, b) => a - b);
  const done = s.items.filter((i) => !s.todo.includes(i.n)).length;
  // which picture is being asked again, and what should change in it (a field here: a browser popup does nothing in the
  // phone apps' own browsers — Instagram, WhatsApp — so «أعد صورة» did nothing there, 17 Nov 2026)
  const [redoN, setRedoN] = useState<number | null>(null);
  const [redoNote, setRedoNote] = useState("");
  // «⏱️ وقت الصوت»: the person types which part of the sound a slide plays («من ٠:١٢ إلى ٠:٢٠»)
  const [timeN, setTimeN] = useState<number | null>(null);
  // «✏️ عدّل الشريحة»: a change to one made slide in the person's words (its program is patched, nothing repainted)
  const [editN, setEditN] = useState<number | null>(null);
  const [editSaid, setEditSaid] = useState("");
  const [editAll, setEditAll] = useState(false);
  const [ink, setInk] = useState("#ffffff");
  const [ground, setGround] = useState("#111111");
  const madeNs = s.items.filter((i) => i.videoUrl && !s.todo.includes(i.n)).map((i) => i.n);
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  // the words of the new time usually differ: the person chooses whether the slide's text follows them
  const [retext, setRetext] = useState(false);
  const tFrom = parseClock(timeFrom);
  const tTo = parseClock(timeTo);
  const timeOk = tFrom !== null && tTo !== null && tTo > tFrom && tTo - tFrom <= 60;
  const aspect = s.aspect.replace(":", " / ") || "1 / 1";
  return (
    <div className="ct-slidebox">
      {s.running && (
        <div className="ct-progress" role="status" aria-live="polite">
          <span className="ct-spin" aria-hidden />
          <div>
            {s.phase === "pictures" ? (
              <>
                <b>🖼️ المرحلة ١: نرسم صور الشرائح بدون كتابة… ({s.items.length} من {s.total})</b>
                <small>نرسم صور كل الشرائح أول (بدون كتابة). لما تخلص تشوفها هنا وتعتمدها أو تعيد أي صورة، وبعدها يبدأ حيدرا ماكس بالتصميم{s.motion ? " والحركة" : ""}. لا تقفل الصفحة.</small>
              </>
            ) : s.motion ? (
              <>
                <b>🎬 حيدرا ماكس يصنع الموشن كاروسيل… ({done} من {s.total})</b>
                <small>{step ? `${step} — ` : ""}يكتب كل شريحة مشهدًا متحركًا فوق صورتها المعتمدة مرة وحدة، ثم تطلع هنا فيديو MP4 بصوته (دقايق للشريحة، ثلاث شرائح مع بعض). لا تقفل الصفحة؛ تظهر الشرائح هنا واحدة بعد واحدة.</small>
              </>
            ) : s.maker === "code" && s.mix ? (
              <>
                <b>🖼️ {s.gpt26 ? `GPT Image 2.6 ${s.gpt26 === "flare" ? "Flare" : "Sunburst"}` : "GPT Image 2"} يرسم الصور وحيدرا ماكس يكتب عليها… ({done} من {s.total})</b>
                <small>{step ? `${step} — ` : ""}جواد يولّد صورة كل شريحة بدون كتابة، وحيدرا ماكس يكتب عليها الكلام العربي بالكود ويراجعه. لا تقفل الصفحة؛ تظهر الشرائح هنا واحدة بعد واحدة.</small>
              </>
            ) : s.maker === "code" ? (
              <>
                <b>🧑‍💻 حيدرا ماكس يرسم الشرائح بالكود… ({done} من {s.total})</b>
                <small>{step ? `${step} — ` : ""}يكتب برنامج كل شريحة ويرسمها هنا في صفحتك ويشوفها ويعيد كتابتها لين تنجح (دقايق للشريحة). لا تقفل الصفحة؛ تظهر الشرائح هنا واحدة بعد واحدة.</small>
              </>
            ) : (
              <>
                <b>جواد يولّد الشرائح بـ {s.gpt26 ? `GPT Image 2.6 ${s.gpt26 === "flare" ? "Flare" : "Sunburst"}` : "GPT Image 2"}… ({done} من {s.total})</b>
                <small>محمد باقر سلّم الطلب لجواد، وكل شريحة يولّدها جواد ثم يفحص باقر كتابتها العربية، وتأخذ نحو دقيقة. لا تقفل الصفحة؛ تظهر الشرائح هنا واحدة بعد واحدة.</small>
              </>
            )}
            {!!s.motion && s.phase !== "pictures" && <small className="ct-steps">الترتيب: ١) صور الشرائح واعتمادك لها ← ٢) كتابة وتحريك كل شريحة فوق صورتها. كل خطوة تخلص في أقل من ١٠ دقايق؛ الشريحة اللي تطوّل نأجلها ونكمّل الباقي، ونرجع لها في الآخر.</small>}
            {!!s.deferred?.length && <small className="ct-steps">⏭️ مؤجّلة للآخر: الشريحة {s.deferred.join("، ")} (طوّلت، بنرجع لها بطريقة أخف).</small>}
            <span className="bar"><i style={{ width: `${s.total ? Math.round((done / s.total) * 100) : 0}%` }} /></span>
          </div>
        </div>
      )}
      {s.phase === "approve" && !s.running && onApprove && (
        <div className="ct-failed ct-approve">
          <b>🖼️ صور الشرائح جاهزة — راجعها قبل التصميم{s.motion ? " والحركة" : ""}</b>
          <small> إذا صورة ما عجبتك أعدها (واكتب وش يتغير فيها). إذا كلها تمام اعتمدها، ويبدأ حيدرا ماكس يصمم كل شريحة{s.motion ? " ثم يحرّكها" : ""}.</small>
          {onRedoPicture && (
            <div className="ct-actions">
              {s.items.map((i) => (
                <button
                  key={i.n}
                  type="button"
                  className="ct-mini"
                  disabled={busy}
                  onClick={() => {
                    setRedoN(redoN === i.n ? null : i.n);
                    setRedoNote("");
                  }}
                  aria-expanded={redoN === i.n}
                >
                  🔄 أعد صورة {i.n}
                </button>
              ))}
            </div>
          )}
          {onRedoPicture && redoN !== null && (
            <div className="ct-actions" style={{ alignItems: "stretch" }}>
              <input
                className="ct-input"
                style={{ flex: 1, minWidth: 0, minHeight: 40 }}
                value={redoNote}
                onChange={(e) => setRedoNote(e.target.value)}
                placeholder={`وش يتغير في صورة الشريحة ${redoN}؟ (اتركه فاضي لصورة جديدة بنفس الوصف)`}
                aria-label={`وش يتغير في صورة الشريحة ${redoN}`}
              />
              <button
                type="button"
                className="ct-mini ct-go"
                disabled={busy}
                onClick={() => {
                  onRedoPicture(redoN, redoNote.trim());
                  setRedoN(null);
                  setRedoNote("");
                }}
              >
                ارسم صورة {redoN} من جديد
              </button>
            </div>
          )}
          <button type="button" className="ct-mini ct-go" disabled={busy} onClick={onApprove}>✅ اعتمد الصور وابدأ التصميم</button>
        </div>
      )}
      {s.approved && !s.running && (
        <div className="ct-failed ct-approve">
          <b>✅ الصور معتمدة وانتقلت لمحادثة «✍️ الكتابة والموشن»</b>
          <small> تبي تغيّر صورة؟ اختر رقمها واكتب وش يتغير: تنرسم هنا من جديد، تعتمدها، وتنتقل للكتابة والموشن.</small>
          {onChangeApproved && (
            <div className="ct-actions">
              {s.items.map((i) => (
                <button key={i.n} type="button" className="ct-mini" disabled={busy} aria-expanded={redoN === i.n} onClick={() => { setRedoN(redoN === i.n ? null : i.n); setRedoNote(""); }}>
                  🔄 غيّر صورة {i.n}
                </button>
              ))}
            </div>
          )}
          {onChangeApproved && redoN !== null && (
            <div className="ct-actions" style={{ alignItems: "stretch" }}>
              <input className="ct-input" style={{ flex: 1, minWidth: 0, minHeight: 40 }} value={redoNote} onChange={(e) => setRedoNote(e.target.value)} placeholder={`وش يتغير في صورة الشريحة ${redoN}؟`} aria-label={`وش يتغير في صورة الشريحة ${redoN}`} />
              <button type="button" className="ct-mini ct-go" disabled={busy} onClick={() => { onChangeApproved(redoN, redoNote.trim()); setRedoN(null); setRedoNote(""); }}>
                ارسم صورة {redoN} من جديد
              </button>
            </div>
          )}
        </div>
      )}
      <div className="ct-slides">
        {ns.map((n) => {
          const item = s.items.find((i) => i.n === n);
          // waiting slides spin only while they are being drawn; stopped (a wallet ran out…) they wait for «كمّل الرسم»
          const drawing = s.todo.includes(n) && s.running;
          return (
            <figure key={n} className={`ct-slide ${drawing ? "drawing" : ""} ${item?.flag ? "flag" : ""}`} style={{ aspectRatio: aspect }}>
              {item?.videoUrl ? (
                // the slide's finished still shows (eight videos playing at once stayed paused on their dark first
                // frame, 23 Nov 2026); it plays under the pointer, or with its own ▶
                <video src={item.videoUrl} poster={item.url ?? undefined} muted loop playsInline controls preload="none" aria-label={item.text} onMouseEnter={(e) => void e.currentTarget.play().catch(() => undefined)} onMouseLeave={(e) => e.currentTarget.pause()} />
              ) : item?.url && <img src={item.url} alt={item.text} loading="lazy" />}
              <span className="n">{n}</span>
              {drawing && <span className="shimmer" aria-label={`الشريحة ${n} قيد الرسم`}><span className="ct-spin" /></span>}
              {item && !drawing && (
                <>
                  {item.flag ? <span className="badge warn" title={item.flag}>⚠️</span> : item.fixed ? <span className="badge fixed" title="أُعيد رسمها بعد أن وُجد فيها خطأ">🔁✓</span> : <span className="badge ok" title="سليمة في الفحص الآلي">✓</span>}
                  <span className="tools">
                    {item.videoDownload ? <a href={item.videoDownload} download={`${item.name}.mp4`} title="حمّل الفيديو">⬇️</a> : item.download && <a href={item.download} download={`${item.name}.png`}>⬇️</a>}
                    <button type="button" disabled={busy} onClick={() => onRetry([n])} title="أعد رسم هذه الشريحة">🔁</button>
                    {item.videoUrl && onEditSlide && <button type="button" disabled={busy} onClick={() => { setEditN(n); setEditSaid(""); setEditAll(false); setTimeN(null); }} title="عدّل هذه الشريحة بكلامك">✏️</button>}
                    {item.videoUrl && onSoundTime && <button type="button" disabled={busy} onClick={() => { setTimeN(n); setTimeFrom(""); setTimeTo(""); setRetext(false); setEditN(null); }} title="اختر وقت الصوت لهذه الشريحة">⏱️</button>}
                  </span>
                </>
              )}
            </figure>
          );
        })}
      </div>
      {editN !== null && onEditSlide && (
        <div className="ct-redo ct-time">
          <b>✏️ تعديل الشريحة {editN}</b>
          <small> اكتب وش تبي يتغير فيها بالضبط (كلمة، لون، مكان الصورة، حركة الدخول، السرعة…). نعدّل برنامجها نفسه وكل شي ثاني يبقى مثل ما هو، بدون رسم صورة جديدة.</small>
          <div className="ct-rules">
            {SLIDE_RULES.map((g) => (
              <div key={g.label} className="ct-rule">
                <span>{g.label}</span>
                {g.opts.map((o) => {
                  const on = editSaid.split("\n").includes(`${g.label}: ${o}`);
                  return <button key={o} type="button" className={`ct-chip ${on ? "on" : ""}`} onClick={() => setEditSaid((v) => addRule(v, g.label, o))}>{o}</button>;
                })}
              </div>
            ))}
            <div className="ct-rule">
              <span>الألوان</span>
              <input type="color" value={ink} onChange={(e) => setInk(e.target.value)} aria-label="لون الكتابة" />
              <button type="button" className="ct-chip" onClick={() => setEditSaid((v) => addRule(v, "لون الكتابة", ink))}>لون الكتابة</button>
              <input type="color" value={ground} onChange={(e) => setGround(e.target.value)} aria-label="لون الخلفية" />
              <button type="button" className="ct-chip" onClick={() => setEditSaid((v) => addRule(v, "لون الخلفية", ground))}>لون الخلفية</button>
            </div>
            {fonts && fonts.length > 0 && (
              <div className="ct-rule">
                <span>الخط</span>
                <select defaultValue="" onChange={(e) => { const f = fonts.find((x) => x.id === e.target.value); if (f) setEditSaid((v) => addRule(v, "الخط", `${f.name} (${f.id})`)); }}>
                  <option value="" disabled>اختر خط</option>
                  {fonts.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <textarea rows={3} value={editSaid} onChange={(e) => setEditSaid(e.target.value)} placeholder="اختر من فوق أو اكتب بكلامك، مثال: خل العنوان أكبر والصورة تدخل من اليمين" />
          {madeNs.length > 1 && (
            <label className="ct-all">
              <input type="checkbox" checked={editAll} onChange={(e) => setEditAll(e.target.checked)} /> طبّق نفس التعديل على كل الشرائح ({madeNs.length})
              {editAll && <small> كل شريحة تتعدّل لحالها، فالتكلفة تقريبًا {madeNs.length} أضعاف تعديل شريحة وحدة.</small>}
            </label>
          )}
          <button type="button" className="ct-mini" onClick={() => setEditN(null)}>إلغاء</button>
          <button
            type="button"
            className="ct-mini ct-go"
            disabled={busy || editSaid.trim().length < 2}
            onClick={() => {
              onEditSlide(editAll && madeNs.length > 1 ? madeNs : [editN], editSaid.trim());
              setEditN(null);
              setEditSaid("");
            }}
          >
            {editAll && madeNs.length > 1 ? `عدّل كل الشرائح (${madeNs.length})` : `عدّل الشريحة ${editN}`}
          </button>
        </div>
      )}
      {timeN !== null && onSoundTime && (
        <div className="ct-redo ct-time">
          <b>⏱️ وقت الصوت للشريحة {timeN}</b>
          <small> اكتب من أي ثانية إلى أي ثانية في مقطعك تبي الشريحة تقوله (مثل ٠:١٢ أو ١٢). نعيد الفيديو بنفس التصميم، بدون رسم من جديد.</small>
          <div className="ct-time-row">
            <label>من <input inputMode="decimal" dir="ltr" placeholder="0:12" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} /></label>
            <label>إلى <input inputMode="decimal" dir="ltr" placeholder="0:20" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} /></label>
          </div>
          <div className="ct-retext">
            <span>نص الشريحة:</span>
            <label><input type="radio" name="retext" checked={!retext} onChange={() => setRetext(false)} /> خلّه مثل ما هو</label>
            <label><input type="radio" name="retext" checked={retext} onChange={() => setRetext(true)} /> غيّره للكلام اللي في الوقت الجديد</label>
          </div>
          {(timeFrom || timeTo) && !timeOk && <small className="ct-warn"> {tFrom !== null && tTo !== null && tTo - tFrom > 60 ? "أطول وقت للشريحة ٦٠ ثانية." : "اكتب وقتين صحيحين، والثاني بعد الأول."}</small>}
          <button type="button" className="ct-mini" onClick={() => setTimeN(null)}>إلغاء</button>
          <button
            type="button"
            className="ct-mini ct-go"
            disabled={busy || !timeOk}
            onClick={() => {
              if (!timeOk || tFrom === null || tTo === null) return;
              onSoundTime(timeN, tFrom, tTo, retext);
              setTimeN(null);
            }}
          >
            ثبّت الوقت وأعد الفيديو
          </button>
        </div>
      )}
      {s.items.some((i) => i.flag) && (
        <ul className="ct-flags">
          {s.items.filter((i) => i.flag).map((i) => <li key={i.n}>⚠️ الشريحة {i.n}: {i.flag}</li>)}
        </ul>
      )}
      {s.failed.length > 0 && (
        <div className="ct-failed">
          <b>❌ لم تُصنع {s.failed.length} {s.failed.length === 1 ? "شريحة" : "شرائح"}:</b>
          <ul>
            {s.failed.map((f) => (
              <li key={f.n}>
                الشريحة {f.n}: {f.reason}
                {owner && f.detail && <small dir="ltr"> {f.detail}</small>}
                <button type="button" className="ct-mini" disabled={busy} onClick={() => onRetry([f.n])}>أعد المحاولة</button>
              </li>
            ))}
          </ul>
          {s.failed.length > 1 && <button type="button" className="ct-mini" disabled={busy} onClick={() => onRetry("failed")}>أعد محاولة كل الفاشلة</button>}
        </div>
      )}
      {!s.running && s.todo.length > 0 && s.phase !== "approve" && onResume && (
        <div className="ct-failed">
          <b>⏸️ وقف الرسم عند {s.todo.length === 1 ? `الشريحة ${s.todo[0]}` : `${s.todo.length} شرائح باقية (${s.todo.join("، ")})`}.</b>
          <small> نكمّلها بنفس التصميم والشخصيات اللي انرسمت، بدون ما تشرح من جديد.</small>
          <button type="button" className="ct-mini" disabled={busy} onClick={onResume}>▶️ كمّل الرسم</button>
        </div>
      )}
      {s.report && <pre className="ct-report">{s.report}</pre>}
      {!s.running && s.items.length > 0 && (
        <div className="ct-actions">
          <button className="ct-mini" type="button" onClick={onDownloadAll}>⬇️ حمّل كل الشرائح ({s.items.length})</button>
          {s.items.length > 1 && <ReelButton items={s.items} go={reelGo} />}
        </div>
      )}
    </div>
  );
}

/** The pictures and videos «محمد باقر» handed to جواد: who took each request, what it costs, its state, and the result. */
export function MediaBox({ items, busy, owner, onRetry, onResume }: { items: MediaView[]; busy: boolean; owner: boolean; onRetry: (ids: string[] | "failed") => void; onResume?: () => void }) {
  const ST = { todo: "بانتظار جواد", running: "جواد يولّده الحين…", done: "جاهز", failed: "تعذّر" } as const;
  return (
    <div className="ct-media">
      {!busy && onResume && items.some((x) => x.state === "todo") && (
        <div className="ct-failed">
          <b>⏸️ وقف التوليد قبل ما يخلص.</b>
          <small> نكمّل نفس الطلبات كما هي، بدون ما تشرح من جديد.</small>
          <button type="button" className="ct-mini" onClick={onResume}>▶️ كمّل التوليد</button>
        </div>
      )}
      {items.map((x) => (
        <figure key={x.id} className={`ct-mediacard ${x.state}`}>
          <figcaption>
            <b>📨 محمد باقر سلّم الطلب لجواد</b>
            <span>{x.kind === "video" ? "🎞️ فيديو" : "🖼️ صورة"} «{x.name}» · {x.aspect}{x.refs?.length ? ` · 📎 ${x.refs.length} مرفق نقلها لجواد` : ""}</span>
            <small>
              {x.desk ? `${x.desk.generator} · ${x.desk.free ? "بلا رسوم عليك" : `${x.desk.coins} عملة`}` : "جواد يختار المولّد المناسب"} · {ST[x.state]}
            </small>
          </figcaption>
          {(x.state === "todo" || x.state === "running") && (
            <div className="ct-progress" role="status" aria-live="polite">
              <span className="ct-spin" aria-hidden />
              <small>{x.kind === "video" ? "الفيديو يأخذ دقائق عند جواد؛ لا تقفل الصفحة، وإن قفلتها تلقاه في «أعمالي».": "الصورة تأخذ نحو دقيقة."}</small>
            </div>
          )}
          {x.state === "done" && x.url && (x.kind === "video" ? <video src={x.url} controls playsInline preload="metadata" /> : <img src={x.url} alt={x.name} loading="lazy" />)}
          {x.state === "done" && x.download && <a className="ct-mini" href={x.download} download>⬇️ تحميل</a>}
          {x.state === "failed" && (
            <div className="ct-failed">
              ❌ {x.error ?? "تعذّر التوليد."}
              {owner && x.detail && <small dir="ltr"> {x.detail}</small>}
              <button type="button" className="ct-mini" disabled={busy} onClick={() => onRetry([x.id])}>أعد المحاولة</button>
            </div>
          )}
        </figure>
      ))}
    </div>
  );
}

/** After a drawing or a generation stopped (a wallet ran out, the network…): how to go on without losing the work. */
const STOPPED = "\n\nاللي انرسم محفوظ، والباقي ينتظر. بعد ما ينحل السبب (مثلًا يشحن صاحب الرصيد) اضغط «▶️ كمّل» تحت، أو اكتب «كمّل»: يكمل بنفس التصميم والشخصيات بدون ما تشرح من جديد.";

// the conversation that was open, and what was being typed in it, are kept on this device: leaving the page (to top up
// a wallet that ran out, a reload, a phone closing the tab) brings the person back to the same conversation with
// محمد باقر — never to an empty one that knows nothing (the owner, 28 October 2026)
const OPEN_KEY = "jw-content-open";
const VERBOSE_KEY = "jw-content-verbose";
const draftKey = (id: string | null) => `jw-content-draft:${id ?? "new"}`;
const UUID_RE = /^[0-9a-f-]{36}$/i;
/** a message that carries a pick of a gallery is changed by picking again (the chips), not by editing its words */
const PICK_MARK = /\[(?:قالب|ستايل|موشن|مزاج|ألوان|كاروسيل|خط|حركة):/;
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v) localStorage.setItem(k, v);
      else localStorage.removeItem(k);
    } catch {
      /* private window: kept for this page only */
    }
  },
};

export default function ContentChat({ name, persona, loginHref, owner }: { name: string; persona: string; loginHref: string | null; owner?: boolean }) {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  // the project's chat on screen: the first («🖼️ الصور», or the only one) or the second («✍️ الكتابة والموشن»)
  const [thread, setThread] = useState<"pictures" | "design">("pictures");
  const nextThread = useRef<"pictures" | "design" | null>(null);
  const reopenRef = useRef<(id: string) => Promise<void>>(async () => undefined);
  // «🗄️ خزان المراجع والثوابت»
  const [storeOpen, setStoreOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  // exactly what was taken from the wallet in THIS conversation so far (halalas, not an estimate); read back from
  // the server with the chat, so it survives a reload — 0 for a new one
  const [spent, setSpent] = useState(0);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<"" | "writing" | "producing">("");
  /** what the page is preparing before the message goes (a YouTube download, a video's frames) */
  const [prep, setPrep] = useState<string | null>(null);
  /** what «Claude Code» is doing on the slide it draws now */
  const [codeStep, setCodeStep] = useState<string | null>(null);
  /** the mind the person picked, for «Claude Code»'s drawing (read inside the produce loop) */
  const claudeId = useRef("");
  /** a new project opened before its first message (the greeting, the four paths and the box to write in) */
  const [newOpen, setNewOpen] = useState(false);
  /** the conversation being opened from the projects home */
  const [opening, setOpening] = useState<string | null>(null);
  /** «📚 المكتبة» open */
  const [libOpen, setLibOpen] = useState(false);
  /** the stage pressed on the rail (else the one the project is at) */
  const [picked, setPicked] = useState<StageKey | null>(null);
  /** each project's path on this device, for the icon on its card (the list carries only titles) */
  const [pathOf, setPathOf] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<FileView[]>([]);
  const [uploading, setUploading] = useState(false);
  const [gal, setGal] = useState<Galleries | null>(null);
  // «حوّله ريل» written: which carousel, and a count that starts its reel button
  const [reelGo, setReelGo] = useState<{ at: number; n: number }>({ at: -1, n: 0 });
  /** the path opened before the conversation began (its mark goes with the first message) */
  const [pathId, setPathId] = useState<string | null>(null);
  const [pathMenu, setPathMenu] = useState(false);
  /** the longer talk (the default is short, to cost less); remembered on this device */
  const [verbose, setVerbose] = useState(false);
  /** an old message being edited: the talk goes on from it */
  const [editFrom, setEditFrom] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  /** the conversation of the last visit has been reopened (until then nothing is written over it) */
  const restored = useRef(false);

  const refresh = useCallback(async () => {
    if (loginHref) return;
    try {
      setChats((await api<{ chats: ChatItem[] }>("/api/content/chats")).chats);
    } catch { /* the list is a convenience */ }
  }, [loginHref]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const t = window.setTimeout(() => setVerbose(store.get(VERBOSE_KEY) === "1"), 0);
    return () => window.clearTimeout(t);
  }, []);
  const toggleVerbose = () => setVerbose((v) => { store.set(VERBOSE_KEY, v ? null : "1"); return !v; });
  // the whole page scrolls now: it follows a new message (or his writing), and an update in place (a slide drawn) only
  // when the person is already at the end — never pulling them away from what they read higher up
  const seenLen = useRef(0);
  const seenBusy = useRef(busy);
  useEffect(() => {
    const grew = msgs.length !== seenLen.current || busy !== seenBusy.current;
    seenLen.current = msgs.length;
    seenBusy.current = busy;
    if (!msgs.length) return;
    const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 420;
    if (grew || atEnd) end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);
  useEffect(() => {
    try {
      setPathOf(JSON.parse(store.get(PATHS_KEY) ?? "{}") as Record<string, string>);
    } catch {
      /* nothing kept */
    }
  }, []);

  // the galleries load once, when a message first asks for one
  const wantsGallery = msgs.some((m) => m.questions?.some((x) => x.kind !== "choice"));
  useEffect(() => {
    if (!wantsGallery || gal || loginHref) return;
    api<Galleries>("/api/content/templates").then(setGal).catch(() => null);
  }, [wantsGallery, gal, loginHref]);

  /** The last answer that carries a carousel gets this block (the produce step reports into it). */
  const putSlides = (fn: (old: SlidesView | undefined) => SlidesView, at?: number) =>
    setMsgs((m) => {
      // the message the carousel is on (a project's first chat can be making a picture while the second has later slides)
      const i = typeof at === "number" && m[at]?.slides ? at : m.map((x) => !!x.slides).lastIndexOf(true);
      if (i < 0) return m;
      const copy = [...m];
      copy[i] = { ...copy[i], slides: fn(copy[i].slides) };
      return copy;
    });

  // one drawing loop per conversation: opening it again (the address, then the list) must not start a second one,
  // or both draw the same slide and the second is refused («هذي الشريحة مو بانتظار الرسم», 5 Nov 2026)
  const looping = useRef(new Set<string>());
  // «💡 وفّر رصيدك»: the ways to spend less, found on a real run (the owner, 17 Nov 2026)
  const [tips, setTips] = useState(false);

  /** The produce step: the server draws a few slides a call; this asks again while it says `running`. */
  const runProduce = useCallback(async (id: string, retry?: number[] | "failed", more?: Record<string, unknown>) => {
    if (looping.current.has(`p:${id}`)) return;
    looping.current.add(`p:${id}`);
    setBusy("producing");
    type Step = { spent?: number; aspect: string; slides: SlideView[]; todo: number[]; failed: FailView[]; running: boolean; total: number; report: string | null; phase?: "pictures" | "approve"; motion?: true; reopen?: true; at?: number; code?: { n: number; prompt: string; aspect: string; refs: string[]; photos?: string[]; style?: string; mix?: boolean; motion?: { seconds: number; style: string; first: boolean; total: number; voice?: { url: string; from: number; to: number; exact?: boolean } }; sfx?: Record<string, string>; stage?: "still" | "picture"; still?: { code: string; fonts: { head: string; body: string } }; light?: true; program?: { code: string; fonts: { head: string; body: string }; size: [number, number] }; change?: string; text?: string }; deferred?: number[] };
    const show = (r: Step) => putSlides((old) => ({ aspect: r.aspect || old?.aspect || "", items: r.slides, todo: r.todo, failed: r.failed, running: r.running, total: r.total, report: r.report ?? old?.report, phase: r.phase, deferred: r.deferred, ...(r.motion && !old?.motion ? { motion: true } : {}), ...(r.code || old?.maker === "code" ? { maker: "code" as const } : {}), ...(r.code?.mix || old?.mix ? { mix: true } : {}), ...(r.code?.motion || old?.motion ? { motion: r.code?.motion ?? old?.motion } : {}) }), r.at);
    // up to three slides at the same time (the owner, 17 Nov 2026: «سو الاسرع… شكله ٣»): each worker asks for a slide nobody
    // is drawing, draws it here and sends it back. The calls to the produce step go one at a time (the carousel is saved by
    // each), only the drawing itself runs side by side; the others start after slide 1 is done (it is the reference).
    const PARALLEL = 3;
    let chain: Promise<unknown> = Promise.resolve();
    const produceCall = (body: Record<string, unknown>) => {
      const run = chain.then(() => postJson<Step>("/api/content/produce", { chatId: id, ...body }));
      chain = run.catch(() => undefined);
      return run;
    };
    const busyNs = new Set<number>();
    const steps = new Map<number, string>();
    const showSteps = () => setCodeStep(steps.size ? [...steps.entries()].sort((a, b) => a[0] - b[0]).map(([k, t]) => `الشريحة ${k}: ${t}`).join(" · ") : null);
    const stepOf = (n: number, t: string | null) => {
      if (t) steps.set(n, t);
      else steps.delete(n);
      showSteps();
    };
    let stop = false;
    let fatal: unknown = null;
    let firstDone: () => void = () => undefined;
    const slideOneDone = new Promise<void>((res) => (firstDone = res));
    const take = (r: Step) => {
      show(r);
      if (typeof r.spent === "number") setSpent(r.spent);
    };
    /** Draws one slide here and returns what goes back to the produce step. */
    const drawSlide = async (code: NonNullable<Step["code"]>): Promise<Record<string, unknown>> => {
      const n = code.n;
      const refs = (await Promise.all(code.refs.map(smallJpeg))).filter((x): x is string => !!x);
      const motion = code.motion ? { n, ...code.motion, sfx: code.sfx } : null;
      // a motion carousel in two stages: first every slide's still (sent back with its program), then each still animated
      const stillStage = code.stage === "still";
      // a project's first chat: only the slide's picture, drawn in code with no writing (approved before the writing)
      const pictureStage = code.stage === "picture";
      const lighter = code.light === true;
      stepOf(n, lighter ? "↩️ رجعنا لها بطريقة أخف وأسرع…" : pictureStage ? "🖼️ يرسم صورتها بالكود (بدون كتابة)…" : stillStage ? "🖼️ المرحلة ١: تصميمها الثابت…" : code.still ? "🎬 المرحلة ٢: تحريك تصميمها الجاهز…" : "حيدرا ماكس يبدأ…");
      const extra = { ...(stillStage ? { stillFor: "motion" } : code.still ? { still: code.still.code, stillFonts: code.still.fonts } : {}), ...(lighter ? { light: true } : {}), ...(code.program ? { program: code.program } : {}), ...(code.program && code.change ? { change: code.change } : {}), ...(code.text && code.motion ? { expectText: code.text } : {}) };
      // each slide on its own (16 Nov 2026): a slide that cannot be drawn is recorded as failed and the others go on;
      // stopped by the person, or no balance left: everything stops as before
      try {
        const drawn = await drawWithCode({ prompt: code.prompt, aspect: code.aspect, style: code.style ?? "", references: refs, photos: code.photos ?? [], model: HAIDARA_MODEL, from: "content", motion, extra, onStep: (st) => stepOf(n, st.text), onProgram: (prog) => produceCall({ saveProgram: { n, ...prog } }) });
        let video: string | undefined;
        if (drawn.video) {
          stepOf(n, "⬆️ أرفع الفيديو…");
          video = await putVideo(drawn.video, `slide-${String(n).padStart(2, "0")}.mp4`);
        }
        return { n, ...(await pngBody(drawn.png)), rounds: drawn.rounds, scores: drawn.scores, ...(video ? { video } : {}), ...(stillStage ? { stage: "still", program: drawn.program?.code ?? "", fonts: drawn.program?.fonts ?? null } : pictureStage ? { stage: "picture" } : {}) };
      } catch (e) {
        const why = e instanceof Error ? e.message : "";
        if ((e instanceof Error && e.name === "AbortError") || /رصيد|اشحن|الاتصال|متصفحك/.test(why)) throw e;
        // each piece of work ends under 10 minutes (17 Nov 2026): a slide that runs past it is set aside and comes back last
        if (/تأخرت/.test(why) && !lighter) {
          stepOf(n, "⏭️ طوّلت أكثر من ٩ دقايق — نكمّل الباقي ونرجع لها في الآخر بطريقة أخف");
          return { deferSlide: n };
        }
        stepOf(n, "⚠️ ما انرسمت — تقدر تعيدها لحالها بزر «أعد المحاولة»");
        return { n, codeFailed: why || "ما انرسمت" };
      } finally {
        stepOf(n, null);
      }
    };
    const worker = async (initial?: Step) => {
      let cur: Step | undefined = initial;
      for (let guard = 0; guard < 120 && !stop; guard++) {
        if (!cur) cur = await produceCall({ exclude: [...busyNs] });
        take(cur);
        if (!cur.code || busyNs.has(cur.code.n)) {
          if (!cur.running) stop = true;
          // nothing free right now: while other slides are drawn this worker ends; alone (the pictures stage), it asks again
          if (stop || busyNs.size > 0) return;
          cur = undefined;
          continue;
        }
        const n = cur.code.n;
        busyNs.add(n);
        let body: Record<string, unknown>;
        try {
          body = await drawSlide(cur.code);
        } catch (e) {
          fatal = e;
          stop = true;
          busyNs.delete(n);
          return;
        }
        busyNs.delete(n);
        cur = await produceCall(body);
        take(cur);
        if (n === 1 || body.deferSlide) firstDone();
        if (!cur.running) {
          stop = true;
          return;
        }
        cur = undefined;
      }
    };
    let reopen = false;
    try {
      const r0 = await produceCall({ ...(retry ? { retry } : {}), ...(more ? more : {}) });
      // the project's chats changed (the pictures handed to the second chat, or a picture being made again in the
      // first): the conversation is opened again and the making goes on there
      if (r0.reopen) {
        reopen = true;
        nextThread.current = more?.approvePictures ? "design" : "pictures";
        return;
      }
      take(r0);
      const one = worker(r0);
      // the others join once slide 1 is drawn (straight away when slide 1 is not the one being drawn first)
      if (!r0.code || r0.code.n !== 1) firstDone();
      void one.finally(() => firstDone());
      const helpers = slideOneDone.then(() => (stop ? [] : Promise.all(Array.from({ length: PARALLEL - 1 }, () => worker()))));
      await Promise.all([one, helpers]);
      if (fatal) throw fatal;
      setCodeStep(null);
    } catch (e) {
      setCodeStep(null);
      putSlides((old) => ({ ...(old ?? { aspect: "", items: [], failed: [], total: 0 }), todo: old?.todo ?? [], running: false } as SlidesView));
      setMsgs((m) => [...m, { role: "assistant", text: `${e instanceof Error ? e.message : "تعذّر إنتاج الشرائح."}${STOPPED}`, error: true }]);
    } finally {
      looping.current.delete(`p:${id}`);
      setBusy("");
      if (reopen) void reopenRef.current(id);
    }
  }, []);

  /** The media step: جواد takes what «محمد باقر» handed him; this asks again while he works (a video takes minutes). */
  const runMedia = useCallback(async (id: string, retry?: string[] | "failed") => {
    if (looping.current.has(`m:${id}`)) return;
    looping.current.add(`m:${id}`);
    setBusy("producing");
    let first = true;
    const put = (items: MediaView[]) =>
      setMsgs((m) => {
        const i = m.map((x) => !!x.media).lastIndexOf(true);
        if (i < 0) return m;
        const copy = [...m];
        copy[i] = { ...copy[i], media: { items } };
        return copy;
      });
    try {
      for (let guard = 0; guard < 120; guard++) {
        const r = await postJson<{ items: MediaView[]; running: boolean; spent?: number }>("/api/content/generate", { chatId: id, ...(first && retry ? { retry } : {}) });
        first = false;
        put(r.items);
        if (typeof r.spent === "number") setSpent(r.spent);
        if (!r.running) break;
        await new Promise((res) => setTimeout(res, r.items.some((x) => x.kind === "video" && x.state === "running") ? 8000 : 1500));
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: `${e instanceof Error ? e.message : "تعذّر التوليد."}${STOPPED}`, error: true }]);
    } finally {
      looping.current.delete(`m:${id}`);
      setBusy("");
    }
  }, []);

  async function open(id: string, quiet = false) {
    setPathId(null);
    setPicked(null);
    setOpening(id);
    setPathMenu(false);
    setEditFrom(null);
    try {
      const r = await api<{ chat: { id: string; messages: Msg[]; pending: Pending | null; spent?: number } }>(`/api/content/chats?id=${id}`);
      setChatId(r.chat.id);
      setMsgs(r.chat.messages);
      // the chat asked for (after a handoff), else the one the project's last message is in
      const saved = r.chat.messages.filter((m) => !m.error);
      setThread(nextThread.current ?? (saved[saved.length - 1]?.thread === "design" ? "design" : "pictures"));
      nextThread.current = null;
      setSpent(Math.max(0, Number(r.chat.spent) || 0));
      setQ(store.get(draftKey(r.chat.id)) ?? "");
      // a carousel ordered before the page was left: drawn on from where it stopped
      if (r.chat.pending) void runProduce(r.chat.id);
      // pictures or videos still with جواد: followed on from where they stand
      else if (r.chat.messages.some((m) => m.media?.items.some((x) => x.state === "todo" || x.state === "running"))) void runMedia(r.chat.id);
    } catch (e) {
      // the conversation kept from the last visit is gone (deleted): start clean, without an error
      if (quiet) {
        store.set(OPEN_KEY, null);
        return;
      }
      setMsgs([{ role: "assistant", text: e instanceof Error ? e.message : "تعذّر فتح المحادثة.", error: true }]);
    } finally {
      setOpening(null);
    }
  }
  reopenRef.current = (id: string) => open(id, true);
  const fresh = () => { setThread("pictures"); setStoreOpen(false); setLibOpen(false); setPicked(null); setNewOpen(false); setPathId(null); setPathMenu(false); setEditFrom(null); setChatId(null); setMsgs([]); setQ(store.get(draftKey(null)) ?? ""); setPending([]); setSpent(0); };
  /** «＋ مشروع جديد»: an empty project (the four paths, or write to him straight away) */
  const newProject = () => { fresh(); setNewOpen(true); window.scrollTo({ top: 0 }); };
  /** «← مشاريعي»: back to the projects home */
  const home = () => { fresh(); void refresh(); window.scrollTo({ top: 0 }); };

  // back on the page: the conversation of the address (?chat=) or of the last visit opens again
  useEffect(() => {
    if (loginHref) return;
    const t = window.setTimeout(() => {
      const fromUrl = new URLSearchParams(window.location.search).get("chat");
      const id = [fromUrl, store.get(OPEN_KEY)].find((x): x is string => !!x && UUID_RE.test(x));
      restored.current = true;
      if (id) void open(id, true);
      else setQ(store.get(draftKey(null)) ?? "");
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginHref]);
  // the open conversation is remembered (and in the address, so a reload or a shared tab comes back to it)
  useEffect(() => {
    if (!restored.current) return;
    store.set(OPEN_KEY, chatId);
    const url = new URL(window.location.href);
    if (chatId) url.searchParams.set("chat", chatId);
    else url.searchParams.delete("chat");
    window.history.replaceState(window.history.state, "", url);
  }, [chatId]);
  // what is being typed is kept with its conversation
  useEffect(() => {
    if (restored.current) store.set(draftKey(chatId), q.trim() ? q : null);
  }, [q, chatId]);

  async function attach(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, JAWAD_ATTACHMENT_LIMIT - pending.length)) {
        try {
          const probe = await probeFile(file);
          const signed = await postJson<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: probe.kind, mime: probe.mime, bytes: file.size, fileName: file.name });
          await putWithProgress(signed.signedUrl, file, probe.mime, () => {});
          const conf = await postJson<{ upload: { id: string; status: string; error: string | null; url: string | null } }>("/api/jawad/uploads/confirm", { id: signed.id });
          if (conf.upload?.status !== "ready") throw new Error(conf.upload?.error ?? "تعذّر فحص الملف.");
          setPending((p) => [...p, { id: conf.upload.id, kind: probe.kind, name: file.name, durationMs: probe.durationMs, url: conf.upload.url }]);
          // a video: its frames go with it as one sheet he looks at (its sound is heard on the server)
          if (probe.kind === "video") {
            const local = URL.createObjectURL(file);
            const sheet = await sheetOf(local, file.name).finally(() => URL.revokeObjectURL(local));
            if (sheet) setPending((p) => [...p, sheet]);
          }
        } catch (e) {
          setMsgs((m) => [...m, { role: "assistant", text: `${file.name}: ${e instanceof Error ? e.message : "تعذّر الرفع."}`, error: true }]);
        }
      }
    } finally {
      setUploading(false);
      if (picker.current) picker.current.value = "";
    }
  }

  const [claude] = useClaudeModel(CONTENT_CLAUDE_MODEL);
  useEffect(() => {
    claudeId.current = claude.id;
  }, [claude.id]);

  /** A path opened: its first questions appear at once (written here, so opening one costs nothing); the person answers by a press or by writing. */
  function openPath(path: ContentPath) {
    setPathId(path.id);
    setPathMenu(false);
    setMsgs([{ role: "assistant", text: path.opening, questions: path.first, local: true }]);
    window.setTimeout(() => box.current?.focus(), 0);
  }
  /** Another path in the middle of the talk: its mark goes with the message, and the last mark wins. */
  function switchPath(path: ContentPath) {
    setPathMenu(false);
    if (!chatId) openPath(path);
    else void send(pathLine(path.id, `خلنا نحوّل إلى مسار «${path.name}»`));
  }
  function startEdit(i: number) {
    const m = msgs[i];
    if (!m || busy) return;
    setEditFrom(i);
    setQ(stripMarks(m.text).replace("(ملفات مرفقة)", "").trim());
    setPending(m.files ?? []);
    box.current?.focus();
  }
  function cancelEdit() {
    setEditFrom(null);
    setQ("");
    setPending([]);
  }

  async function send(text = q) {
    const typed = text.trim();
    if ((!typed && !pending.length) || busy || uploading) return;
    // a page button asked in words (the reel, downloading the slides): done here, like the press, with no paid reply
    const act = !pending.length && editFrom == null ? pageAction(typed) : null;
    const lastAt = act ? msgs.map((x, i) => (x.slides && !x.slides.running && x.slides.items.length ? i : -1)).filter((i) => i >= 0).at(-1) ?? -1 : -1;
    if (act && lastAt >= 0) {
      const items = msgs[lastAt].slides!.items;
      setQ("");
      const say = act === "reel" ? (items.length > 1 ? "تمام، أجمع الشرائح الحين في ريل واحد بصوتها 🎬 — يتحمّل عندك أول ما يخلص (تحت الشرائح تشوف النسبة)." : "الريل يحتاج شريحتين أو أكثر.") : `تمام، أحمّل لك الشرائح (${items.length}) ⬇️`;
      setMsgs((m) => [...m, { role: "user", text: typed, local: true }, { role: "assistant", text: say, local: true }]);
      if (act === "reel" && items.length > 1) setReelGo((v) => ({ at: lastAt, n: v.n + 1 }));
      if (act === "download") downloadAll(items);
      return;
    }
    const files = [...pending];
    // the first message of a path carries its mark; an edited old message keeps the mark it had, and the talk goes on from there
    const editing = editFrom;
    const keepPath = editing != null ? (msgs[editing]?.text.match(/\[مسار:[a-z0-9-]+\]/)?.[0] ?? "") : "";
    const message = editing != null ? `${typed} ${keepPath}`.trim() : !chatId && pathId ? pathLine(pathId, typed || "(ملفات مرفقة)") : typed;
    const from = editing != null ? msgs.slice(0, editing).filter((x) => !x.local && !x.error).length : undefined;
    const before = msgs;
    setQ("");
    setPending([]);
    setEditFrom(null);
    setBusy("writing");
    const inDesign = thread === "design" && msgs.some((x) => x.thread === "design");
    const mine: Msg = { role: "user", text: message || "(ملفات مرفقة)", files: files.length ? files : undefined, ...(inDesign ? { thread: "design" as const } : {}) };
    setMsgs((m) => (editing != null ? [...m.slice(0, editing), mine] : [...m, mine]));
    let produceId: string | null = null;
    let reopenId: string | null = null;
    let mediaId: string | null = null;
    let dlNote = "";
    try {
      // a YouTube link: downloaded first (the video, its sound and its frames), like Claude does it, and attached
      for (const link of editing == null ? youtubeLinks(typed) : []) {
        try {
          const got = await downloadYoutube(link, setPrep, { frames: !soundOnlyAsk(typed) });
          if (got?.length) {
            files.push(...got.filter((g) => !files.some((f) => f.id === g.id)).slice(0, Math.max(0, JAWAD_ATTACHMENT_LIMIT - files.length)));
            // the person's message (the last one) shows what was downloaded
            setMsgs((m) => m.map((x, i) => (i === m.length - 1 && x.role === "user" ? { ...x, files: [...files] } : x)));
          }
        } catch (e) {
          dlNote = `${e instanceof Error ? e.message : "ما قدرنا ننزّل الفيديو."} ${persona} سمع كلامه من الرابط بس.`;
        } finally {
          setPrep(null);
        }
      }
      const r = await postJson<{ chatId: string; text: string; questions: Question[] | null; pending: Pending | null; editor: { id: string; title: string; lab?: string } | null; media: MediaView[] | null; spent?: number; reopen?: boolean }>("/api/content/chat", { chatId, message, ...(inDesign ? { thread: "design" } : {}), attachments: files.map((f) => f.id), model: claude.id, verbose, ...(from !== undefined ? { from } : {}) });
      setChatId(r.chatId);
      setSpent(Math.max(0, Number(r.spent) || 0));
      setMsgs((m) => {
        const copy = [...m];
        const reply: Msg = { role: "assistant", text: r.text, questions: r.questions ?? undefined, editor: r.editor ?? undefined, ...(r.media ? { media: { items: r.media } } : {}), ...(inDesign ? { thread: "design" as const } : {}) };
        // a new carousel: the placeholders of its slides appear at once; a fix: the slides being redrawn are marked
        if (r.pending?.mode === "all") reply.slides = { aspect: "", items: [], todo: r.pending.todo, failed: [], running: true, total: r.pending.total };
        if (r.pending?.mode === "fix") {
          const i = copy.map((x) => !!x.slides).lastIndexOf(true);
          if (i >= 0) copy[i] = { ...copy[i], slides: { ...copy[i].slides!, todo: r.pending.todo, running: true, report: undefined } };
        }
        return [...copy, ...(dlNote ? [{ role: "assistant" as const, text: dlNote, error: true }] : []), reply];
      });
      void refresh();
      // the pictures were approved in words and handed on (or a picture is being made again): opened again, there
      if (r.reopen) {
        nextThread.current = inDesign ? "pictures" : /اعتمد|كمل|كمّل/.test(typed) ? "design" : "pictures";
        reopenId = r.chatId;
      } else if (r.pending) produceId = r.chatId;
      else if (r.media) mediaId = r.chatId;
    } catch (e) {
      // not answered (the wallet ran out, the network…): the message goes back into the box with its files, ready to
      // send again — the conversation itself stays as it was on the server
      setQ((now) => now || typed);
      if (editing != null) setEditFrom(editing);
      setPending((now) => (now.length ? now : files));
      setMsgs((m) => [
        ...(editing != null ? before : m.slice(0, -1)),
        { role: "assistant", text: `${e instanceof Error ? e.message : "تعذّر الرد."}\n\nرسالتك رجعت في الخانة تحت، والمحادثة محفوظة كما هي: ${e instanceof Error && /رصيد/.test(e.message) ? "اشحن وارجع لهنا، وأرسلها" : "أرسلها مرة ثانية"} ويكمل محمد باقر من نفس المكان.`, error: true },
      ]);
    } finally {
      setBusy("");
    }
    if (reopenId) await open(reopenId, true);
    else if (produceId) await runProduce(produceId);
    else if (mediaId) await runMedia(mediaId);
  }

  async function remove(id: string) {
    if (!confirm("نحذف هذا المشروع بمحادثاته وصوره وخزانه؟")) return;
    await fetch(`/api/content/chats?id=${id}`, { method: "DELETE" }).catch(() => null);
    if (id === chatId) fresh();
    void refresh();
  }

  const downloadAll = (items: SlideView[]) => {
    items.forEach((s, i) => {
      // a motion slide downloads as its video
      const href = s.videoDownload ?? s.download;
      if (!href) return;
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = href;
        a.download = `${s.name}.${s.videoDownload ? "mp4" : "png"}`;
        a.click();
      }, i * 400);
    });
  };

  // a project of two chats: each shows its own messages (what is written here only, errors in both)
  const twoChats = msgs.some((x) => x.thread === "design");
  const shown = (m: Msg) => !twoChats || m.error || m.local || (thread === "design") === (m.thread === "design");
  const lastAssistant = msgs.map((x) => (shown(x) ? x.role : "")).lastIndexOf("assistant");
  // what they decided so far, from the marks of their messages (the path opened but not yet sent counts too)
  const decisions = (() => {
    const d = decisionsOf(msgs.filter((m) => m.role === "user").map((m) => m.text));
    const open = findPath(pathId);
    return !d.some((x) => x.key === "path") && open ? [{ key: "path" as const, label: "المسار", name: open.name, id: open.id, change: "" }, ...d] : d;
  })();
  const pathKey = decisions.find((d) => d.key === "path")?.id ?? null;
  const path = findPath(pathKey);

  // the project's path is kept on this device, for the icon on its card in the projects home
  useEffect(() => {
    if (!chatId || !pathKey) return;
    setPathOf((m) => {
      if (m[chatId] === pathKey) return m;
      const next = { ...m, [chatId]: pathKey };
      store.set(PATHS_KEY, JSON.stringify(next));
      return next;
    });
  }, [chatId, pathKey]);

  // the stages on the rail, the one on screen, and the ring
  const stages = stagesOf(msgs, pathKey);
  const now = stages.find((x) => x.state === "open")?.key ?? stages.filter((x) => x.state !== "locked").at(-1)?.key ?? "idea";
  const viewKey: StageKey = picked && stages.some((x) => x.key === picked) ? picked : twoChats ? (thread === "design" ? (now === "delivery" ? "delivery" : "design") : now === "idea" ? "idea" : "pictures") : now;
  const percent = Math.round((stages.filter((x) => x.state === "done").length / stages.length) * 100);
  const title = chats.find((c) => c.id === chatId)?.title ?? (path ? `مشروع ${path.name}` : "مشروع جديد");
  const inProject = !loginHref && (chatId !== null || msgs.length > 0 || newOpen);

  /** After the next paint: the last carousel (or edit room) shown, the top of the talk, or its end. */
  const scrollSoon = (to: "top" | "slides" | "editor" | "end") =>
    window.setTimeout(() => {
      const all = root.current?.querySelectorAll<HTMLElement>(to === "editor" ? "[data-editor]" : "[data-slides]");
      const target = to === "top" ? root.current?.querySelector<HTMLElement>(".ct-rail") : to === "end" ? end.current : all?.[all.length - 1] ?? end.current;
      target?.scrollIntoView({ behavior: "smooth", block: to === "top" ? "start" : "end" });
    }, 60);
  /** A stage pressed: the chat it lives in, and the place in it. */
  function goStage(k: StageKey) {
    setPicked(k);
    if (k === "idea") {
      setThread("pictures");
      scrollSoon("top");
    } else if (k === "pictures") {
      setThread("pictures");
      scrollSoon("end");
    } else if (k === "design") {
      if (twoChats) {
        setThread("design");
        scrollSoon("end");
      } else scrollSoon("slides");
    } else if (k === "delivery") {
      if (twoChats) setThread("design");
      scrollSoon("slides");
    } else scrollSoon("editor");
  }

  if (!inProject)
    return (
      <div className="ct" ref={root}>
        <div className="ct-home">
          <header className="ct-hero">
            <p className="ct-kicker">صانع المحتوى · {persona}</p>
            <h1>{name}</h1>
            <p>كاروسيل ثابت أو متحرك، موشن جرافكس، أو نصوص ريلز: كل مشروع بمحادثاته وصوره وخزانه، وتكمّله متى ما تبي.</p>
          </header>

          {loginHref ? (
            <div className="ct-msg bot ct-login">
              <p>سجّل دخولك عشان تتكلم مع {persona}.</p>
              <div className="ct-actions"><Link className="ct-btn" href={loginHref}>تسجيل الدخول</Link></div>
            </div>
          ) : (
            <>
              <section className="ct-home-start" aria-labelledby="ct-start-h">
                <h2 id="ct-start-h" className="ct-group">ابدأ مشروع</h2>
                <div className="ct-home-row">
                  <button type="button" className="ct-project-new" onClick={newProject}>
                    <span className="ic" aria-hidden>＋</span>
                    <b>مشروع جديد</b>
                    <small>اختر مسارًا، أو اكتب لـ{persona} مباشرة (سكربت ريل، عناوين، إعادة توظيف…)</small>
                  </button>
                  <div className="ct-start">
                    {CONTENT_PATHS.map((x, i) => (
                      <button key={x.id} type="button" className="ct-card" style={{ ["--c" as string]: x.color, animationDelay: `${i * 70}ms` }} onClick={() => openPath(x)}>
                        <span className="ic">{x.ic}</span>
                        <b>{x.name}</b>
                        <small>{x.short}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section aria-labelledby="ct-mine-h">
                <h2 id="ct-mine-h" className="ct-group">مشاريعي {chats.length > 0 && <small>({chats.length.toLocaleString("ar")})</small>}</h2>
                {chats.length ? (
                  <div className="ct-projects">
                    {chats.map((c, i) => {
                      const p = findPath(pathOf[c.id] ?? null);
                      return (
                        <div key={c.id} className="ct-project" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                          <button type="button" className="ct-project-open" onClick={() => void open(c.id)} disabled={opening !== null} aria-busy={opening === c.id || undefined}>
                            <span className="ic" aria-hidden>{opening === c.id ? "⏳" : (p?.ic ?? "📁")}</span>
                            {p && <span className="st">{p.name}</span>}
                            <b>{c.title}</b>
                            {c.updatedAt && <small>آخر تعديل {new Date(c.updatedAt).toLocaleDateString("ar-SA")}</small>}
                          </button>
                          <button type="button" className="ct-project-x" aria-label={`احذف ${c.title}`} title="احذف المشروع" onClick={() => void remove(c.id)}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="ct-empty">ما عندك مشاريع للحين. ابدأ «مشروع جديد» أو اختر مسار فوق، ومشاريعك تطلع هنا: كل مشروع بمحادثاته وخزانه.</p>
                )}
              </section>
            </>
          )}
          <Link href="/jawad-ai" className="ct-btn-ghost">← الرئيسية</Link>
        </div>
      </div>
    );

  return (
    <div className="ct" ref={root}>
      <div className="ct-proj">
        <header className="ct-top ct-panel">
          <button type="button" className="ct-back" onClick={home} aria-label="رجوع لمشاريعي">← <span>مشاريعي</span></button>
          <Ring percent={percent} busy={!!busy} />
          <div className="ct-top-title">
            <span className="ct-kicker">{path ? `${path.ic} ${path.name}` : name}</span>
            <h1 title={title}>{title}</h1>
            <p>
              {spent > 0 ? <>💰 قيمة هذي المحادثة <Coined text={coinStr(spent)} size={12} /></> : `تكلّم مع ${persona}`}
              {busy === "producing" ? " · ⏳ يشتغل الحين" : ""}
            </p>
          </div>
          <button type="button" className="ct-tool" aria-pressed={libOpen} onClick={() => setLibOpen(true)} title="كل صورة وشريحة وفيديو في المشروع">
            📚 <span>المكتبة</span>
          </button>
          <button type="button" className="ct-tool" aria-pressed={storeOpen} disabled={!chatId} onClick={() => setStoreOpen(true)} title={chatId ? "خزان المراجع والثوابت" : "يفتح بعد أول رسالة"}>
            🗄️ <span>الخزان</span>
          </button>
        </header>
        {storeOpen && chatId && <StorePanel chatId={chatId} onClose={() => setStoreOpen(false)} />}
        {libOpen && <ContentLibrary msgs={msgs} onClose={() => setLibOpen(false)} />}

        {(chatId || msgs.length > 0) && (
          <nav className="ct-rail ct-panel" aria-label="مراحل المشروع">
            {stages.map((x, i) => (
              <button
                key={x.key}
                type="button"
                className="ct-stage"
                aria-current={viewKey === x.key ? "step" : undefined}
                data-done={x.state === "done" || undefined}
                data-ask={x.ask || undefined}
                disabled={x.state === "locked"}
                title={x.state === "locked" ? "تفتح بعد ما تخلص اللي قبلها" : x.ask ? "ينتظرك" : undefined}
                onClick={() => goStage(x.key)}
              >
                <span className="n">{x.state === "locked" ? "🔒" : x.state === "done" ? "✓" : DIGITS[i]}</span>
                <b>{x.label}</b>
              </button>
            ))}
          </nav>
        )}

        {decisions.length > 0 && (
          <div className="ct-decs" role="group" aria-label="قراراتك (اضغط أي واحد لتغيّره)">
            {decisions.map((d) => (
              <button key={d.key} type="button" className="ct-dec" disabled={!!busy} onClick={() => (d.key === "path" ? setPathMenu((v) => !v) : void send(d.change))} title="غيّره">
                {d.label}: <b>{d.name}</b> ✎
              </button>
            ))}
            {pathMenu && (
              <div className="ct-pathmenu" role="menu">
                {CONTENT_PATHS.map((x) => (
                  <button key={x.id} type="button" role="menuitem" className="ct-mini" onClick={() => switchPath(x)}>{x.ic} {x.name}</button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="ct-feed">
          {msgs.length === 0 ? (
            <>
              <div className="ct-msg bot">
                <span className="ct-who">✍️ {persona}</span>
                <h3>أهلًا، أنا {persona} ✍️</h3>
                <p>اختر مسارك: أسألك أقل ما يمكن، وتجاوب بضغطة أو بكلامك، وتقدر تغيّر أي قرار في أي لحظة. ولو تبي سكربت ريل أو عناوين أو إعادة توظيف، اكتب لي مباشرة.</p>
              </div>
              <div className="ct-start">
                {CONTENT_PATHS.map((x, i) => (
                  <button key={x.id} type="button" className="ct-card" style={{ ["--c" as string]: x.color, animationDelay: `${i * 90}ms` }} onClick={() => openPath(x)}>
                    <span className="ic">{x.ic}</span>
                    <b>{x.name}</b>
                    <small>{x.short}</small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            msgs.map((m, i) => {
              if (!shown(m)) return null;
              const bot = m.role === "assistant";
              // the card that waits for the person: his last questions, or pictures to approve
              const waits = bot && !m.error && ((i === lastAssistant && !!m.questions?.length && !busy) || (m.slides?.phase === "approve" && !m.slides.running));
              const wide = !!m.slides || !!m.media || !!m.questions?.some((x) => x.kind !== "choice");
              return (
                <div
                  key={i}
                  className={`ct-msg ${bot ? "bot" : "user"} ${m.error ? "err" : ""} ${m.handoff ? "handoff" : ""} ${waits ? "wait" : ""} ${wide ? "wide" : ""}`}
                  data-slides={m.slides ? "" : undefined}
                  data-editor={m.editor ? "" : undefined}
                >
                  {bot && !m.error && <span className="ct-who">{m.handoff ? "📨 التسليم من محادثة الصور" : waits ? `👉 ${persona} ينتظرك` : `✍️ ${persona}`}</span>}
                  {m.role === "user" ? <p style={{ whiteSpace: "pre-wrap" }}>{stripMarks(m.text)}</p> : m.error ? <Rich text={m.text} /> : <Answer text={m.text} />}
                  {m.files && m.files.length > 0 && (
                    <div className="ct-files">
                      {m.files.map((f) => (
                        <span key={f.id} className="ct-file">
                          {f.kind === "image" && f.url ? <img src={f.url} alt="" /> : <span>{KIND_IC[f.kind]}</span>}
                          {f.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.slides && (
                    <SlidesBox
                      s={m.slides}
                      busy={!!busy}
                      owner={!!owner}
                      onRetry={(ns) => chatId && void runProduce(chatId, ns)}
                      onDownloadAll={() => downloadAll(m.slides!.items)}
                      onResume={() => chatId && void runProduce(chatId)}
                      onApprove={() => chatId && void runProduce(chatId, undefined, { approvePictures: true })}
                      onRedoPicture={(n, note) => chatId && void runProduce(chatId, undefined, { redoPicture: n, note })}
                      onChangeApproved={m.slides.approved && thread === "pictures" ? (n, note) => chatId && void runProduce(chatId, undefined, { redoApproved: { n, note } }) : undefined}
                      onEditSlide={(ns, said) => chatId && void runProduce(chatId, undefined, { editSlide: { ns, said } })}
                      fonts={gal?.fonts}
                      reelGo={reelGo.at === i ? reelGo.n : 0}
                      onSoundTime={(n, from, to, retext) => chatId && void runProduce(chatId, undefined, { soundTime: { n, from, to, ...(retext ? { retext: true } : {}) } })}
                      step={codeStep}
                    />
                  )}
                  {m.media && <MediaBox items={m.media.items} busy={!!busy} owner={!!owner} onRetry={(ids) => chatId && void runMedia(chatId, ids)} onResume={() => chatId && void runMedia(chatId)} />}
                  {m.editor && (
                    <div className="ct-actions">
                      <Link className="ct-btn" href={`/jawad-ai/editor/${m.editor.id}${m.editor.lab ? `?lab=${m.editor.lab}` : ""}`}>{m.editor.lab ? `🎬 افتح «${m.editor.title}» في مختبر الموشن` : `🎬 افتح غرفة المونتاج «${m.editor.title}» مع حيدرا ماكس`}</Link>
                    </div>
                  )}
                  {i === lastAssistant && !busy && m.questions?.length ? (
                    <Questions key={`q${i}-${msgs.length}`} questions={m.questions} gal={gal} styleId={styleBefore(msgs, i)} disabled={!!busy} onSend={(t) => void send([q.trim(), t].filter(Boolean).join("\n"))} onWrite={() => box.current?.focus()} />
                  ) : null}
                  {bot && !m.error && !m.local && (
                    <div className="ct-actions"><button className="ct-mini" onClick={() => navigator.clipboard?.writeText(m.text).catch(() => null)}>انسخ</button></div>
                  )}
                  {m.role === "user" && !busy && !PICK_MARK.test(m.text) && (
                    <div className="ct-actions"><button className="ct-mini" onClick={() => startEdit(i)}>✏️ عدّل</button></div>
                  )}
                </div>
              );
            })
          )}
          {busy === "writing" && (
            <div className="ct-think">
              <span className="ct-dots"><span /><span /><span /></span>
              {prep ?? `${persona} يكتب…`}
            </div>
          )}
        </div>

        <form className="ct-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          {pending.length > 0 && (
            <div className="ct-pending">
              {pending.map((f) => (
                <span key={f.id} className="ct-file">
                  {f.kind === "image" && f.url ? <img src={f.url} alt="" /> : <span>{KIND_IC[f.kind]}</span>}
                  {f.name}
                  <button type="button" aria-label="أزل" onClick={() => setPending((p) => p.filter((x) => x.id !== f.id))}>✕</button>
                </span>
              ))}
            </div>
          )}
          {editFrom != null && (
            <div className="ct-editbar">
              ✏️ تعدّل رسالتك: المحادثة ترجع من هنا وتنحذف الردود اللي بعدها.
              <button type="button" className="ct-mini" onClick={cancelEdit}>إلغاء</button>
            </div>
          )}
          <div className="ct-compose-opts">
            <ClaudeModelPicker className="ct-claude" disabled={!!busy} spent={spent} fallback={CONTENT_CLAUDE_MODEL} />
            <button type="button" className={`ct-mini ct-verbose${verbose ? " on" : ""}`} aria-pressed={verbose} onClick={toggleVerbose} title="الافتراضي مختصر لتوفير رصيدك؛ المفصّلة فيها شرح وبدائل وأسئلة أعمق">
              {verbose ? "📝 محادثة مفصّلة ✓" : "📝 خلّها مفصّلة"}
            </button>
            <button type="button" className={`ct-mini${tips ? " on" : ""}`} aria-expanded={tips} onClick={() => setTips((v) => !v)}>💡 وفّر رصيدك</button>
          </div>
          {tips && (
            <div className="ct-tips" role="note">
              <b>💡 كيف توفّر رصيدك في صانع المحتوى</b>
              <ul>
                {SAVING_TIPS.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="ct-compose-row">
            <input ref={picker} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.oga,.flac,.amr,.aif,.aiff,.webm,application/pdf" onChange={(e) => void attach(e.target.files)} />
            <button type="button" className="ct-attach" aria-label="أرفق حتى 20 ملفًا" title="أرفق حتى 20 صورة أو فيديو أو صوت أو PDF" disabled={uploading || !!busy || pending.length >= JAWAD_ATTACHMENT_LIMIT} onClick={() => picker.current?.click()}>{uploading ? "…" : "📎"}</button>
            <MicButton onText={(t) => setQ((v) => (v.trim() ? `${v.trim()} ${t}` : t))} disabled={!!busy || uploading} className="ct-attach" />
            <textarea
              ref={box}
              className="ct-input"
              dir="auto"
              rows={1}
              value={q}
              maxLength={8000}
              placeholder={busy === "producing" ? "الشرائح قيد الرسم…" : !chatId && pathId ? "اكتب فكرتك أو الصق نصك هنا…" : `اكتب لـ${persona}…`}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
            />
            <button className="ct-send" disabled={!!busy || uploading || (!q.trim() && !pending.length)}>{busy ? "…" : "أرسل"}</button>
          </div>
        </form>
        <div ref={end} className="ct-end" />
      </div>
    </div>
  );
}
