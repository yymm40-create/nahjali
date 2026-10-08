"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { api, postJson } from "@/lib/fetch";
import NotesDrag from "./NotesDrag";

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
 * «الملاحظ حسن»: a floating button on every page (drag it anywhere). A signed-in person presses it and writes their name and a note for the
 * site's development straight away (pointing at an exact spot is optional); it goes to the dashboard's «الملاحظات» with where it was left.
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
    // straight to the note (the page and where they are on it are kept); a spot is optional
    setSpot({ x: Math.round(window.scrollX + window.innerWidth / 2), y: Math.round(window.scrollY + window.innerHeight / 2), vx: -1, vy: -1, target: "" });
    setMode("form");
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
      // without a chosen spot: only where they were on the page (the screen's middle), no point on the screen
      const placed = spot.vx >= 0;
      await postJson("/api/notes", { name, note, path: window.location.pathname + window.location.search, ...spot, ...(placed ? {} : { vx: null, vy: null, target: "" }), viewport: `${window.innerWidth}×${window.innerHeight}` });
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
  const formPos = spot && spot.vx >= 0
    ? { left: Math.min(Math.max(8, spot.vx - 150), (typeof window === "undefined" ? 400 : window.innerWidth) - 308), top: Math.min(spot.vy + 18, (typeof window === "undefined" ? 600 : window.innerHeight) - 300) }
    : undefined;

  return (
    <div dir="rtl" className="notes-pin">
      {/* the icon */}
      {mode === "off" && <NotesDrag onTap={start} />}

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
          {spot.vx >= 0 && (
            <span className="pointer-events-none fixed z-[96] -translate-x-1/2 -translate-y-full text-3xl drop-shadow" style={{ left: spot.vx, top: spot.vy }} aria-hidden>
              📍
            </span>
          )}
          <form
            className={`fixed z-[97] w-[320px] max-w-[calc(100vw-1rem)] space-y-2 rounded-2xl bg-white p-3 text-slate-900 shadow-2xl ${formPos ? "" : "bottom-4 left-2 sm:left-4"}`}
            style={formPos}
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <p className="font-extrabold">📝 الملاحظ حسن</p>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold" placeholder="اسمك" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="اسمك" />
            <textarea autoFocus className="h-24 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="ملاحظتك للتطوير: وش تبي يتغير هنا؟" value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} aria-label="ملاحظتك" />
            <button type="button" className="text-xs font-bold text-amber-700 underline" onClick={() => setMode("pick")}>
              {spot.vx >= 0 ? "📍 غيّر المكان" : "📍 حدد مكان معيّن في الصفحة (اختياري)"}
            </button>
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
