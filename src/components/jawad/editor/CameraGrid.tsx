"use client";

// «شبكة الكاميرات» — every camera that filmed the moment under the playhead, side by side, each showing that moment.
// A press on one (or its number on the keyboard) cuts the film to it from there: the cut goes on the «المونتاج»
// track over the cameras, which stay untouched (commands.ts → multicam_cut). It works paused, frame by frame, and
// while playing, like a vision mixer's desk.
// The tiles are small videos of their own (the preview decodes only what is seen): up to LIVE of them play along
// with the film; more than that follow it a step at a time.

import { useEffect, useMemo, useRef, useState } from "react";
import { clipEnd, formatTime, sourceTime, type Clip, type Timeline, type Track } from "@/lib/editor/model";
import { breathCuts, PACES, parseTime, planShots, type Pace } from "@/lib/editor/smart-cut";
import { monoOf, SYNC_RATE } from "./sync";
import type { Command } from "@/lib/editor/commands";
import type { PlayerLike } from "./Timeline";
import type { EditorAsset } from "./types";

/** more cameras than this at one moment follow the film in steps instead of playing */
const LIVE = 9;
const MAX = 16;

export interface Camera {
  clip: Clip;
  track: Track;
}

/** The cameras that filmed `ms`: plain video clips on the picture tracks there (never the cuts made from them). */
export function camerasAt(tl: Timeline, ms: number, kindOf: (assetId: string) => string | undefined): Camera[] {
  const out: Camera[] = [];
  for (const track of tl.tracks) {
    if (track.kind !== "video" || track.role || track.off) continue;
    for (const clip of track.clips) {
      if (clip.start > ms) break;
      if (ms >= clipEnd(clip) || clip.angle || clip.off || clip.text || clip.seq || clip.motion || !clip.assetId || kindOf(clip.assetId) !== "video") continue;
      out.push({ clip, track });
    }
  }
  return out.slice(0, MAX);
}

/**
 * Which tile a key cuts to (0 = the first): the number keys 1–9 and 0 for the tenth, by the PHYSICAL key — so the
 * top row and the number pad both work, and so does an Arabic keyboard, whose number keys type «١٢٣» (the letter
 * the key types is only read when the browser does not say which key it was). Null for any other key.
 */
export function camKey(e: Pick<KeyboardEvent, "key" | "code">): number | null {
  const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code ?? "");
  const typed = "٠١٢٣٤٥٦٧٨٩".indexOf(e.key);
  const n = m ? Number(m[1]) : typed >= 0 ? typed : /^[0-9]$/.test(e.key) ? Number(e.key) : null;
  return n == null ? null : n === 0 ? 9 : n - 1;
}

/** The camera the film shows at `ms`: the one the cut there was made from, else the top one. */
export function liveCamera(tl: Timeline, ms: number, cams: Camera[]): string | null {
  for (const track of tl.tracks) for (const c of track.clips) if (c.angle && c.start <= ms && clipEnd(c) > ms && !track.hidden && !track.off) return c.angle;
  return cams.at(-1)?.clip.id ?? null;
}

/** every camera clip of the timeline (plain video clips on the picture tracks), with its track */
function allCameras(tl: Timeline, kindOf: (assetId: string) => string | undefined): Camera[] {
  return tl.tracks.flatMap((track) => (track.kind !== "video" || track.role || track.off ? [] : track.clips.filter((c) => !c.angle && !c.off && !c.text && !c.seq && !c.motion && !!c.assetId && kindOf(c.assetId) === "video").map((clip) => ({ clip, track }))));
}

const STEP = 20;
/**
 * How loud the film's sound is every STEP ms from `from` to `to`: read off the sound clip that covers most of the
 * stretch (the poem's own track), on this device. Null when there is none to read.
 */
async function loudness(tl: Timeline, from: number, to: number, assets: Map<string, EditorAsset>): Promise<Float32Array | null> {
  let best: { clip: Clip; over: number } | null = null;
  for (const track of tl.tracks) {
    if (track.kind !== "audio" || track.muted || track.off) continue;
    for (const clip of track.clips) {
      const over = Math.min(to, clipEnd(clip)) - Math.max(from, clip.start);
      if (clip.assetId && !clip.off && over > (best?.over ?? 0)) best = { clip, over };
    }
  }
  const a = best ? assets.get(best.clip.assetId!) : null;
  if (!best || !a?.url) return null;
  const mono = await monoOf(a.id, a.url);
  if (!mono) return null;
  const n = Math.max(1, Math.ceil((to - from) / STEP));
  const out = new Float32Array(n);
  const win = Math.round((SYNC_RATE * STEP) / 1000);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const ms = from + i * STEP;
    if (ms < best.clip.start || ms >= clipEnd(best.clip)) {
      out[i] = -1;
      continue;
    }
    const at = Math.round((sourceTime(best.clip, ms) / 1000) * SYNC_RATE);
    let s = 0;
    for (let k = at; k < at + win; k++) s += Math.abs(mono[k] ?? 0);
    out[i] = s / win;
    sum += out[i];
  }
  // (where the sound clip does not reach: as loud as the rest, so it is never taken for a breath)
  const mean = sum / n;
  for (let i = 0; i < n; i++) if (out[i] < 0) out[i] = mean;
  return out;
}

export default function CameraGrid({ tl, assets, player, run, readOnly, onClose, flash }: { tl: Timeline; assets: Map<string, EditorAsset>; player: PlayerLike | null; run: (cmd: Command) => void; readOnly: boolean; onClose: () => void; flash?: (text: string, bad?: boolean) => void }) {
  // ---- «تقطيع ذكي»: a stretch cut between the chosen tracks by itself ----
  const [tab, setTab] = useState<"grid" | "smart">("grid");
  const every = useMemo(() => allCameras(tl, (id) => assets.get(id)?.kind), [tl, assets]);
  const camTracks = useMemo(() => [...new Map(every.map((c) => [c.track.id, c.track])).values()].reverse(), [every]);
  const span = useMemo(() => (every.length ? { from: Math.min(...every.map((c) => c.clip.start)), to: Math.max(...every.map((c) => clipEnd(c.clip))) } : { from: 0, to: 0 }), [every]);
  const [fromText, setFromText] = useState<string | null>(null);
  const [toText, setToText] = useState<string | null>(null);
  const [pace, setPace] = useState<Pace>("medium");
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const fromMs = fromText == null ? span.from : parseTime(fromText);
  const toMs = toText == null ? span.to : parseTime(toText);
  const chosen = camTracks.filter((t) => !skip.has(t.id));
  const smartCut = async () => {
    if (busy || readOnly) return;
    if (fromMs == null || toMs == null || toMs - fromMs < 1000) return flash?.("اكتب الوقت مثل 0:30 و 1:45 (من أصغر من إلى).", true);
    const cams = every.filter((c) => !skip.has(c.track.id) && c.clip.start < toMs && clipEnd(c.clip) > fromMs).map((c) => ({ id: c.clip.id, start: c.clip.start, end: clipEnd(c.clip) }));
    if (!cams.length) return flash?.("ما فيه كاميرا في المسارات المختارة صوّرت هذا الوقت.", true);
    setBusy(true);
    try {
      const loud = await loudness(tl, fromMs, toMs, assets).catch(() => null);
      const p = PACES[pace];
      const shots = planShots(cams, breathCuts(loud, STEP, fromMs, toMs, p.min, p.max));
      if (!shots.length) return flash?.("ما طلع ولا لقطة: الكاميرات المختارة ما تغطي هذا الوقت.", true);
      run({ type: "multicam_plan", from: fromMs, to: toMs, shots });
      flash?.(`قطّعت ${shots.length} لقطة ${loud ? "على أنفاس الصوت" : "على فواصل متساوية (ما لقيت تراك صوت أسمعه)"}. كل لقطة تقدر تبدّل كاميرتها من الشبكة.`);
      setTab("grid");
    } finally {
      setBusy(false);
    }
  };

  // the moment, in steps (the cameras there change rarely; the tiles themselves follow the player directly)
  const [at, setAt] = useState(() => player?.ms ?? 0);
  const [playing, setPlaying] = useState(false);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const cams = useMemo(() => camerasAt(tl, at, (id) => assets.get(id)?.kind), [tl, at, assets]);
  const live = liveCamera(tl, at, cams);
  const camsRef = useRef(cams);
  useEffect(() => {
    camsRef.current = cams;
  }, [cams]);

  useEffect(() => {
    if (!player) return;
    let lastStep = -1;
    let lastSeek = 0;
    const tick = (ms: number, isPlaying: boolean) => {
      const step = Math.floor(ms / 200);
      if (step !== lastStep) {
        lastStep = step;
        setAt(ms);
      }
      setPlaying(isPlaying);
      const list = camsRef.current;
      const now = performance.now();
      const rolling = isPlaying && list.length <= LIVE;
      for (const { clip } of list) {
        const v = videos.current.get(clip.id);
        if (!v || v.readyState < 1) continue;
        const want = sourceTime(clip, Math.min(Math.max(ms, clip.start), clipEnd(clip) - 1)) / 1000;
        if (rolling) {
          if (Math.abs(v.currentTime - want) > 0.35) v.currentTime = want;
          if (v.playbackRate !== clip.speed) v.playbackRate = Math.min(16, Math.max(0.0625, clip.speed || 1));
          if (v.paused) v.play().catch(() => {});
        } else {
          if (!v.paused) v.pause();
          // paused: every move of the playhead; playing with many cameras: a step every 0.7 s
          if (!v.seeking && Math.abs(v.currentTime - want) > 0.03 && (!isPlaying || now - lastSeek > 700)) v.currentTime = want;
        }
      }
      if (isPlaying && !rolling && now - lastSeek > 700) lastSeek = now;
    };
    tick(player.ms, player.playing);
    return player.subscribe(tick);
  }, [player]);

  // the tile a key has just cut to: it flashes, so the press is seen without looking for it
  const [hit, setHit] = useState<string | null>(null);
  const cut = (id: string) => {
    if (readOnly || !player) return;
    run({ type: "multicam_cut", cam: id, at: Math.round(player.ms) });
  };
  // 1–9: cut to that camera (not while typing somewhere)
  const cutRef = useRef(cut);
  useEffect(() => {
    cutRef.current = cut;
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))) return;
      if (e.key === "Escape") return onClose();
      const n = camKey(e);
      if (n == null || e.shiftKey) return;
      // a number is the grid's while it is open: it never falls through to another shortcut, camera there or not
      e.preventDefault();
      e.stopPropagation();
      const c = camsRef.current[n];
      if (!c || e.repeat) return;
      cutRef.current(c.clip.id);
      setHit(c.clip.id);
      window.setTimeout(() => setHit((h) => (h === c.clip.id ? null : h)), 260);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onClose]);

  const cols = cams.length <= 1 ? 1 : cams.length <= 4 ? 2 : cams.length <= 9 ? 3 : 4;
  return (
    <div className="jw-glass absolute bottom-2 start-2 top-14 z-30 flex w-[min(40%,520px)] flex-col gap-2 overflow-hidden rounded-2xl p-2" dir="rtl" role="region" aria-label="شبكة الكاميرات">
      <div className="flex items-center gap-2">
        <span className="flex shrink-0 gap-1 rounded-full bg-black/25 p-0.5" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "grid"} className={`rounded-full px-2.5 py-1 text-xs font-bold ${tab === "grid" ? "bg-jw-accent text-jw-on-accent" : "text-jw-muted hover:text-jw-ink"}`} onClick={() => setTab("grid")}>
            🎥 الشبكة
          </button>
          <button type="button" role="tab" aria-selected={tab === "smart"} className={`rounded-full px-2.5 py-1 text-xs font-bold ${tab === "smart" ? "bg-jw-accent text-jw-on-accent" : "text-jw-muted hover:text-jw-ink"}`} onClick={() => setTab("smart")}>
            ✨ تقطيع ذكي
          </button>
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-jw-muted">{tab === "smart" ? "يقطّع بين الكاميرات بروحه في الوقت اللي تحدده" : cams.length ? `${cams.length} كاميرا · اضغط رقمها على الكيبورد (1–9 و0 للعاشرة) وتقطع عليها، حتى والفيديو شغال` : "ما فيه كاميرات عند المؤشر"}</span>
        <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon shrink-0" onClick={onClose} aria-label="سكّر شبكة الكاميرات" title="سكّر (Esc)">
          ✕
        </button>
      </div>
      {tab === "smart" ? (
        <div className="jw-scroll min-h-0 flex-1 space-y-3 overflow-auto px-1 text-xs">
          <div className="flex flex-wrap items-end gap-2">
            {(
              [
                ["من", fromText ?? formatTime(span.from, true), setFromText],
                ["إلى", toText ?? formatTime(span.to, true), setToText],
              ] as const
            ).map(([label, value, set]) => (
              <label key={label} className="flex flex-col gap-1">
                <span className="text-jw-muted">{label}</span>
                <span className="flex items-center gap-1">
                  <input className="jw-input !h-8 w-20 text-center tabular-nums" dir="ltr" value={value} onChange={(e) => set(e.target.value)} aria-label={`${label} (وقت التايملاين)`} placeholder="0:00" />
                  <button type="button" className="jw-btn !min-h-8 !px-2 text-[11px]" onClick={() => set(formatTime(player?.ms ?? 0, true))} title="وقت المؤشر الحين">
                    المؤشر
                  </button>
                </span>
              </label>
            ))}
            <button type="button" className="jw-btn jw-btn-quiet !min-h-8 text-[11px]" onClick={() => (setFromText(null), setToText(null))}>
              كل الكاميرات
            </button>
          </div>
          <div className="space-y-1">
            <span className="text-jw-muted">طول اللقطة</span>
            <div className="flex gap-1" role="radiogroup" aria-label="طول اللقطة">
              {(Object.entries(PACES) as [Pace, (typeof PACES)[Pace]][]).map(([k, v]) => (
                <button key={k} type="button" role="radio" aria-checked={pace === k} className={`jw-btn flex-1 !min-h-8 text-[11px] ${pace === k ? "pro-on" : ""}`} onClick={() => setPace(k)}>
                  {v.ar} · {v.min / 1000}–{v.max / 1000} ث
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <span className="flex items-center justify-between text-jw-muted">
              <span>المسارات اللي يقطّع بينها ({chosen.length} من {camTracks.length})</span>
              <button type="button" className="underline" onClick={() => setSkip(chosen.length ? new Set(camTracks.map((t) => t.id)) : new Set())}>
                {chosen.length ? "شيل الكل" : "اختر الكل"}
              </button>
            </span>
            <div className="grid grid-cols-2 gap-1">
              {camTracks.map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-black/20 px-2 py-1.5">
                  <input
                    type="checkbox"
                    className="accent-[var(--jw-accent)]"
                    checked={!skip.has(t.id)}
                    onChange={(e) => {
                      const next = new Set(skip);
                      if (e.target.checked) next.delete(t.id);
                      else next.add(t.id);
                      setSkip(next);
                    }}
                  />
                  <span className="truncate">{t.name}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="button" className="jw-btn jw-btn-primary w-full" disabled={busy || readOnly || !chosen.length} onClick={() => void smartCut()}>
            {busy ? "أسمع الصوت وأقطّع…" : "✨ قطّع"}
          </button>
          <p className="leading-5 text-jw-faint">يسمع تراك الصوت ويحط القطع عند الأنفاس بين العبارات، ويدوّر الكاميرات بالدور بدون ما يكرر نفس الكاميرا مرتين ورا بعض. يشتغل على جهازك ومجاني (مو نموذج لغة). اللي قطّعته بيدك برا هذا الوقت يبقى.</p>
        </div>
      ) : cams.length === 0 ? (
        <p className="grid flex-1 place-items-center px-4 text-center text-xs leading-6 text-jw-muted">حرّك المؤشر على لحظة فيها مقاطع فيديو فوق بعض (كاميرات نفس اللحظة)، وتطلع لك هنا كلها جنب بعض.</p>
      ) : (
        <div className="jw-scroll grid min-h-0 flex-1 auto-rows-fr gap-1.5 overflow-auto" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {cams.map(({ clip, track }, i) => {
            const a = assets.get(clip.assetId!);
            const src = (a as (EditorAsset & { preview?: string | null }) | undefined)?.preview || a?.url || undefined;
            const on = clip.id === live;
            return (
              <button
                key={clip.id}
                type="button"
                disabled={readOnly}
                data-cam={clip.id}
                className={`group relative min-h-[72px] overflow-hidden rounded-xl bg-black text-start outline outline-2 transition ${hit === clip.id ? "scale-[0.97] outline-white" : on ? "outline-red-500" : "outline-transparent hover:outline-jw-accent"}`}
                onClick={() => cut(clip.id)}
                aria-pressed={on}
                aria-label={`اقطع على ${track.name}`}
                title={on ? `${track.name}: هذي المعروضة الحين` : `اقطع على ${track.name} من هنا${i < 10 ? ` (الزر ${(i + 1) % 10})` : ""}`}
              >
                {src && (
                  <video
                    ref={(el) => {
                      if (el) videos.current.set(clip.id, el);
                      else videos.current.delete(clip.id);
                    }}
                    src={src}
                    muted
                    playsInline
                    preload="auto"
                    // (a tile that has just loaded goes to the moment at once, not at the playhead's next move)
                    onLoadedMetadata={(e) => {
                      if (!player) return;
                      e.currentTarget.currentTime = sourceTime(clip, Math.min(Math.max(player.ms, clip.start), clipEnd(clip) - 1)) / 1000;
                    }}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                )}
                {clip.label && <span className="absolute inset-x-0 top-0 h-1" style={{ background: clip.label }} />}
                <span className="absolute start-1 top-1.5 flex items-center gap-1">
                  {i < 10 && <kbd className="grid h-6 min-w-6 place-items-center rounded-md bg-white px-1 text-sm font-black text-black shadow">{(i + 1) % 10}</kbd>}
                  {on && <span className={`rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white ${playing ? "animate-pulse" : ""}`}>LIVE</span>}
                </span>
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-4 text-[11px] font-semibold text-white">{track.name}{a?.name ? ` · ${a.name}` : ""}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
