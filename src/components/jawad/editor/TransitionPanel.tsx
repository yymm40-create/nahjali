"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { emptyTimeline, TRANSITION_MS, type Clip, type Timeline } from "@/lib/editor/model";
import { TR_CATS, TR_LIST, type TrCat } from "@/lib/editor/transitions";
import type { Run } from "./Inspector";
import { drawFrame } from "./render";

/** One transition's tile: on hover it plays between this clip's picture and the next one's (the real drawing). */
function Tile({ id, label, icon, a, b, on, disabled, onPick }: { id: string; label: string; icon: string; a: HTMLImageElement | null; b: HTMLImageElement | null; on: boolean; disabled: boolean; onPick: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    const el = cv.current;
    if (!el || !hover || !a || !b) return;
    const ctx = el.getContext("2d")!;
    // a little timeline of two pictures touching, with this transition between them (1.2 s, looping)
    const tl: Timeline = { ...emptyTimeline("16:9"), width: el.width, height: el.height, background: "#0b1020" };
    const mk = (cid: string, start: number, img: string): Clip => ({ id: cid, assetId: img, start, in: 0, out: 1600, speed: 1, volume: 1, fit: "cover", transform: { x: 0.5, y: 0.5, scale: 1, rotate: 0, opacity: 1 }, text: null, keys: [], color: null, grades: [], crop: null, blend: "normal", key: null, seq: null, transition: null, fadeIn: 0, fadeOut: 0, shape: "rect", words: [], bg: null, own: false, sound: null, anim: null, fx: [], fix: null });
    const A = { ...mk("a", 0, "a"), transition: { kind: id, ms: 1200 } };
    tl.tracks = [{ id: "v", kind: "video", name: "", muted: false, hidden: false, locked: false, duck: false, clips: [A, mk("b", 1600, "b")] }];
    const frame = (c: Clip) => {
      const img = c.assetId === "a" ? a : b;
      return { img, width: img.naturalWidth, height: img.naturalHeight };
    };
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const ms = 1000 + (((now - t0) / 1) % 1600) * 0.75;
      drawFrame(ctx, tl, ms, frame);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hover, a, b, id]);
  return (
    <button type="button" disabled={disabled} aria-pressed={on} onClick={onPick} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} className={`jw-3d relative overflow-hidden rounded-xl border text-start ${on ? "border-jw-accent ring-2 ring-jw-accent" : "border-jw-line"}`}>
      <span className="relative block aspect-video bg-jw-surface-2">
        <canvas ref={cv} width={160} height={90} className={`absolute inset-0 h-full w-full ${hover && a && b ? "" : "hidden"}`} />
        {!(hover && a && b) && <span className="grid h-full place-items-center text-2xl">{icon}</span>}
      </span>
      <span className="block truncate px-1.5 py-1 text-[10px]">{label}</span>
    </button>
  );
}

const useImage = (src: string | null) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return;
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);
  return src ? img : null;
};

/** «انتقال»: 100 transitions into the next clip, by group or name, and how long it takes. */
export default function TransitionPanel({ clip, trackId, thumbA, thumbB, locked, run }: { clip: Clip; trackId: string; thumbA: string | null; thumbB: string | null; locked: boolean; run: Run }) {
  const [cat, setCat] = useState<TrCat | "all">("all");
  const [q, setQ] = useState("");
  const a = useImage(thumbA);
  const b = useImage(thumbB);
  const list = useMemo(() => TR_LIST.filter((t) => (cat === "all" || t.cat === cat) && (!q.trim() || t.label.includes(q.trim()))), [cat, q]);
  const set = (transition: { kind: string; ms?: number } | null, key: string) => run({ type: "update_clip", clipId: clip.id, patch: { transition } }, { coalesce: `${clip.id}:tr:${key}` });
  const cur = clip.transition;
  return (
    <div className="space-y-3">
      <p className="text-xs text-jw-muted">من هذا المقطع إلى اللي بعده. مرّر على أي انتقال تشوفه يتحرك.</p>
      {cur && (
        <div className="space-y-2 rounded-xl border border-jw-line p-2">
          <p className="text-xs font-semibold">
            {TR_LIST.find((t) => t.id === cur.kind)?.icon} {TR_LIST.find((t) => t.id === cur.kind)?.label}
          </p>
          <label className="block space-y-1">
            <span className="flex items-center justify-between text-xs text-jw-muted">
              <span>المدة</span>
              <span className="tabular-nums text-jw-ink" dir="ltr">{(cur.ms / 1000).toFixed(1)} ث</span>
            </span>
            <input type="range" className="w-full accent-[var(--jw-accent)]" min={TRANSITION_MS.min} max={TRANSITION_MS.max} step={100} disabled={locked} value={cur.ms} onChange={(e) => set({ kind: cur.kind, ms: Number(e.target.value) }, "ms")} aria-label="مدة الانتقال" />
          </label>
          <div className="flex gap-1.5">
            <button type="button" className="jw-btn !min-h-8 flex-1 text-[11px]" disabled={locked} onClick={() => run({ type: "transition_all", trackId, kind: cur.kind, ms: cur.ms })}>
              طبّقه على كل القصّات
            </button>
            <button type="button" className="jw-btn jw-btn-quiet !min-h-8 flex-1 text-[11px]" disabled={locked} onClick={() => set(null, "off")}>
              بدون انتقال
            </button>
          </div>
        </div>
      )}
      <input className="jw-input !min-h-9 w-full text-sm" placeholder="ابحث باسم الانتقال…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex flex-wrap gap-1">
        {(["all", ...Object.keys(TR_CATS)] as (TrCat | "all")[]).map((k) => (
          <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)} className={`jw-chip !px-2 !py-0.5 !text-[11px] ${cat === k ? "!border-jw-accent !text-jw-ink" : ""}`}>
            {k === "all" ? `الكل (${TR_LIST.length})` : TR_CATS[k]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {list.map((t) => (
          <Tile key={t.id} id={t.id} label={t.label} icon={t.icon} a={a} b={b} on={cur?.kind === t.id} disabled={locked} onPick={() => set({ kind: t.id, ms: cur?.ms ?? TRANSITION_MS.default }, "kind")} />
        ))}
      </div>
    </div>
  );
}
