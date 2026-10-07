"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { api, postJson } from "@/lib/fetch";

/** The thing that was under the click, in a few words (for the dashboard: what the note is about). */
function describe(el: Element | null) {
  if (!el) return "";
  const parts: string[] = [];
  let e: Element | null = el;
  for (let i = 0; e && i < 3; i++, e = e.parentElement) {
    const label = e.getAttribute("aria-label") || e.getAttribute("title");
    const own = (label || (e as HTMLElement).innerText || "").replace(/\s+/g, " ").trim().slice(0, 60);
    parts.push(`${e.tagName.toLowerCase()}${own ? `«${own}»` : ""}`);
    if (own) break;
  }
  return parts.join(" ← ").slice(0, 300);
}

type Spot = { x: number; y: number; vx: number; vy: number; target: string };
type Shown = { id: string; name: string; note: string; x: number | null; y: number | null; vx: number | null; target: string; viewport: string };

/**
 * «الملاحظ حسن»: a small icon on every page. A signed-in person presses it, clicks the exact spot, and leaves their
 * name and a note for the site's development; it goes to the dashboard's «الملاحظات» with where it was left.
 * An owner opening a note's link (?note=…) sees its pin on the page.
 */
export default function NotesPin() {
  const path = usePathname();
  const params = useSearchParams();
  const [mode, setMode] = useState<"off" | "pick" | "form" | "login" | "sent">("off");
  const [spot, setSpot] = useState<Spot | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shown, setShown] = useState<Shown | null>(null);

  // an owner opening a note from the dashboard: its pin, where it was left
  const noteId = params.get("note");
  useEffect(() => {
    if (!noteId) return;
    api<{ note: Shown }>(`/api/notes?id=${encodeURIComponent(noteId)}`)
      .then(({ note: n }) => {
        setShown(n);
        if (n.y !== null) setTimeout(() => window.scrollTo({ top: Math.max(0, n.y! - window.innerHeight / 2), behavior: "smooth" }), 600);
      })
      .catch(() => {});
  }, [noteId]);

  useEffect(() => {
    if (mode !== "pick") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMode("off");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  async function start() {
    setError("");
    const me = await api<{ signedIn: boolean; name: string }>("/api/notes").catch(() => ({ signedIn: false, name: "" }));
    if (!me.signedIn) return setMode("login");
    if (!name) setName(me.name);
    setMode("pick");
  }
  function pick(e: React.MouseEvent<HTMLDivElement>) {
    const layer = e.currentTarget;
    layer.style.pointerEvents = "none";
    const under = document.elementFromPoint(e.clientX, e.clientY);
    layer.style.pointerEvents = "";
    setSpot({ x: e.clientX + window.scrollX, y: e.clientY + window.scrollY, vx: e.clientX, vy: e.clientY, target: describe(under) });
    setMode("form");
  }
  async function send() {
    if (!spot) return;
    setBusy(true);
    setError("");
    try {
      await postJson("/api/notes", { name, note, path: window.location.pathname + window.location.search, ...spot, viewport: `${window.innerWidth}×${window.innerHeight}` });
      setNote("");
      setMode("sent");
      setTimeout(() => setMode("off"), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الإرسال.");
    } finally {
      setBusy(false);
    }
  }

  const login = path.startsWith("/jawad-ai") ? `/jawad-ai/login?next=${encodeURIComponent(path)}` : `/login?next=${encodeURIComponent(path)}`;
  // the form opens next to the spot, kept inside the window
  const formPos = spot
    ? { left: Math.min(Math.max(8, spot.vx - 150), (typeof window === "undefined" ? 400 : window.innerWidth) - 308), top: Math.min(spot.vy + 18, (typeof window === "undefined" ? 600 : window.innerHeight) - 300) }
    : undefined;

  return (
    <div dir="rtl" className="notes-pin">
      {/* the icon */}
      {mode === "off" && (
        <button
          type="button"
          onClick={start}
          title="الملاحظ حسن: حط ملاحظتك على أي مكان في الصفحة"
          aria-label="الملاحظ حسن: حط ملاحظة"
          className="fixed bottom-4 left-4 z-[90] grid size-11 place-items-center rounded-full border border-white/50 bg-amber-400 text-xl shadow-lg transition hover:scale-110"
          style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          📝
        </button>
      )}

      {/* choosing the spot */}
      {mode === "pick" && (
        <div className="fixed inset-0 z-[95] cursor-crosshair bg-amber-400/10" onClick={pick}>
          <div className="pointer-events-none fixed inset-x-0 top-3 mx-auto w-fit rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-lg">
            📍 اضغط على المكان اللي تبي تحط عليه ملاحظتك · Esc للإلغاء
          </div>
        </div>
      )}

      {/* the note */}
      {mode === "form" && spot && (
        <>
          <div className="fixed inset-0 z-[95] bg-black/20" onClick={() => setMode("off")} />
          <span className="pointer-events-none fixed z-[96] -translate-x-1/2 -translate-y-full text-3xl drop-shadow" style={{ left: spot.vx, top: spot.vy }} aria-hidden>
            📍
          </span>
          <form
            className="fixed z-[97] w-[300px] space-y-2 rounded-2xl bg-white p-3 text-slate-900 shadow-2xl"
            style={formPos}
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <p className="font-extrabold">📝 الملاحظ حسن</p>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold" placeholder="اسمك" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="اسمك" />
            <textarea autoFocus className="h-24 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="ملاحظتك للتطوير: وش تبي يتغير هنا؟" value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} aria-label="ملاحظتك" />
            {error && <p className="text-xs font-bold text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button className="flex-1 rounded-xl bg-amber-500 py-2 font-extrabold text-white disabled:opacity-50" disabled={busy || !note.trim() || !name.trim()}>
                {busy ? "لحظة…" : "أرسل"}
              </button>
              <button type="button" className="rounded-xl px-3 font-bold text-slate-500 hover:bg-slate-100" onClick={() => setMode("off")}>
                إلغاء
              </button>
            </div>
          </form>
        </>
      )}

      {(mode === "login" || mode === "sent") && (
        <div className="fixed bottom-4 left-4 z-[97] w-72 space-y-2 rounded-2xl bg-white p-4 text-slate-900 shadow-2xl">
          {mode === "sent" ? (
            <p className="font-extrabold">✅ وصلت ملاحظتك، شكرًا لك!</p>
          ) : (
            <>
              <p className="font-extrabold">📝 الملاحظ حسن</p>
              <p className="text-sm font-bold text-slate-500">سجّل دخولك أول عشان تقدر تحط ملاحظتك.</p>
              <div className="flex gap-2">
                <a href={login} className="flex-1 rounded-xl bg-amber-500 py-2 text-center font-extrabold text-white">سجّل دخولي</a>
                <button type="button" className="rounded-xl px-3 font-bold text-slate-500 hover:bg-slate-100" onClick={() => setMode("off")}>لاحقًا</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* an owner looking at a note: its pin */}
      {shown && shown.x !== null && shown.y !== null && (
        <div className="absolute z-[89]" style={{ left: shown.x, top: shown.y }}>
          <span className="block -translate-x-1/2 -translate-y-full text-4xl drop-shadow-lg" aria-hidden>📍</span>
          <div className="absolute start-2 top-1 w-64 space-y-1 rounded-2xl bg-white p-3 text-sm text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <b>{shown.name}</b>
              <button type="button" className="text-slate-400" onClick={() => setShown(null)} aria-label="أخفِ">✕</button>
            </div>
            <p className="whitespace-pre-wrap">{shown.note}</p>
            <p className="text-xs text-slate-400">{shown.viewport}{shown.target ? ` · ${shown.target}` : ""}</p>
          </div>
        </div>
      )}
    </div>
  );
}
