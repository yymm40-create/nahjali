"use client";

// «اصنع اللعبة» in the conversation with «قنبر»: the builds of a conversation (driven step by step until they are ready, also
// after a reload), the sheet that starts one (with or without drawn pictures, and what they cost), and each game's card — its
// cover, its progress, «▶ العب الحين», its link to copy or send on WhatsApp, and «✏️ عدّل» to change it at the client's word.

import { useCallback, useEffect, useRef, useState } from "react";
import Riyal from "@/components/Riyal";
import { api, postJson } from "@/lib/fetch";
import { findClaudeModel } from "@config/claude-models";
import { GAME_BUILD } from "@config/games-build";

/** The mind that writes every game (the fastest at code), by our own name. */
const WRITER = findClaudeModel(GAME_BUILD.model)?.name ?? "";

export interface Build {
  id: string;
  chatId: string | null;
  title: string;
  summary: string;
  status: "building" | "ready" | "failed";
  code: "pending" | "writing" | "broken" | "done" | "failed";
  /** the code's writing stopped in the middle and goes on from there */
  more?: boolean;
  editing: boolean;
  art: "pending" | "drawing" | "done";
  pictures: { done: number; failed: number; total: number };
  cover: string | null;
  link: string;
  version: number;
  error: string;
  playerErrors: number;
  createdAt: string;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const getBuild = (id: string) => api<{ build: Build }>(`/api/games/build?id=${id}`).then((r) => r.build).catch(() => null);

/** One step on the server: the build as it stands, or why it stopped (a refusal: the balance, for one). A request cut off says neither. */
async function step(body: { id: string; part: "code" | "art"; change?: string }): Promise<{ build?: Build; stop?: string }> {
  try {
    const res = await fetch("/api/games/build/step", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    const j = (await res.json().catch(() => ({}))) as { build?: Build; error?: string };
    if (res.ok && j.build) return { build: j.build };
    if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) return { stop: j.error ?? "تعذّر إكمال اللعبة." };
    return {};
  } catch {
    return {};
  }
}

/** The builds of the open conversation, and what can be done with them. */
export function useBuilds(chatId: string | null, enabled: boolean) {
  const [data, setData] = useState<{ chat: string | null; list: Build[] }>({ chat: null, list: [] });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const driving = useRef(new Set<string>());

  const put = useCallback((b: Build) => {
    setData((d) => (d.chat !== b.chatId ? d : { ...d, list: d.list.some((x) => x.id === b.id) ? d.list.map((x) => (x.id === b.id ? b : x)) : [...d.list, b] }));
  }, []);

  // the code and the pictures side by side, each asked again until done (a cut-off request is picked up again later)
  const drive = useCallback(
    async (id: string) => {
      if (driving.current.has(id)) return;
      driving.current.add(id);
      const part = async (p: "code" | "art") => {
        const until = Date.now() + 40 * 60_000;
        while (Date.now() < until) {
          const r = await step({ id, part: p });
          if (r.stop) {
            setNotes((n) => ({ ...n, [id]: r.stop! }));
            return;
          }
          const b = r.build ?? (await wait(8000).then(() => getBuild(id)));
          if (!b) continue;
          put(b);
          const st = p === "code" ? b.code : b.art;
          if (b.status === "failed" || st === "done" || st === "failed") return;
          if (st === "writing" || st === "drawing") await wait(10_000);
        }
      };
      try {
        await Promise.all([part("code"), part("art")]);
      } finally {
        driving.current.delete(id);
        const b = await getBuild(id);
        if (b) put(b);
      }
    },
    [put],
  );

  useEffect(() => {
    if (!enabled || !chatId) return;
    let live = true;
    api<{ builds: Build[] }>(`/api/games/build?chatId=${chatId}`)
      .then((r) => {
        if (!live) return;
        setData({ chat: chatId, list: r.builds });
        for (const b of r.builds) if (b.status === "building" || b.editing) void drive(b.id);
      })
      .catch(() => live && setData({ chat: chatId, list: [] }));
    return () => {
      live = false;
    };
  }, [chatId, enabled, drive]);

  /** «اصنع اللعبة»: the plan is made now, then the code and the pictures. */
  async function start(chat: string, pictures: boolean) {
    const r = await postJson<{ build: Build }>("/api/games/build", { chatId: chat, pictures });
    setData((d) => ({ chat, list: [...(d.chat === chat ? d.list : []), r.build] }));
    void drive(r.build.id);
    return r.build;
  }

  /** «✏️ عدّل»: the client's words (or, empty, the errors players ran into) go to the builder; the same link plays the new version. */
  async function edit(b: Build, change: string) {
    setNotes((n) => ({ ...n, [b.id]: "" }));
    put({ ...b, editing: true, code: "writing", error: "" });
    const r = await step({ id: b.id, part: "code", change });
    if (r.stop) {
      setNotes((n) => ({ ...n, [b.id]: r.stop! }));
      const now = await getBuild(b.id);
      if (now) put(now);
      return;
    }
    if (r.build) put(r.build);
    void drive(b.id);
  }

  async function remove(b: Build) {
    await fetch(`/api/games/build?id=${b.id}`, { method: "DELETE" }).catch(() => null);
    setData((d) => ({ ...d, list: d.list.filter((x) => x.id !== b.id) }));
  }

  return { builds: data.chat === chatId ? data.list : [], notes, start, edit, remove };
}

/** The sheet before building: what happens, how long, what it costs, with or without drawn pictures. */
export function BuildSheet({ busy, onGo, onClose }: { busy: boolean; onGo: (pictures: boolean) => void; onClose: () => void }) {
  const [pictures, setPictures] = useState(true);
  const [quote, setQuote] = useState<{ picture: number | null; cover: number | null; free: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    api<{ picture: number | null; cover: number | null; free: boolean }>("/api/games/build?quote=1")
      .then((q) => live && setQuote(q))
      .catch(() => null);
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className="gm-sheet" role="dialog" aria-modal="false" aria-label="اصنع اللعبة">
      <div className="gm-sheet-head">
        <b>🎮 قنبر بيبني لعبتك الحين</b>
        <button type="button" className="gm-mini" onClick={onClose} aria-label="إغلاق">✕</button>
      </div>
      <ul className="gm-sheet-list">
        <li>يقرأ محادثتكم ويكتب اللعبة كاملة، تنلعب على الجوال والكمبيوتر.</li>
        <li>{pictures ? "جواد يرسم غلافها وصورها (الأبطال والخلفية…)." : "جواد يرسم غلافها بس، واللعبة بأشكال وألوان."}</li>
        <li>تاخذ تقريبًا ٢–٥ دقايق، وتقدر تكمل كلامك مع قنبر وهي تنبني.</li>
        <li>بالأخير يطلع لك رابط: تضغطه وتلعب، وترسله لربعك.</li>
      </ul>
      <div className="gm-seg" role="radiogroup" aria-label="الصور">
        <button type="button" role="radio" aria-checked={pictures} className={pictures ? "on" : ""} onClick={() => setPictures(true)}>
          🎨 مع صور مرسومة <small>أحلى</small>
        </button>
        <button type="button" role="radio" aria-checked={!pictures} className={!pictures ? "on" : ""} onClick={() => setPictures(false)}>
          ⚡ بدون صور <small>أسرع وأرخص</small>
        </button>
      </div>
      <p className="gm-cost">
        {quote?.free ? (
          "مجانًا لحسابك."
        ) : (
          <>
            التكلفة من رصيدك: كتابة اللعبة حسب الاستهلاك{WRITER ? ` (يكتبها «${WRITER}»، الأسرع بالكود)` : ""}{" "}
            {quote?.cover != null && (
              <>
                + الغلاف <Riyal halalas={quote.cover} size={13} />
              </>
            )}
            {pictures && quote?.picture != null && (
              <>
                {" "}
                + كل صورة <Riyal halalas={quote.picture} size={13} /> (حتى ٥ صور)
              </>
            )}
            . الصورة اللي تفشل يرجع رصيدها.
          </>
        )}
      </p>
      <button type="button" className="gm-send gm-go" disabled={busy} onClick={() => onGo(pictures)}>
        {busy ? "قنبر يخطط اللعبة…" : "🎮 ابنِ اللعبة"}
      </button>
    </div>
  );
}

const stage = (b: Build) => {
  if (b.status === "failed") return "";
  if (b.more) return "يكمّل كتابة الكود من وين وقف…";
  if (b.editing) return b.code === "broken" ? "يصلّح أخطاء التعديل…" : "يطبّق تعديلك…";
  if (b.code === "pending") return "يجهّز كتابة الكود…";
  if (b.code === "writing") return "يكتب كود اللعبة…";
  if (b.code === "broken") return "لقى أخطاء ويصلّحها…";
  return "الكود جاهز ✓";
};

/** A game's card under the conversation. */
export function BuildCard({ b, note, onEdit, onRetry, onRemove }: { b: Build; note?: string; onEdit: (change: string) => void; onRetry: () => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [change, setChange] = useState("");
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? b.link : `${window.location.origin}${b.link}`;
  const share = `جرّب لعبتي «${b.title}» 🎮\n${url}`;
  const building = b.status === "building";
  const ready = b.status === "ready";
  const working = building || b.editing;

  const copy = () => {
    void navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => null);
  };

  return (
    <article className={`gm-build ${b.status}`} aria-busy={working}>
      <div className="gm-bcover">
        {b.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- the game's own cover, drawn for it
          <img src={b.cover} alt={`غلاف ${b.title}`} />
        ) : (
          <div className="gm-bph" aria-hidden>
            <span>🎮</span>
            <b>{b.title}</b>
          </div>
        )}
        {ready && !b.editing && (
          <a className="gm-bplay" href={b.link} target="_blank" rel="noopener" aria-label={`العب ${b.title}`}>
            ▶
          </a>
        )}
        {working && (
          <div className="gm-bwork" aria-hidden>
            <span className="gm-dots"><span /><span /><span /></span>
          </div>
        )}
      </div>
      <div className="gm-bbody">
        <div className="gm-btitle">
          <b>{b.title}</b>
          {ready && !b.editing && <span className="gm-bok">جاهزة ✓</span>}
        </div>
        {b.summary && <p className="gm-bsum">{b.summary}</p>}

        {working && (
          <ul className="gm-bsteps" aria-live="polite">
            {!b.editing && <li className="ok">✓ الخطة جاهزة</li>}
            <li className={b.code === "done" ? "ok" : "now"}>{stage(b)}</li>
            {!b.editing && (
              <li className={b.art === "done" ? "ok" : "now"}>
                {b.art === "done" ? `الصور جاهزة ✓ (${b.pictures.done}/${b.pictures.total})` : `جواد يرسم الصور… ${b.pictures.done}/${b.pictures.total}`}
              </li>
            )}
          </ul>
        )}

        {(note || b.error) && <p className="gm-bnote" role="status">{note || b.error}</p>}

        {ready && !b.editing && (
          <>
            <div className="gm-bact">
              <a className="gm-send gm-bgo" href={b.link} target="_blank" rel="noopener">▶ العب الحين</a>
              <button type="button" className="gm-btn" onClick={copy}>{copied ? "انسخ ✓" : "🔗 انسخ الرابط"}</button>
              <a className="gm-btn" href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener">واتساب</a>
              <button type="button" className="gm-btn" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>✏️ عدّل</button>
            </div>
            {b.playerErrors > 0 && !editing && (
              <div className="gm-bwarn">
                ⚠️ صار خطأ في اللعبة عند أحد اللاعبين.
                <button type="button" className="gm-mini" onClick={() => onEdit("")}>🛠️ صلّحها</button>
              </div>
            )}
            {editing && (
              <form
                className="gm-bedit"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!change.trim()) return;
                  onEdit(change.trim());
                  setChange("");
                  setEditing(false);
                }}
              >
                <textarea className="gm-input" dir="auto" rows={2} maxLength={2000} value={change} onChange={(e) => setChange(e.target.value)} placeholder="وش تبي يتغير؟ مثلًا: خل اللاعب أسرع، زد الأعداء، غيّر الألوان…" aria-label="التعديل" />
                <button type="submit" className="gm-send" disabled={!change.trim()}>عدّل</button>
              </form>
            )}
          </>
        )}

        {b.status === "failed" && (
          <div className="gm-bact">
            <button type="button" className="gm-send gm-bgo" onClick={onRetry}>🔄 ابنها من جديد</button>
            <button type="button" className="gm-btn" onClick={onRemove}>احذف</button>
          </div>
        )}
      </div>
    </article>
  );
}
