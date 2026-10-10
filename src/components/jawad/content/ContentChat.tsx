"use client";

// «صانع المحتوى» — the desk and the conversation with «محمد باقر»: chats on the side, cards to start from, his
// questions as buttons (and the two galleries: carousel templates and the 24 cartoon styles), the messages with the
// person's attachments, the carousel's slides appearing as they are drawn (each downloadable, each with its check and
// a way to draw it again), and the edit rooms he opens in «حيدرة كت». The look is content.css.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import ClaudeModelPicker from "@/components/robots/ClaudeModelPicker";
import MicButton from "@/components/robots/MicButton";
import { useClaudeModel } from "@/components/robots/claude-model";
import { api, postJson } from "@/lib/fetch";
import { probeFile, putWithProgress } from "@/components/jawad/studio/upload";
import QuickReplies, { Swatches } from "@/components/jawad/QuickReplies";
import { answerLine, DELEGATE_LINE, moodLine, motionLine, stripMarks, styleLine, templateLine } from "@/lib/content/marks";

interface FileView { id: string; kind: "image" | "video" | "audio" | "doc"; name: string; durationMs: number | null; url?: string | null }
interface SlideView { n: number; fileId: string; name: string; text: string; url: string | null; download: string | null; flag?: string; fixed?: boolean }
interface FailView { n: number; reason: string; detail?: string; text: string }
interface SlidesView { aspect: string; items: SlideView[]; todo: number[]; failed: FailView[]; running: boolean; total: number; report?: string }
interface MediaView {
  id: string; kind: "image" | "video"; name: string; aspect: string; refs?: string[]; state: "todo" | "running" | "done" | "failed";
  url?: string | null; download?: string | null; error?: string; detail?: string; transient?: boolean; tries?: number;
  desk?: { generator: string; coins: number; free: boolean };
}
interface Question { label: string; kind: "choice" | "templates" | "styles" | "motion" | "moods"; options: string[]; multi: boolean }
interface Msg {
  role: "user" | "assistant";
  text: string;
  files?: FileView[];
  questions?: Question[];
  slides?: SlidesView;
  media?: { items: MediaView[] };
  editor?: { id: string; title: string };
  error?: boolean;
}
interface ChatItem { id: string; title: string }
interface Pending { total: number; mode: "all" | "fix"; todo: number[] }
interface Palette { name: string; bg: string; text: string; primary: string; accent: string }
interface GalleryItem { id: string; group: string; name: string; description: string; bestFor: string; image: string | null; icon?: string; palettes?: Palette[]; structures?: string[] }
interface Galleries { templates: GalleryItem[]; styles: GalleryItem[]; motion?: GalleryItem[]; moods?: GalleryItem[] }
type GalleryKind = "templates" | "styles" | "motion" | "moods";

/** What each gallery says on its buttons, and the line a pick becomes in the message. */
const GALLERY: Record<GalleryKind, { open: string; none: string; line: (p: { id: string; name: string }) => string }> = {
  templates: { open: "🖼️ افتح معرض القوالب", none: "🚫 بدون قالب — صمّم لي بحرية", line: templateLine },
  styles: { open: "🎨 افتح معرض الستايلات الكرتونية", none: "🚫 بدون ستايل كرتوني", line: styleLine },
  motion: { open: "🎬 افتح معرض مهارات الموشن", none: "🎲 اختر لي المهارة الأنسب", line: motionLine },
  moods: { open: "🎭 افتح معرض مشاعر الموشن", none: "🎲 اختر لي المزاج الأنسب", line: moodLine },
};

const STARTS = [
  { ic: "🖼️", t: "كاروسيل", d: "من فكرة أو نص إلى شرائح جاهزة بالصور", m: "أبي كاروسيل. اسألني عن اللي تحتاجه عشان نبدأ.", c: "#f6b73c" },
  { ic: "🎬", t: "سكربت ريل", d: "هوك قوي ونص منطوق وتوجيهات تصوير", m: "أبي سكربت ريل. اسألني عن اللي تحتاجه.", c: "#ff7a59" },
  { ic: "✂️", t: "ريل منتج", d: "من مقاطعي إلى ريل جاهز مع حيدرة", m: "أبي ريل منتج من مقاطعي. اسألني عن اللي تحتاجه، وبرفع لك الملفات هنا.", c: "#35c4b5" },
  { ic: "✨", t: "موشن جرافيكس", d: "مشاهد وحركة وصوت، ينفّذها حيدرة", m: "أبي موشن جرافيكس. اسألني عن اللي تحتاجه.", c: "#a78bfa" },
  { ic: "🔁", t: "أعد توظيف محتوى", d: "محتوى واحد إلى عدة مخرجات مترابطة", m: "عندي محتوى وأبي أعيد توظيفه في أكثر من مخرج. اسألني عن اللي تحتاجه.", c: "#fbbf24" },
];

const KIND_IC = { image: "🖼️", video: "🎞️", audio: "🎧", doc: "📄" } as const;

/** The answer's light markdown (headings, lists, tables, bold, rules; colours as swatches) as elements. */
function Rich({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => (/^\*\*[^*]+\*\*$/.test(p) ? <b key={i}>{p.slice(2, -2)}</b> : /^`[^`]+`$/.test(p) ? <code key={i}>{p.slice(1, -1)}</code> : <Swatches key={i} text={p} cls="ct" />));
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
          <thead><tr>{head.map((c, i) => <th key={i}>{inline(c)}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody>
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

const FLOATERS: { s: number; c: string; t: number; d: number; top: string; left: string }[] = [
  { s: 76, c: "#f6b73c", t: 18, d: 30, top: "10%", left: "5%" },
  { s: 48, c: "#35c4b5", t: 14, d: 46, top: "60%", left: "3%" },
  { s: 60, c: "#ff7a59", t: 22, d: 24, top: "18%", left: "90%" },
  { s: 40, c: "#a78bfa", t: 12, d: 52, top: "72%", left: "92%" },
];

/** A thumbnail of a gallery item: its picture, or (a template with no picture yet) its palette. */
function Thumb({ item, big }: { item: GalleryItem; big?: boolean }) {
  if (item.image) return <img src={item.image} alt={item.name} loading="lazy" className={`ct-thumb ${big ? "big" : ""}`} />;
  const p = item.palettes?.[0];
  return (
    <div className={`ct-thumb ct-thumb-ph ${big ? "big" : ""}`} style={{ background: p?.bg ?? "#222" }} aria-label={item.name}>
      {p && (
        <>
          <b style={{ color: p.text }}>{item.name}</b>
          <span><i style={{ background: p.text }} /><i style={{ background: p.primary }} /><i style={{ background: p.accent }} /></span>
        </>
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

/** The questions of an answer as buttons. One plain question sends on a press; a batch collects the answers first. */
export function Questions({ questions, gal, disabled, onSend, onWrite }: { questions: Question[]; gal: Galleries | null; disabled: boolean; onSend: (text: string) => void; onWrite: () => void }) {
  const [picked, setPicked] = useState<Record<number, string[]>>({});
  const [other, setOther] = useState<Record<number, string>>({});
  const [openOther, setOpenOther] = useState<Record<number, boolean>>({});
  const [gallery, setGallery] = useState<number | null>(null);
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
          ) : (
            <div className="ct-opts">
              <button type="button" className="ct-opt" aria-pressed={gallery === qi} disabled={disabled} onClick={() => setGallery(gallery === qi ? null : qi)}>
                {GALLERY[q.kind as GalleryKind].open}
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

/** The carousel of an answer: tiles in order, the drawing ones as moving placeholders, each made one with its check. */
export function SlidesBox({ s, busy, owner, onRetry, onDownloadAll }: { s: SlidesView; busy: boolean; owner: boolean; onRetry: (ns: number[] | "failed") => void; onDownloadAll: () => void }) {
  const ns = [...new Set([...s.items.map((i) => i.n), ...s.todo])].sort((a, b) => a - b);
  const done = s.items.filter((i) => !s.todo.includes(i.n)).length;
  const aspect = s.aspect.replace(":", " / ") || "1 / 1";
  return (
    <div className="ct-slidebox">
      {s.running && (
        <div className="ct-progress" role="status" aria-live="polite">
          <span className="ct-spin" aria-hidden />
          <div>
            <b>جواد يولّد الشرائح بـ GPT Image 2… ({done} من {s.total})</b>
            <small>محمد باقر سلّم الطلب لجواد، وكل شريحة يولّدها جواد ثم يفحص باقر كتابتها العربية، وتأخذ نحو دقيقة. لا تقفل الصفحة؛ تظهر الشرائح هنا واحدة بعد واحدة.</small>
            <span className="bar"><i style={{ width: `${s.total ? Math.round((done / s.total) * 100) : 0}%` }} /></span>
          </div>
        </div>
      )}
      <div className="ct-slides">
        {ns.map((n) => {
          const item = s.items.find((i) => i.n === n);
          const drawing = s.todo.includes(n);
          return (
            <figure key={n} className={`ct-slide ${drawing ? "drawing" : ""} ${item?.flag ? "flag" : ""}`} style={{ aspectRatio: aspect }}>
              {item?.url && <img src={item.url} alt={item.text} loading="lazy" />}
              <span className="n">{n}</span>
              {drawing && <span className="shimmer" aria-label={`الشريحة ${n} قيد الرسم`}><span className="ct-spin" /></span>}
              {item && !drawing && (
                <>
                  {item.flag ? <span className="badge warn" title={item.flag}>⚠️</span> : item.fixed ? <span className="badge fixed" title="أُعيد رسمها بعد أن وُجد فيها خطأ">🔁✓</span> : <span className="badge ok" title="سليمة في الفحص الآلي">✓</span>}
                  <span className="tools">
                    {item.download && <a href={item.download} download={`${item.name}.png`}>⬇️</a>}
                    <button type="button" disabled={busy} onClick={() => onRetry([n])} title="أعد رسم هذه الشريحة">🔁</button>
                  </span>
                </>
              )}
            </figure>
          );
        })}
      </div>
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
      {s.report && <pre className="ct-report">{s.report}</pre>}
      {!s.running && s.items.length > 0 && (
        <div className="ct-actions">
          <button className="ct-mini" type="button" onClick={onDownloadAll}>⬇️ حمّل كل الشرائح ({s.items.length})</button>
        </div>
      )}
    </div>
  );
}

/** The pictures and videos «محمد باقر» handed to جواد: who took each request, what it costs, its state, and the result. */
export function MediaBox({ items, busy, owner, onRetry }: { items: MediaView[]; busy: boolean; owner: boolean; onRetry: (ids: string[] | "failed") => void }) {
  const ST = { todo: "بانتظار جواد", running: "جواد يولّده الحين…", done: "جاهز", failed: "تعذّر" } as const;
  return (
    <div className="ct-media">
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

export default function ContentChat({ name, persona, loginHref, owner }: { name: string; persona: string; loginHref: string | null; owner?: boolean }) {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<"" | "writing" | "producing">("");
  const [side, setSide] = useState(false);
  const [pending, setPending] = useState<FileView[]>([]);
  const [uploading, setUploading] = useState(false);
  const [gal, setGal] = useState<Galleries | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    if (loginHref) return;
    try {
      setChats((await api<{ chats: ChatItem[] }>("/api/content/chats")).chats);
    } catch { /* the list is a convenience */ }
  }, [loginHref]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  // the galleries load once, when a message first asks for one
  const wantsGallery = msgs.some((m) => m.questions?.some((x) => x.kind !== "choice"));
  useEffect(() => {
    if (!wantsGallery || gal || loginHref) return;
    api<Galleries>("/api/content/templates").then(setGal).catch(() => null);
  }, [wantsGallery, gal, loginHref]);

  const move = (e: React.PointerEvent) => {
    const r = root.current;
    if (!r || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    r.style.setProperty("--mx", String((e.clientX / window.innerWidth - 0.5) * 2));
    r.style.setProperty("--my", String((e.clientY / window.innerHeight - 0.5) * 2));
  };

  /** The last answer that carries a carousel gets this block (the produce step reports into it). */
  const putSlides = (fn: (old: SlidesView | undefined) => SlidesView) =>
    setMsgs((m) => {
      const i = m.map((x) => !!x.slides).lastIndexOf(true);
      if (i < 0) return m;
      const copy = [...m];
      copy[i] = { ...copy[i], slides: fn(copy[i].slides) };
      return copy;
    });

  /** The produce step: the server draws a few slides a call; this asks again while it says `running`. */
  const runProduce = useCallback(async (id: string, retry?: number[] | "failed") => {
    setBusy("producing");
    let first = true;
    try {
      for (let guard = 0; guard < 40; guard++) {
        const r = await postJson<{ aspect: string; slides: SlideView[]; todo: number[]; failed: FailView[]; running: boolean; total: number; report: string | null }>("/api/content/produce", { chatId: id, ...(first && retry ? { retry } : {}) });
        first = false;
        putSlides((old) => ({ aspect: r.aspect || old?.aspect || "", items: r.slides, todo: r.todo, failed: r.failed, running: r.running, total: r.total, report: r.report ?? old?.report }));
        if (!r.running) break;
      }
    } catch (e) {
      putSlides((old) => ({ aspect: old?.aspect ?? "", items: old?.items ?? [], todo: [], failed: old?.failed ?? [], running: false, total: old?.total ?? 0, report: old?.report }));
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر إنتاج الشرائح.", error: true }]);
    } finally {
      setBusy("");
    }
  }, []);

  /** The media step: جواد takes what «محمد باقر» handed him; this asks again while he works (a video takes minutes). */
  const runMedia = useCallback(async (id: string, retry?: string[] | "failed") => {
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
        const r = await postJson<{ items: MediaView[]; running: boolean }>("/api/content/generate", { chatId: id, ...(first && retry ? { retry } : {}) });
        first = false;
        put(r.items);
        if (!r.running) break;
        await new Promise((res) => setTimeout(res, r.items.some((x) => x.kind === "video" && x.state === "running") ? 8000 : 1500));
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر التوليد.", error: true }]);
    } finally {
      setBusy("");
    }
  }, []);

  async function open(id: string) {
    setSide(false);
    try {
      const r = await api<{ chat: { id: string; messages: Msg[]; pending: Pending | null } }>(`/api/content/chats?id=${id}`);
      setChatId(r.chat.id);
      setMsgs(r.chat.messages);
      // a carousel ordered before the page was left: drawn on from where it stopped
      if (r.chat.pending) void runProduce(r.chat.id);
      // pictures or videos still with جواد: followed on from where they stand
      else if (r.chat.messages.some((m) => m.media?.items.some((x) => x.state === "todo" || x.state === "running"))) void runMedia(r.chat.id);
    } catch (e) {
      setMsgs([{ role: "assistant", text: e instanceof Error ? e.message : "تعذّر فتح المحادثة.", error: true }]);
    }
  }
  const fresh = () => { setChatId(null); setMsgs([]); setPending([]); setSide(false); };

  async function attach(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 12 - pending.length)) {
        try {
          const probe = await probeFile(file);
          const signed = await postJson<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: probe.kind, mime: probe.mime, bytes: file.size, fileName: file.name });
          await putWithProgress(signed.signedUrl, file, probe.mime, () => {});
          const conf = await postJson<{ upload: { id: string; status: string; error: string | null; url: string | null } }>("/api/jawad/uploads/confirm", { id: signed.id });
          if (conf.upload?.status !== "ready") throw new Error(conf.upload?.error ?? "تعذّر فحص الملف.");
          setPending((p) => [...p, { id: conf.upload.id, kind: probe.kind, name: file.name, durationMs: probe.durationMs, url: conf.upload.url }]);
        } catch (e) {
          setMsgs((m) => [...m, { role: "assistant", text: `${file.name}: ${e instanceof Error ? e.message : "تعذّر الرفع."}`, error: true }]);
        }
      }
    } finally {
      setUploading(false);
      if (picker.current) picker.current.value = "";
    }
  }

  const [claude] = useClaudeModel();

  async function send(text = q) {
    const message = text.trim();
    if ((!message && !pending.length) || busy || uploading) return;
    const files = pending;
    setQ("");
    setPending([]);
    setBusy("writing");
    setMsgs((m) => [...m, { role: "user", text: message || "(ملفات مرفقة)", files: files.length ? files : undefined }]);
    let produceId: string | null = null;
    let mediaId: string | null = null;
    try {
      const r = await postJson<{ chatId: string; text: string; questions: Question[] | null; pending: Pending | null; editor: { id: string; title: string } | null; media: MediaView[] | null }>("/api/content/chat", { chatId, message, attachments: files.map((f) => f.id), model: claude.id });
      setChatId(r.chatId);
      setMsgs((m) => {
        const copy = [...m];
        const reply: Msg = { role: "assistant", text: r.text, questions: r.questions ?? undefined, editor: r.editor ?? undefined, ...(r.media ? { media: { items: r.media } } : {}) };
        // a new carousel: the placeholders of its slides appear at once; a fix: the slides being redrawn are marked
        if (r.pending?.mode === "all") reply.slides = { aspect: "", items: [], todo: r.pending.todo, failed: [], running: true, total: r.pending.total };
        if (r.pending?.mode === "fix") {
          const i = copy.map((x) => !!x.slides).lastIndexOf(true);
          if (i >= 0) copy[i] = { ...copy[i], slides: { ...copy[i].slides!, todo: r.pending.todo, running: true, report: undefined } };
        }
        return [...copy, reply];
      });
      void refresh();
      if (r.pending) produceId = r.chatId;
      else if (r.media) mediaId = r.chatId;
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر الرد.", error: true }]);
    } finally {
      setBusy("");
    }
    if (produceId) await runProduce(produceId);
    else if (mediaId) await runMedia(mediaId);
  }

  async function remove(id: string) {
    if (!confirm("نحذف هذي المحادثة وصورها؟")) return;
    await fetch(`/api/content/chats?id=${id}`, { method: "DELETE" }).catch(() => null);
    if (id === chatId) fresh();
    void refresh();
  }

  const downloadAll = (items: SlideView[]) => {
    items.forEach((s, i) => {
      if (!s.download) return;
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = s.download!;
        a.download = `${s.name}.png`;
        a.click();
      }, i * 400);
    });
  };

  const lastAssistant = msgs.map((x) => x.role).lastIndexOf("assistant");

  return (
    <div className="ct" ref={root} onPointerMove={move}>
      <div className="ct-scene" aria-hidden>
        {FLOATERS.map((f, i) => (
          <div key={i} className="ct-float" style={{ top: f.top, left: f.left, ["--depth" as string]: `${f.d}px` }}>
            <div className="ct-sheet" style={{ "--s": `${f.s}px`, "--c": f.c, "--t": `${f.t}s` } as CSSProperties} />
          </div>
        ))}
      </div>

      <div className="ct-wrap">
        <aside className={`ct-side ct-glass ${side ? "open" : ""}`}>
          <button className="ct-send" style={{ minWidth: 0, width: "100%" }} onClick={fresh}>＋ محادثة جديدة</button>
          <div className="ct-chats">
            {chats.map((c) => (
              <div key={c.id} className="ct-chat-item" aria-current={c.id === chatId} onClick={() => open(c.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(c.id)}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                <button className="ct-mini" aria-label="احذف" onClick={(e) => { e.stopPropagation(); void remove(c.id); }}>✕</button>
              </div>
            ))}
            {!loginHref && chats.length === 0 && <p style={{ color: "#b8ad9c", fontSize: 13 }}>محادثاتك تظهر هنا.</p>}
          </div>
          <Link href="/jawad-ai" className="ct-mini" style={{ textAlign: "center" }}>← الرئيسية</Link>
        </aside>

        <section className="ct-main ct-glass">
          <header className="ct-head">
            <button className="ct-burger ct-mini" onClick={() => setSide((s) => !s)} aria-label="المحادثات">☰</button>
            <div className="ct-scene-pen"><div className={`ct-pen ${busy ? "writing" : ""}`} /></div>
            <div>
              <div className="ct-title">{name}</div>
              <div style={{ color: "#b8ad9c", fontSize: 12 }}>تكلّم مع {persona}</div>
            </div>
          </header>

          <div className="ct-feed">
            {loginHref ? (
              <div className="ct-msg bot">
                <p>سجّل دخولك عشان تتكلم مع {persona}.</p>
                <div className="ct-actions"><Link className="ct-mini" href={loginHref}>تسجيل الدخول</Link></div>
              </div>
            ) : msgs.length === 0 ? (
              <>
                <div className="ct-msg bot">
                  <h3>أهلًا، أنا {persona} ✍️</h3>
                  <p>أرافقك من الفكرة أو النص إلى محتوى جاهز: كاروسيل بالصور، سكربت ريل، ريل منتج أو موشن جرافيكس مع حيدرة، وعناوين وكابشن. اختر نقطة بداية أو اكتب لي مباشرة، وارفق ملفاتك بزر 📎.</p>
                </div>
                <div className="ct-start">
                  {STARTS.map((s, i) => (
                    <button key={s.t} className="ct-card" style={{ ["--c" as string]: s.c, animationDelay: `${i * 90}ms` }} onClick={() => send(s.m)}>
                      <span className="ic">{s.ic}</span>
                      <b>{s.t}</b>
                      <small>{s.d}</small>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              msgs.map((m, i) => (
                <div key={i} className={`ct-msg ${m.role === "user" ? "user" : "bot"} ${m.error ? "err" : ""}`}>
                  {m.role === "user" ? <p style={{ whiteSpace: "pre-wrap" }}>{stripMarks(m.text)}</p> : <Rich text={m.text} />}
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
                    />
                  )}
                  {m.media && <MediaBox items={m.media.items} busy={!!busy} owner={!!owner} onRetry={(ids) => chatId && void runMedia(chatId, ids)} />}
                  {m.editor && (
                    <div className="ct-actions">
                      <Link className="ct-mini" href={`/jawad-ai/editor/${m.editor.id}`}>🎬 افتح غرفة المونتاج «{m.editor.title}» مع حيدرة</Link>
                    </div>
                  )}
                  {i === lastAssistant && !busy && !loginHref && m.questions?.length ? (
                    <Questions key={`q${i}-${msgs.length}`} questions={m.questions} gal={gal} disabled={!!busy} onSend={(t) => void send(t)} onWrite={() => box.current?.focus()} />
                  ) : null}
                  {m.role === "assistant" && !m.error && (
                    <div className="ct-actions"><button className="ct-mini" onClick={() => navigator.clipboard?.writeText(m.text).catch(() => null)}>انسخ</button></div>
                  )}
                </div>
              ))
            )}
            {busy === "writing" && (
              <div className="ct-think">
                <span className="ct-dots"><span /><span /><span /></span>
                {persona} يكتب…
              </div>
            )}
            <div ref={end} />
          </div>

          {!loginHref && (
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
              <ClaudeModelPicker className="ct-claude" disabled={!!busy} />
              <div className="ct-compose-row">
                <input ref={picker} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,audio/mpeg,audio/wav,application/pdf" onChange={(e) => void attach(e.target.files)} />
                <button type="button" className="ct-attach" aria-label="أرفق ملفات" title="أرفق صور أو فيديو أو صوت" disabled={uploading || !!busy} onClick={() => picker.current?.click()}>{uploading ? "…" : "📎"}</button>
                <MicButton onText={(t) => setQ((v) => (v.trim() ? `${v.trim()} ${t}` : t))} disabled={!!busy || uploading} className="ct-attach" />
                <textarea
                  ref={box}
                  className="ct-input"
                  dir="auto"
                  rows={1}
                  value={q}
                  maxLength={8000}
                  placeholder={busy === "producing" ? "الشرائح قيد الرسم…" : `اكتب لـ${persona}…`}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
                />
                <button className="ct-send" disabled={!!busy || uploading || (!q.trim() && !pending.length)}>{busy ? "…" : "أرسل"}</button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
