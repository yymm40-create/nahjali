"use client";

// «صانع الألعاب الذكي» — the stage and the conversation with «قنبر»: chats on the side, the two ways to start (the game built
// here, or a prompt to take elsewhere) and cards to start from, the messages popping out of an arcade floor with floating dice,
// and «🎮 اصنع اللعبة» with each game's card (GameBuilds.tsx). The look is games.css; this file holds the behaviour.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import ClaudeModelPicker from "@/components/robots/ClaudeModelPicker";
import MicButton from "@/components/robots/MicButton";
import { useClaudeModel } from "@/components/robots/claude-model";
import { api, postJson } from "@/lib/fetch";
import { splitOptions } from "@/lib/chat-options";
import QuickReplies, { Swatches } from "@/components/jawad/QuickReplies";
import { BuildCard, BuildSheet, useBuilds } from "./GameBuilds";

interface Msg { role: "user" | "assistant"; text: string; error?: boolean }
interface ChatItem { id: string; title: string }
type Mode = "" | "build" | "prompt";

/** An answer «قنبر» offers that means «build it now»: it opens the build sheet instead of going to him. */
const BUILD_NOW = /^[^\p{L}]*(اصنع|ابنِ?)(ها|\s+اللعبة)/u;

/** The two ways a conversation can go, chosen at its start. */
const MODES: { mode: Exclude<Mode, "">; ic: string; t: string; d: string; m: string; c: string }[] = [
  { mode: "build", ic: "🎮", t: "اصنع لي اللعبة هنا", d: "نصمّمها مع قنبر، والموقع يبنيها بصورها ويعطيك رابط تضغطه وتلعب على طول، وترسله لربعك.", m: "ابي تصنع لي لعبة هنا في الموقع وتعطيني رابط ألعبها. ساعدني نصممها بسرعة.", c: "#a3e635" },
  { mode: "prompt", ic: "📝", t: "أبي برومبت أوديه لمكان ثاني", d: "قنبر يصمّمها معك ويعطيك برومبت كامل جاهز تنسخه لأي أداة تصنع الألعاب أو التطبيقات.", m: "ابي برومبت كامل لصنع لعبة أوديه لأداة ثانية. ساعدني نصممها.", c: "#f472b6" },
];

const STARTS = [
  { ic: "🎲", t: "فكرة لعبة جديدة", d: "ساعدني أطلع بفكرة مختلفة وأحدد لعبتها الأساسية", m: "ابي فكرة لعبة جديدة مختلفة. اسألني الأسئلة اللي تحتاجها عشان توصل لفكرة تناسبني.", c: "#22d3ee" },
  { ic: "🔎", t: "ابحث عن لعبة", d: "وش اللي خلّى لعبة معينة تنجح؟", m: "ابي أبحث عن لعبة وأفهم سر نجاحها. اسألني عن اسمها.", c: "#f472b6" },
  { ic: "🛠️", t: "خطة تطوير", d: "من الفكرة إلى أول نسخة تُلعب", m: "عندي فكرة لعبة وابي خطة تطوير واضحة. اسألني عنها.", c: "#a3e635" },
  { ic: "🧩", t: "حل مشكلة في لعبتي", d: "اللعبة ما تمتّع؟ نكتشف السبب", m: "لعبتي فيها مشكلة وابي نحلها. اسألني عنها.", c: "#fbbf24" },
];

/** The answer's light markdown (headings, lists, bold, rules) as elements. */
function Rich({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => (/^\*\*[^*]+\*\*$/.test(p) ? <b key={i}>{p.slice(2, -2)}</b> : /^`[^`]+`$/.test(p) ? <code key={i}>{p.slice(1, -1)}</code> : <Swatches key={i} text={p} cls="gm" />));
  const out: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  // a fenced block (a prompt to copy, for one) is kept as it is, with its own copy button
  let code: string[] | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    out.push(<Tag key={out.length}>{list.items.map((x, i) => <li key={i}>{inline(x)}</li>)}</Tag>);
    list = null;
  };
  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) {
      flush();
      if (code) {
        out.push(<CodeBlock key={out.length} text={code.join("\n")} />);
        code = null;
      } else code = [];
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    const li = /^\s*(?:([-•*])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (li) {
      const ordered = Boolean(li[2]);
      if (list && list.ordered !== ordered) flush();
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
  if (code) out.push(<CodeBlock key={out.length} text={code.join("\n")} />);
  return <>{out}</>;
}

/** A block to copy as it is (the prompt «قنبر» writes to take elsewhere). */
function CodeBlock({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="gm-code">
      <button
        type="button"
        className="gm-mini"
        onClick={() =>
          void navigator.clipboard
            ?.writeText(text.trim())
            .then(() => {
              setDone(true);
              setTimeout(() => setDone(false), 1800);
            })
            .catch(() => null)
        }
      >
        {done ? "انسخ ✓" : "📋 انسخ البرومبت"}
      </button>
      <pre dir="auto">{text.trim()}</pre>
    </div>
  );
}

const PIPS: Record<string, [number, number][]> = {
  f1: [[50, 50]],
  f2: [[28, 28], [72, 72]],
  f3: [[28, 28], [50, 50], [72, 72]],
  f4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  f5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  f6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
};

/** A cube whose faces carry dice pips. */
function Cube({ size, color, t, rolling }: { size: number; color: string; t?: number; rolling?: boolean }) {
  return (
    <div className={`gm-cube ${rolling ? "gm-die rolling" : ""}`} style={{ "--s": `${size}px`, "--c": color, ...(t ? { "--t": `${t}s` } : {}) } as CSSProperties}>
      {Object.entries(PIPS).map(([f, pips]) => (
        <div key={f} className={`gm-face ${f}`}>
          {pips.map(([x, y], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%` }} />)}
        </div>
      ))}
    </div>
  );
}

const FLOATERS: { s: number; c: string; t: number; d: number; top: string; left: string }[] = [
  { s: 64, c: "#22d3ee", t: 22, d: 30, top: "12%", left: "6%" },
  { s: 40, c: "#f472b6", t: 16, d: 46, top: "58%", left: "3%" },
  { s: 52, c: "#fbbf24", t: 26, d: 24, top: "20%", left: "90%" },
  { s: 34, c: "#a3e635", t: 14, d: 52, top: "70%", left: "93%" },
];

export default function GamesChat({ name, persona, loginHref }: { name: string; persona: string; loginHref: string | null }) {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [mine, setMine] = useState<{ id: string; title: string; link: string; chatId: string | null }[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [side, setSide] = useState(false);
  const [mode, setMode] = useState<Mode>("");
  const [sheet, setSheet] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const games = useBuilds(chatId, !loginHref);
  const root = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    if (loginHref) return;
    try {
      setChats((await api<{ chats: ChatItem[] }>("/api/games/chats")).chats);
    } catch { /* the list is a convenience */ }
    try {
      // the games built so far (ready ones), to play again from the side
      const r = await api<{ builds: { id: string; title: string; link: string; chatId: string | null; status: string }[] }>("/api/games/build");
      setMine(r.builds.filter((b) => b.status === "ready"));
    } catch { /* not ready yet (0050), or nothing built */ }
  }, [loginHref]);
  useEffect(() => { void refresh(); }, [refresh]);
  // the newest at the bottom in sight (a new conversation stays at its top: the two ways first)
  useEffect(() => { if (msgs.length || busy) end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  // the pointer moves the floating cubes a little (parallax); off for reduced motion
  const move = (e: React.PointerEvent) => {
    const r = root.current;
    if (!r || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    r.style.setProperty("--mx", String((e.clientX / window.innerWidth - 0.5) * 2));
    r.style.setProperty("--my", String((e.clientY / window.innerHeight - 0.5) * 2));
  };

  async function open(id: string) {
    setSide(false);
    try {
      const r = await api<{ chat: { id: string; messages: Msg[]; mode?: Mode } }>(`/api/games/chats?id=${id}`);
      setChatId(r.chat.id);
      setMsgs(r.chat.messages);
      setMode(r.chat.mode ?? "");
      setSheet(false);
      setStartError("");
    } catch (e) {
      setMsgs([{ role: "assistant", text: e instanceof Error ? e.message : "تعذّر فتح المحادثة.", error: true }]);
    }
  }
  const fresh = () => { setChatId(null); setMsgs([]); setSide(false); setMode(""); setSheet(false); setStartError(""); };

  const [claude] = useClaudeModel();

  async function send(text = q, way: Mode = mode) {
    const message = text.trim();
    if (!message || busy) return;
    setQ("");
    setBusy(true);
    setMode(way);
    setMsgs((m) => [...m, { role: "user", text: message }]);
    try {
      const r = await postJson<{ chatId: string; text: string }>("/api/games/chat", { chatId, message, model: claude.id, ...(way ? { mode: way } : {}) });
      setChatId(r.chatId);
      setMsgs((m) => [...m, { role: "assistant", text: r.text }]);
      void refresh();
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر الرد.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  // «🎮 ابنِ اللعبة»: the plan is made (about a minute), then the card follows the code and the pictures
  async function build(pictures: boolean) {
    if (!chatId || starting) return;
    setStarting(true);
    setStartError("");
    try {
      await games.start(chatId, pictures);
      setSheet(false);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "تعذّر بدء بناء اللعبة.");
    } finally {
      setStarting(false);
    }
  }
  const canBuild = !loginHref && !!chatId && msgs.some((m) => m.role === "assistant" && !m.error);
  // a game just got ready: it joins «ألعابي» on the side
  const readyCount = games.builds.filter((b) => b.status === "ready").length;
  // a new card comes into sight
  const cards = games.builds.length;
  useEffect(() => { if (cards) end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [cards]);
  useEffect(() => { if (readyCount) void refresh(); }, [readyCount, refresh]);

  async function remove(id: string) {
    if (!confirm("نحذف هذي المحادثة؟")) return;
    await fetch(`/api/games/chats?id=${id}`, { method: "DELETE" }).catch(() => null);
    if (id === chatId) fresh();
    void refresh();
  }

  return (
    <div className="gm" ref={root} onPointerMove={move}>
      <div className="gm-scene" aria-hidden>
        {FLOATERS.map((f, i) => (
          <div key={i} className="gm-float" style={{ top: f.top, left: f.left, ["--depth" as string]: `${f.d}px` }}>
            <Cube size={f.s} color={f.c} t={f.t} />
          </div>
        ))}
      </div>

      <div className="gm-wrap">
        <aside className={`gm-side gm-glass ${side ? "open" : ""}`}>
          <button className="gm-send" style={{ minWidth: 0, width: "100%" }} onClick={fresh}>＋ محادثة جديدة</button>
          <div className="gm-chats">
            {chats.map((c) => (
              <div key={c.id} className="gm-chat-item" aria-current={c.id === chatId} onClick={() => open(c.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(c.id)}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                <button className="gm-mini" aria-label="احذف" onClick={(e) => { e.stopPropagation(); void remove(c.id); }}>✕</button>
              </div>
            ))}
            {!loginHref && chats.length === 0 && <p style={{ color: "#94a3b8", fontSize: 13 }}>محادثاتك تظهر هنا.</p>}
          </div>
          {mine.length > 0 && (
            <div className="gm-mine">
              <b>🎮 ألعابي</b>
              {mine.slice(0, 12).map((g) => (
                <a key={g.id} href={g.link} target="_blank" rel="noopener">▶ {g.title}</a>
              ))}
            </div>
          )}
          <Link href="/jawad-ai" className="gm-mini" style={{ textAlign: "center" }}>← الرئيسية</Link>
        </aside>

        <section className="gm-main gm-glass">
          <header className="gm-head">
            <button className="gm-burger gm-mini" onClick={() => setSide((s) => !s)} aria-label="المحادثات">☰</button>
            <div className="gm-scene-die"><Cube size={34} color="#a78bfa" rolling={busy} /></div>
            <div>
              <div className="gm-title">{name}</div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>تكلّم مع {persona}</div>
            </div>
          </header>

          <div className="gm-feed">
            {loginHref ? (
              <div className="gm-msg bot">
                <p>سجّل دخولك عشان تتكلم مع {persona}.</p>
                <div className="gm-actions"><Link className="gm-mini" href={loginHref}>تسجيل الدخول</Link></div>
              </div>
            ) : msgs.length === 0 ? (
              <>
                <div className="gm-msg bot">
                  <h3>هلا، أنا {persona} 🎮</h3>
                  <p>أصمّم معك لعبتك من الفكرة لين تصير جاهزة. تبيني أصنعها لك هنا وتلعبها برابط، ولا أعطيك برومبت توديه لمكان ثاني؟</p>
                </div>
                <div className="gm-modes">
                  {MODES.map((w, i) => (
                    <button key={w.mode} className="gm-card gm-mode" style={{ ["--c" as string]: w.c, animationDelay: `${i * 90}ms` }} onClick={() => send(w.m, w.mode)}>
                      <span className="ic">{w.ic}</span>
                      <b>{w.t}</b>
                      <small>{w.d}</small>
                    </button>
                  ))}
                </div>
                <p className="gm-or">أو ابدأ من هنا:</p>
                <div className="gm-start">
                  {STARTS.map((s, i) => (
                    <button key={s.t} className="gm-card" style={{ ["--c" as string]: s.c, animationDelay: `${i * 90}ms` }} onClick={() => send(s.m)}>
                      <span className="ic">{s.ic}</span>
                      <b>{s.t}</b>
                      <small>{s.d}</small>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              msgs.map((m, i) => {
                // an answer ends with clickable options (a block the person doesn't read as text); only the last answer's are offered
                const { body, options } = m.role === "assistant" && !m.error ? splitOptions(m.text) : { body: m.text, options: [] as string[] };
                const last = i === msgs.length - 1 && !busy;
                return (
                  <div key={i} className={`gm-msg ${m.role === "user" ? "user" : "bot"} ${m.error ? "err" : ""}`}>
                    {m.role === "user" ? <p style={{ whiteSpace: "pre-wrap" }}>{m.text}</p> : <Rich text={body} />}
                    {last && !loginHref && <QuickReplies cls="gm" options={options} disabled={!!busy} onPick={(o) => (canBuild && BUILD_NOW.test(o) ? (setStartError(""), setSheet(true)) : void send(o))} onWrite={() => box.current?.focus()} />}
                    {m.role === "assistant" && !m.error && (
                      <div className="gm-actions"><button className="gm-mini" onClick={() => navigator.clipboard?.writeText(body).catch(() => null)}>انسخ</button></div>
                    )}
                  </div>
                );
              })
            )}
            {games.builds.map((b) => (
              <BuildCard key={b.id} b={b} note={games.notes[b.id]} onEdit={(c) => void games.edit(b, c)} onRetry={() => setSheet(true)} onRemove={() => void games.remove(b)} />
            ))}
            {busy && (
              <div className="gm-think">
                <span className="gm-dots"><span /><span /><span /></span>
                {persona} يفكر…
              </div>
            )}
            <div ref={end} />
          </div>

          {!loginHref && (
            <>
            {canBuild && sheet && <BuildSheet busy={starting} onGo={(p) => void build(p)} onClose={() => setSheet(false)} />}
            {canBuild && startError && <p className="gm-bnote gm-start-err" role="alert">{startError}</p>}
            {canBuild && !sheet && (
              <div className="gm-buildbar">
                <button type="button" className={`gm-send gm-make ${mode === "build" ? "hot" : ""}`} onClick={() => { setStartError(""); setSheet(true); }} disabled={starting}>
                  🎮 اصنع اللعبة
                </button>
                <span>{mode === "prompt" ? "أو قنبر يعطيك البرومبت في المحادثة" : "الموقع يبنيها لك ويعطيك رابط تلعبها"}</span>
              </div>
            )}
            <ClaudeModelPicker className="gm-claude" disabled={busy} />
            <form className="gm-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
              <MicButton onText={(t) => setQ((v) => (v.trim() ? `${v.trim()} ${t}` : t))} disabled={busy} className="gm-send" />
              <textarea
                ref={box}
                className="gm-input"
                dir="auto"
                rows={1}
                value={q}
                maxLength={6000}
                placeholder={`اكتب لـ${persona}…`}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
              />
              <button className="gm-send" disabled={busy || !q.trim()}>{busy ? "…" : "أرسل"}</button>
            </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
