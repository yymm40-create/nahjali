/* eslint-disable @next/next/no-img-element */
"use client";

// «المصمم الذكي» — the studio and the conversation with «كاظم», on «صانع المحتوى»'s way: chats on the side, a card per
// kind of design that opens with its own first questions (written here, so opening one costs nothing), his questions as
// buttons (the source cards, the directions, «قائمة الخطوط», «معرض الألوان»), the decisions as chips over the chat
// (tap one to change it), a short talk by default («📝 خلّها مفصّلة» for the longer one), any message of the person's
// edited to go on from there, the design drawn by «حيدرا ماكس» in code, and the final PNG saved. The look is designer.css.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import ClaudeModelPicker from "@/components/robots/ClaudeModelPicker";
import MicButton from "@/components/robots/MicButton";
import { useClaudeModel } from "@/components/robots/claude-model";
import { useRouter } from "next/navigation";
import { api, postJson } from "@/lib/fetch";
import { probeFile, putWithProgress } from "@/components/jawad/studio/upload";
import QuickReplies, { Swatches } from "@/components/jawad/QuickReplies";
import { answerLine, DELEGATE_LINE } from "@/lib/content/marks";
import { DESIGN_KINDS, DESIGN_SOURCES } from "@config/designer";
import { decisionsOf, findOpening, fontAnswer, kindLine, paletteAnswer, sourceAnswer, stripMarks, type KindOpening } from "@config/designer-talk";
import { FontList, PaletteGrid } from "./Pickers";
import { JAWAD_ATTACHMENT_LIMIT } from "@config/jawad/limits";
import { renderDesign, type DesignView, type FontDef } from "./LayerEditor";
import { drawWithCode, pngBody, smallJpeg, type DrawEdit } from "@/components/claude-code/draw";

interface FileView { id: string; kind: "image" | "video" | "audio" | "doc"; name: string; durationMs: number | null; url?: string | null }
interface Question { label: string; kind: "choice" | "source" | "directions" | "fonts" | "palettes"; options: string[]; multi: boolean }
/** `local`: written on this page (the opening of a kind), never saved with the conversation */
interface Msg { role: "user" | "assistant"; text: string; files?: FileView[]; questions?: Question[]; design?: DesignView; error?: boolean; local?: boolean }
interface ChatItem { id: string; title: string }

const COLORS = ["#2f74ff", "#ff6b8a", "#ffb347", "#5ad7a3", "#a78bfa", "#38bdf8"];

/** The answer's light markdown (headings, lists, tables, bold, rules; colours as swatches) as elements. */
function Rich({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => (/^\*\*[^*]+\*\*$/.test(p) ? <b key={i}>{p.slice(2, -2)}</b> : /^`[^`]+`$/.test(p) ? <code key={i}>{p.slice(1, -1)}</code> : <Swatches key={i} text={p} cls="dz" />));
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
      out.push(<table key={out.length}><thead><tr>{head.map((c, i) => <th key={i}>{inline(c)}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody></table>);
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
    if (h) out.push(h[1].length <= 2 ? <h3 key={out.length}>{inline(h[2])}</h3> : <h4 key={out.length}>{inline(h[2])}</h4>);
    else if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) out.push(<hr key={out.length} />);
    else if (line.trim()) out.push(<p key={out.length}>{inline(line)}</p>);
  }
  flush();
  return <>{out}</>;
}

/** The questions of an answer as buttons: a plain one sends on a press; a batch collects the answers first. */
export function Questions({ questions, disabled, onSend, onWrite }: { questions: Question[]; disabled: boolean; onSend: (text: string) => void; onWrite: () => void }) {
  const [picked, setPicked] = useState<Record<number, string[]>>({});
  const [other, setOther] = useState<Record<number, string>>({});
  const [openOther, setOpenOther] = useState<Record<number, boolean>>({});

  if (questions.length === 1 && questions[0].kind === "choice" && !questions[0].multi) {
    return <QuickReplies cls="dz" options={questions[0].options} disabled={disabled} onPick={(o) => onSend(o)} onWrite={onWrite} />;
  }
  const has = (qi: number, o: string) => (picked[qi] ?? []).includes(o);
  const toggle = (qi: number, o: string, multi: boolean) =>
    setPicked((p) => {
      const cur = p[qi] ?? [];
      return { ...p, [qi]: cur.includes(o) ? cur.filter((x) => x !== o) : multi ? [...cur, o] : [o] };
    });
  const answerOf = (qi: number): string | null => {
    const q = questions[qi];
    const a = [...(picked[qi] ?? []), ...(other[qi]?.trim() ? [other[qi].trim()] : [])];
    return a.length ? answerLine(q.label, a) : null;
  };
  const answered = questions.map((_, i) => answerOf(i)).filter((x): x is string => !!x);
  const send = (delegate: boolean) => onSend([...answered, ...(delegate ? [DELEGATE_LINE] : [])].join("\n"));

  return (
    <div className="dz-qs">
      {questions.map((q, qi) => (
        <div key={qi} className="dz-q">
          <b>{qi + 1}) {q.label}{q.multi ? " (يجوز أكثر من خيار)" : ""}</b>
          {q.kind === "source" ? (
            <div className="dz-sources">
              {DESIGN_SOURCES.map((s, i) => (
                <button key={s.id} type="button" className="dz-source" style={{ ["--c" as string]: COLORS[i] }} aria-pressed={has(qi, sourceAnswer(s))} disabled={disabled} onClick={() => toggle(qi, sourceAnswer(s), false)}>
                  <span className="ic">{s.icon}</span><b>{s.name}</b><small>{s.hint}</small>
                </button>
              ))}
            </div>
          ) : q.kind === "fonts" ? (
            <FontList
              picked={(picked[qi] ?? []).map((a) => /\[خط:([a-z0-9_-]+)\]/.exec(a)?.[1] ?? "")[0] ?? null}
              autoPicked={has(qi, fontAnswer("auto"))}
              disabled={disabled}
              onPick={(f) => toggle(qi, fontAnswer(f), false)}
              onAuto={() => toggle(qi, fontAnswer("auto"), false)}
            />
          ) : q.kind === "palettes" ? (
            <PaletteGrid
              picked={(picked[qi] ?? []).map((a) => /\[ألوان:([a-z0-9_-]+)\]/.exec(a)?.[1] ?? "")[0] ?? null}
              autoPicked={has(qi, paletteAnswer("auto"))}
              disabled={disabled}
              onPick={(p) => toggle(qi, paletteAnswer(p), false)}
              onAuto={() => toggle(qi, paletteAnswer("auto"), false)}
            />
          ) : (
            <div className="dz-opts">
              {q.options.map((o) => (
                <button key={o} type="button" className={`dz-opt ${q.kind === "directions" ? "dir" : ""}`} aria-pressed={(picked[qi] ?? []).includes(o)} disabled={disabled} onClick={() => toggle(qi, o, q.multi)}>
                  <Swatches text={o} cls="dz" />
                </button>
              ))}
              <button type="button" className="dz-opt dz-opt-write" aria-pressed={!!openOther[qi]} disabled={disabled} onClick={() => setOpenOther((s) => ({ ...s, [qi]: !s[qi] }))}>✍️ غير ذلك</button>
              {openOther[qi] && <input className="dz-inline" dir="auto" value={other[qi] ?? ""} placeholder="اكتب إجابتك" onChange={(e) => setOther((s) => ({ ...s, [qi]: e.target.value.slice(0, 300) }))} />}
            </div>
          )}
        </div>
      ))}
      <div className="dz-actions">
        <button type="button" className="dz-send" disabled={disabled || answered.length === 0} onClick={() => send(false)}>أرسل الإجابات ✅</button>
        <button type="button" className="dz-opt" disabled={disabled} onClick={() => send(true)}>🎲 اختر أنت لكل ما لم أحدده</button>
        <button type="button" className="dz-opt dz-opt-write" disabled={disabled} onClick={onWrite}>✍️ اكتب إجابة مختلفة</button>
      </div>
    </div>
  );
}

// the conversation that was open is kept on this device (a reload, a top-up, a phone closing the tab brings the person
// back to it), and so is the choice of the longer talk — as in «صانع المحتوى»
const OPEN_KEY = "jw-designer-open";
const VERBOSE_KEY = "jw-designer-verbose";
const UUID_RE = /^[0-9a-f-]{36}$/i;
/** a message that carries a pick of a gallery is changed by picking again (the chips), not by editing its words */
const PICK_MARK = /\[(?:مصدر|خط|ألوان):/;
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

export default function DesignerChat({ name, persona, loginHref, owner, photo, initialChat }: { name: string; persona: string; loginHref: string | null; owner?: boolean; photo?: boolean; initialChat?: string | null }) {
  const router = useRouter();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  // exactly what was taken from the wallet in THIS conversation so far (halalas, not an estimate); read back from
  // the server with the chat, so it survives a reload — 0 for a new one
  const [spent, setSpent] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<"" | "writing" | "drawing" | "splitting">("");
  // «Claude Code» drawing the design here: what it is doing now (null when GPT Image 2 draws it)
  const [codeStep, setCodeStep] = useState<string | null>(null);
  // what «حيدرا ماكس» has done so far for the design being drawn (its steps, and the last picture he looked at)
  const [codeLog, setCodeLog] = useState<string[]>([]);
  const [codePreview, setCodePreview] = useState<string | null>(null);
  // the person's Claude model, for «Claude Code» (read inside the produce step, which never changes)
  const claudeId = useRef("");
  const [saving, setSaving] = useState(false);
  const [side, setSide] = useState(false);
  const [pending, setPending] = useState<FileView[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fonts, setFonts] = useState<FontDef[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  /** the kind opened before the conversation began (its mark goes with the first message) */
  const [kindId, setKindId] = useState<string | null>(null);
  /** the longer talk (the default is short, to cost less); remembered on this device */
  const [verbose, setVerbose] = useState(false);
  /** an old message being edited: the talk goes on from it */
  const [editFrom, setEditFrom] = useState<number | null>(null);
  /** one drawing loop per conversation (opening it again must not start a second, paid one) */
  const drawingFor = useRef<string | null>(null);
  useEffect(() => setVerbose(store.get(VERBOSE_KEY) === "1"), []);
  const toggleVerbose = () => setVerbose((v) => (store.set(VERBOSE_KEY, v ? null : "1"), !v));

  const refresh = useCallback(async () => {
    if (loginHref) return;
    try {
      setChats((await api<{ chats: ChatItem[] }>("/api/designer/chats")).chats);
    } catch { /* the list is a convenience */ }
  }, [loginHref]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (loginHref) return;
    let on = true;
    api<{ fonts: FontDef[] }>("/api/designer/fonts").then((r) => { if (on) setFonts(r.fonts); }).catch(() => null);
    return () => { on = false; };
  }, [loginHref]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, busy]);

  const move = (e: React.PointerEvent) => {
    const r = root.current;
    if (!r || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    r.style.setProperty("--mx", String((e.clientX / window.innerWidth - 0.5) * 2));
    r.style.setProperty("--my", String((e.clientY / window.innerHeight - 0.5) * 2));
  };

  /** The last answer that carries a design gets this block. */
  const putDesign = (fn: (old: DesignView | undefined) => DesignView | undefined) =>
    setMsgs((m) => {
      const i = m.map((x) => !!x.design).lastIndexOf(true);
      if (i < 0) return m;
      const copy = [...m];
      copy[i] = { ...copy[i], design: fn(copy[i].design) };
      return copy;
    });

  /** The produce step: the picture it needs (GPT Image 2, no writing) is painted on the server, then «حيدرا ماكس»
   * designs it here in code — every step and every picture he looks at shown as it happens — and it is kept. */
  const runProduce = useCallback(async (id: string, retry = false) => {
    if (drawingFor.current === id) return;
    drawingFor.current = id;
    setBusy("drawing");
    const step = (text: string) => (setCodeStep(text), setCodeLog((l) => [...l.slice(-8), text]));
    setCodeLog([]);
    setCodePreview(null);
    step("أجهّز التصميم (وإذا يحتاج صورة مرسومة، جواد يرسمها بـ GPT Image 2 بدون كتابة)…");
    try {
      const r = await postJson<{ design?: DesignView; code?: { prompt: string; aspect: string; refs: string[]; photos?: string[]; picture?: boolean; edit?: DrawEdit; style?: string } }>("/api/designer/produce", { chatId: id, ...(retry ? { retry: true } : {}) });
      if (r.code) {
        if (r.code.picture) step("🖼️ صورة التصميم جاهزة من GPT Image 2 (بدون كتابة) — حيدرا ماكس يحطها ويكتب الكلام فوقها.");
        // «حيدرا ماكس»: the design is drawn here in code, looked at and rewritten, then kept as the design's artwork with
        // its program — a change to a design drawn before is a patch on that program (`edit`), not a new one
        const refs = (await Promise.all(r.code.refs.map(smallJpeg))).filter((x): x is string => !!x);
        const drawn = await drawWithCode({ prompt: r.code.prompt, aspect: r.code.aspect, style: r.code.style ?? "", references: refs, photos: r.code.photos ?? [], model: claudeId.current, from: "designer", edit: r.code.edit ?? null, onStep: (s) => (step(s.text), s.preview && setCodePreview(s.preview)) });
        step("أحفظ التصميم…");
        const saved = await postJson<{ design: DesignView }>("/api/designer/produce", { chatId: id, ...(await pngBody(drawn.png)), rounds: drawn.rounds, scores: drawn.scores, ...(drawn.program ? { program: drawn.program } : {}), ...(drawn.edited ? { edited: true } : {}) });
        putDesign(() => saved.design);
      } else if (r.design) putDesign(() => r.design!);
    } catch (e) {
      const why = e instanceof Error ? e.message : "تعذّر الرسم.";
      putDesign((old) => (old ? { ...old, state: "failed", error: why } : old));
      // kept as failed on the server too: a reload shows «أعد المحاولة», and never starts a paid drawing by itself
      await postJson("/api/designer/produce", { chatId: id, failed: why }).catch(() => null);
    } finally {
      drawingFor.current = null;
      setBusy("");
      setCodeStep(null);
      setCodePreview(null);
    }
  }, []);

  /** The split step: the subject cut out of the person's picture, over the picture itself. */
  const runSplit = useCallback(async (id: string, uploadId: string) => {
    setBusy("splitting");
    try {
      const r = await postJson<{ design: DesignView }>("/api/designer/split", { chatId: id, uploadId });
      putDesign(() => r.design);
    } catch (e) {
      putDesign((old) => (old ? { ...old, state: "failed", error: e instanceof Error ? e.message : "تعذّر التفكيك." } : old));
    } finally {
      setBusy("");
    }
  }, []);

  async function open(id: string) {
    setSide(false);
    setEditFrom(null);
    setKindId(null);
    try {
      const r = await api<{ chat: { id: string; messages: Msg[]; pending: boolean; spent?: number } }>(`/api/designer/chats?id=${id}`);
      setChatId(r.chat.id);
      setMsgs(r.chat.messages);
      setSpent(Math.max(0, Number(r.chat.spent) || 0));
      store.set(OPEN_KEY, r.chat.id);
      // a design left drawing (the page was closed while حيدرا ماكس worked) goes on; a failed one waits for «أعد المحاولة»
      const last = r.chat.messages.filter((m) => m.design).at(-1)?.design;
      if (r.chat.pending && last?.state === "drawing") void runProduce(r.chat.id);
    } catch (e) {
      store.set(OPEN_KEY, null);
      setMsgs([{ role: "assistant", text: e instanceof Error ? e.message : "تعذّر فتح المحادثة.", error: true }]);
    }
  }
  const fresh = () => { setChatId(null); setMsgs([]); setPending([]); setSide(false); setSpent(0); setKindId(null); setEditFrom(null); setQ(""); store.set(OPEN_KEY, null); };

  // coming back from «زهراء فوتو ماستر» (or a link) opens that conversation; else the one open on the last visit
  const opened = useRef(false);
  useEffect(() => {
    if (loginHref || opened.current) return;
    opened.current = true;
    const last = store.get(OPEN_KEY);
    const id = initialChat ?? (last && UUID_RE.test(last) ? last : null);
    if (id) void open(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChat, loginHref]);

  /** A kind opened: its first questions appear at once (written here, so opening one costs nothing). */
  function openKind(k: KindOpening) {
    setKindId(k.kind);
    setMsgs([{ role: "assistant", text: k.opening, questions: k.first, local: true }]);
    window.setTimeout(() => box.current?.focus(), 0);
  }
  function startEdit(i: number) {
    const m = msgs[i];
    if (!m || busy) return;
    setEditFrom(i);
    setQ(stripMarks(m.text).replace("(صور مرفقة)", "").trim());
    setPending(m.files ?? []);
    box.current?.focus();
  }
  function cancelEdit() {
    setEditFrom(null);
    setQ("");
    setPending([]);
  }

  /** Sends the last design to «زهراء» to be edited (she can send it back). */
  async function toZahraa() {
    if (!chatId) return;
    setBusy("writing");
    try {
      const r = await postJson<{ id: string }>("/api/photo/projects", { from: "designer", chatId });
      router.push(`/jawad-ai/photo/${r.id}`);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر فتح التصميم عند زهراء.", error: true }]);
      setBusy("");
    }
  }

  async function attach(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, JAWAD_ATTACHMENT_LIMIT - pending.length)) {
        try {
          const probe = await probeFile(file, "image");
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
  useEffect(() => {
    claudeId.current = claude.id;
  }, [claude.id]);

  async function send(text = q) {
    const typed = text.trim();
    if ((!typed && !pending.length) || busy || uploading) return;
    const files = pending;
    // the first message of a kind carries its mark; an edited old message keeps the mark it had, and the talk goes on from there
    const editing = editFrom;
    const keepKind = editing != null ? (msgs[editing]?.text.match(/\[نوع:[a-z0-9_-]+\]/)?.[0] ?? "") : "";
    const message = editing != null ? `${typed} ${keepKind}`.trim() : !chatId && kindId ? kindLine(kindId, typed || "(صور مرفقة)") : typed;
    const from = editing != null ? msgs.slice(0, editing).filter((x) => !x.local && !x.error).length : undefined;
    const before = msgs;
    setQ("");
    setPending([]);
    setEditFrom(null);
    setBusy("writing");
    const mine: Msg = { role: "user", text: message || "(صور مرفقة)", files: files.length ? files : undefined };
    setMsgs((m) => (editing != null ? [...m.slice(0, editing), mine] : [...m, mine]));
    let produceId: string | null = null;
    let splitOf: string | null = null;
    try {
      const r = await postJson<{ chatId: string; text: string; questions: Question[] | null; pending: boolean; split: string | null; spent?: number }>("/api/designer/chat", { chatId, message, attachments: files.map((f) => f.id), model: claude.id, verbose, ...(from !== undefined ? { from } : {}) });
      setChatId(r.chatId);
      store.set(OPEN_KEY, r.chatId);
      setSpent(Math.max(0, Number(r.spent) || 0));
      // the design's state and layers are read back fresh (the answer may have opened a design)
      const full = await api<{ chat: { messages: Msg[] } }>(`/api/designer/chats?id=${r.chatId}`).catch(() => null);
      if (full) setMsgs(full.chat.messages);
      else setMsgs((m) => [...m, { role: "assistant", text: r.text, questions: r.questions ?? undefined }]);
      void refresh();
      if (r.pending) produceId = r.chatId;
      else if (r.split) { produceId = r.chatId; splitOf = r.split; }
    } catch (e) {
      // not answered (the wallet ran out, the network…): the message goes back into the box with its files, ready to
      // send again — the conversation itself stays as it was on the server
      setQ((now) => now || typed);
      if (editing != null) setEditFrom(editing);
      setPending((now) => (now.length ? now : files));
      setMsgs((m) => [
        ...(editing != null ? before : m.slice(0, -1)),
        { role: "assistant", text: `${e instanceof Error ? e.message : "تعذّر الرد."}\n\nرسالتك رجعت في الخانة تحت، والمحادثة محفوظة كما هي: ${e instanceof Error && /رصيد/.test(e.message) ? "اشحن وارجع لهنا، وأرسلها" : "أرسلها مرة ثانية"} ويكمل كاظم من نفس المكان.`, error: true },
      ]);
    } finally {
      setBusy("");
    }
    if (produceId && splitOf) await runSplit(produceId, splitOf);
    else if (produceId) await runProduce(produceId);
  }

  async function remove(id: string) {
    if (!confirm("نحذف هذي المحادثة وتصاميمها؟")) return;
    await fetch(`/api/designer/chats?id=${id}`, { method: "DELETE" }).catch(() => null);
    if (id === chatId) fresh();
    void refresh();
  }

  /** The person's edits of the layers: shown at once, saved a moment later. */

  const saveFinal = async (blob: Blob) => {
    if (!chatId) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("chatId", chatId);
      fd.append("file", blob, "design.png");
      const r = await api<{ fileId: string; url: string | null }>("/api/designer/final", { method: "POST", body: fd });
      putDesign((old) => (old ? { ...old, final: r.fileId, finalUrl: r.url } : old));
      setMsgs((m) => [...m, { role: "assistant", text: "💾 انحفظ التصميم النهائي PNG. تقدر تحمّله من زر «آخر نسخة محفوظة»، وتعدّل وتحفظ مرة ثانية متى ما تبي." }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر الحفظ.", error: true }]);
    } finally {
      setSaving(false);
    }
  };

  const lastAssistant = msgs.map((x) => x.role).lastIndexOf("assistant");
  const lastDesign = msgs.map((x) => !!x.design).lastIndexOf(true);
  // what they decided so far, from the marks of their messages (the kind opened but not yet sent counts too)
  const decisions = (() => {
    const d = decisionsOf(msgs.filter((m) => m.role === "user").map((m) => m.text));
    const open = kindId ? DESIGN_KINDS.find((k) => k.id === kindId) : null;
    return !d.some((x) => x.key === "kind") && open ? [{ key: "kind" as const, label: "النوع", name: open.name, change: "" }, ...d] : d;
  })();

  return (
    <div className="dz" ref={root} onPointerMove={move}>
      <div className="dz-scene" aria-hidden>
        {COLORS.map((c, i) => (
          <div key={i} className="dz-blob" style={{ ["--c" as string]: c, ["--i" as string]: i } as CSSProperties} />
        ))}
      </div>

      <div className="dz-wrap">
        <aside className={`dz-side dz-glass ${side ? "open" : ""}`}>
          <button className="dz-send" style={{ width: "100%" }} onClick={fresh}>＋ تصميم جديد</button>
          <div className="dz-chats">
            {chats.map((c) => (
              <div key={c.id} className="dz-chat-item" aria-current={c.id === chatId} onClick={() => open(c.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(c.id)}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                <button className="dz-mini" aria-label="احذف" onClick={(e) => { e.stopPropagation(); void remove(c.id); }}>✕</button>
              </div>
            ))}
            {!loginHref && chats.length === 0 && <p className="dz-muted">تصاميمك تظهر هنا.</p>}
          </div>
          <Link href="/jawad-ai" className="dz-mini" style={{ textAlign: "center" }}>← الرئيسية</Link>
        </aside>

        <section className="dz-main dz-glass">
          <header className="dz-head">
            <button className="dz-burger dz-mini" onClick={() => setSide((s) => !s)} aria-label="المحادثات">☰</button>
            <div className={`dz-brush ${busy ? "busy" : ""}`} aria-hidden><span /></div>
            <div>
              <div className="dz-title">{name}</div>
              <div className="dz-muted" style={{ fontSize: 12 }}>تكلّم مع {persona} · حيدرا ماكس يصمم والكلام بخطك، وأي كلمة تتعدّل بطلب</div>
            </div>
          </header>

          {!loginHref && decisions.length > 0 && (
            <div className="dz-decs" role="group" aria-label="قراراتك (اضغط أي واحد لتغيّره)">
              {decisions.map((d) => (
                <button key={d.key} type="button" className="dz-dec" disabled={!!busy} onClick={() => (d.change ? void send(d.change) : fresh())} title="غيّره">
                  {d.label}: <b>{d.name}</b> ✎
                </button>
              ))}
            </div>
          )}

          <div className="dz-feed">
            {loginHref ? (
              <div className="dz-msg bot">
                <p>سجّل دخولك عشان تتكلم مع {persona}.</p>
                <div className="dz-actions"><Link className="dz-mini" href={loginHref}>تسجيل الدخول</Link></div>
              </div>
            ) : msgs.length === 0 ? (
              <>
                <div className="dz-msg bot">
                  <h3>أهلًا، أنا {persona} 🎨</h3>
                  <p>اختر نوع التصميم: أسألك أقل ما يمكن، وتجاوب بضغطة أو بكلامك، وتقدر تغيّر أي قرار في أي لحظة. وبعد التصميم قل لي وش تبي يتغيّر (كلمة، لون، مكان) وأعدّله لك.</p>
                </div>
                <div className="dz-start">
                  {DESIGN_KINDS.map((k, i) => {
                    const o = findOpening(k.id);
                    return o ? (
                      <button key={k.id} className="dz-card" style={{ ["--c" as string]: k.id === "other" ? "#94a3b8" : COLORS[i % COLORS.length], animationDelay: `${i * 70}ms` }} onClick={() => openKind(o)}>
                        <span className="ic">{k.icon}</span>
                        <b>{k.name}</b>
                      </button>
                    ) : null;
                  })}
                </div>
              </>
            ) : (
              msgs.map((m, i) => (
                <div key={i} className={`dz-msg ${m.role === "user" ? "user" : "bot"} ${m.error ? "err" : ""} ${m.design ? "wide" : ""}`}>
                  {m.role === "user" ? <p style={{ whiteSpace: "pre-wrap" }}>{stripMarks(m.text)}</p> : <Rich text={m.text} />}
                  {m.role === "user" && !busy && !loginHref && chatId && !PICK_MARK.test(m.text) && (
                    <button type="button" className="dz-edit" onClick={() => startEdit(i)} title="عدّل رسالتك، والمحادثة تكمل من هنا">✏️ عدّل</button>
                  )}
                  {m.files && m.files.length > 0 && (
                    <div className="dz-files">
                      {m.files.map((f) => <span key={f.id} className="dz-file">{f.url ? <img src={f.url} alt="" /> : "🖼️"} {f.name}</span>)}
                    </div>
                  )}
                  {m.design && (
                    <div className="dz-design">
                      {m.design.state === "drawing" && (
                        <div className="dz-progress" role="status" aria-live="polite">
                          <span className="dz-spin" aria-hidden />
                          <div>
                            <b>{busy === "splitting" ? "نفكّك الصورة إلى طبقات…" : codeStep ? `🧑‍💻 حيدرا ماكس: ${codeStep}` : "حيدرا ماكس يجهّز التصميم…"}</b>
                            <small>{busy === "splitting" ? "نقصّ العنصر الرئيسي بخلفية شفافة ونضعه فوق الصورة الأصلية (نحو نصف دقيقة)." : "حيدرا ماكس يكتب برنامج التصميم ويرسمه هنا ويشوفه ويعيد كتابته لين ينجح (دقايق). لا تقفل الصفحة."}</small>
                            {busy !== "splitting" && codeLog.length > 1 && (
                              <ul className="m-0 mt-1 list-none p-0 text-xs opacity-80">
                                {codeLog.slice(0, -1).map((l, k) => (
                                  <li key={k}>✓ {l}</li>
                                ))}
                              </ul>
                            )}
                            {busy !== "splitting" && codePreview && <img src={codePreview} alt="آخر نسخة شافها حيدرا ماكس" className="mt-2 max-h-64 rounded-lg" />}
                          </div>
                        </div>
                      )}
                      {m.design.state === "failed" && (
                        <div className="dz-failed">
                          ❌ {m.design.error ?? "تعذّر الرسم."}
                          {owner && m.design.detail && <small dir="ltr"> {m.design.detail}</small>}
                          {chatId && i === lastDesign && <button type="button" className="dz-mini" disabled={!!busy} onClick={() => chatId && void (m.design?.splitOf ? runSplit(chatId, m.design.splitOf) : runProduce(chatId, true))}>أعد المحاولة</button>}
                        </div>
                      )}
                      {m.design.state === "ready" && (
                        <>
                          {m.design.flag && <p className="dz-flag">⚠️ ملاحظة الفحص الآلي على الصورة: {m.design.flag}. تقدر تعيد رسمها.</p>}
                          {i === lastDesign ? (
                            <>
                              <DesignDone design={m.design} fonts={fonts} saving={saving} busy={!!busy} photo={!!photo} onSave={saveFinal} onRedraw={() => chatId && void runProduce(chatId, true)} onEdit={() => void toZahraa()} />
                            </>
                          ) : (
                            <p className="dz-muted">تصميم سابق في هذه المحادثة (المحرر يفتح على آخر تصميم).</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {i === lastAssistant && !busy && !loginHref && m.questions?.length ? (
                    <Questions key={`q${i}-${msgs.length}`} questions={m.questions} disabled={!!busy} onSend={(t) => void send(t)} onWrite={() => box.current?.focus()} />
                  ) : null}
                </div>
              ))
            )}
            {busy === "writing" && (
              <div className="dz-think"><span className="dz-dots"><span /><span /><span /></span>{persona} يكتب…</div>
            )}
            <div ref={end} />
          </div>

          {!loginHref && (
            <form className="dz-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
              {pending.length > 0 && (
                <div className="dz-files">
                  {pending.map((f) => (
                    <span key={f.id} className="dz-file">{f.url ? <img src={f.url} alt="" /> : "🖼️"} {f.name}<button type="button" aria-label="أزل" onClick={() => setPending((p) => p.filter((x) => x.id !== f.id))}>✕</button></span>
                  ))}
                </div>
              )}
              {editFrom != null && (
                <div className="dz-editing">
                  ✏️ تعدّل رسالة سابقة: المحادثة تكمل من عندها (اللي بعدها ينشال).
                  <button type="button" className="dz-mini" onClick={cancelEdit}>إلغاء</button>
                </div>
              )}
              <div className="dz-compose-opts">
                <ClaudeModelPicker className="dz-claude" disabled={!!busy} spent={spent} />
                <button type="button" className={`dz-mini dz-verbose${verbose ? " on" : ""}`} aria-pressed={verbose} onClick={toggleVerbose} title="الافتراضي مختصر لتوفير رصيدك؛ المفصّلة فيها شرح وبدائل وأسئلة أعمق">
                  {verbose ? "📝 محادثة مفصّلة ✓" : "📝 خلّها مفصّلة"}
                </button>
              </div>
              <div className="dz-compose-row">
                <input ref={picker} type="file" hidden multiple accept="image/png,image/jpeg,image/webp" onChange={(e) => void attach(e.target.files)} />
                <button type="button" className="dz-attach" aria-label="أرفق حتى 20 صورة" title="أرفق حتى 20 قالبًا أو صورة" disabled={uploading || !!busy || pending.length >= JAWAD_ATTACHMENT_LIMIT} onClick={() => picker.current?.click()}>{uploading ? "…" : "📎"}</button>
                <MicButton onText={(t) => setQ((v) => (v.trim() ? `${v.trim()} ${t}` : t))} disabled={!!busy || uploading} className="dz-attach" />
                <textarea ref={box} className="dz-input" dir="auto" rows={1} value={q} maxLength={6000} placeholder={busy === "drawing" ? "الصورة قيد الرسم…" : `اكتب لـ${persona}…`} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
                <button className="dz-send" disabled={!!busy || uploading || (!q.trim() && !pending.length)}>{busy ? "…" : "أرسل"}</button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * What a finished design shows: the design itself, «احفظ PNG», «أعد الرسم», and «🪄 عدّل في زهراء فوتو ماستر» for the
 * hand touches. A word, a colour or a place is changed by telling «كاظم» (he patches the design's program); the
 * platform's rule: he writes and edits the words himself, زهراء is the extra road.
 */
function DesignDone({
  design,
  fonts,
  saving,
  busy,
  photo,
  onSave,
  onRedraw,
  onEdit,
}: {
  design: DesignView;
  fonts: FontDef[];
  saving: boolean;
  busy: boolean;
  photo: boolean;
  onSave: (b: Blob) => void | Promise<void>;
  onRedraw: () => void;
  onEdit: () => void;
}) {
  const [working, setWorking] = useState(false);
  const save = async () => {
    setWorking(true);
    try {
      await onSave(await renderDesign(design, fonts));
    } finally {
      setWorking(false);
    }
  };
  return (
    <div className="dz-done">
      {design.finalUrl || design.artworkUrl ? <img className="dz-done-img" src={design.finalUrl ?? design.artworkUrl ?? ""} alt="التصميم" /> : null}
      <p className="dz-muted">
        {design.splitOf
          ? "الصورة انفكّت: العنصر الرئيسي طبقة فوق الصورة الأصلية. قل لي وش تبي نكتب عليها، أو كمّل عند زهراء فوتو ماستر."
          : `التصميم جاهز ✅ تبي تغيّر كلمة أو لون أو مكان؟ اكتب لي وش يتغيّر وأعدّله على نفس التصميم.${photo ? " وللمسات اليدوية (قص، فلتر، برواز) عندك زهراء فوتو ماستر." : ""}`}
      </p>
      <div className="dz-done-row">
        {photo && (
          <button type="button" className="dz-opt dz-opt-main" disabled={busy} onClick={onEdit} title="كل التعديلات عند زهراء: الكلمات والخطوط والألوان والأماكن، ووضع صورة داخل برواز">
            🪄 عدّل في زهراء فوتو ماستر
          </button>
        )}
        <button type="button" className="dz-mini" disabled={busy || saving || working} onClick={() => void save()}>
          {working || saving ? "…" : "💾 احفظ PNG"}
        </button>
        <button type="button" className="dz-mini" disabled={busy} onClick={onRedraw}>
          🔁 أعد الرسم
        </button>
      </div>
    </div>
  );
}
