"use client";

// «الكي» in action, over the preview: the three helpers the key's panel calls (window event "jw:key").
// · «🎯 اختر من الشاشة»: the clip shows its NATURAL colours (the key off) while the person points; a loupe shows the
//   colour under the pointer and a click takes the average of a small square of the picture as it goes into the key
//   (not the screen's pixels after scaling, grading view or keying) — then the key comes back on.
// · «🪄 كشف تلقائي»: the screen's colour and the tolerance it needs, found in the frame (key-math.ts).
// · «🤖 حيدرة يضبط»: Claude sees the frame as filmed, the matte and the result, and corrects the settings, round by
//   round (key-check.ts) — the pictures made here with the same maths the GPU draws.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Command } from "@/lib/editor/commands";
import { detectKey, keyPixels, keyParams, rgbToHex, sampleAt, screenness } from "@/lib/editor/key-math";
import { clipEnd, clipLength, findClip, type Keyer, type Timeline } from "@/lib/editor/model";
import { postJson } from "@/lib/fetch";
import { keyTap } from "./render";
import type { Player } from "./player";

export const KEY_EVENT = "jw:key";
export type KeyOp = "pick" | "auto" | "ai";
export const keyAsk = (clipId: string, op: KeyOp) => window.dispatchEvent(new CustomEvent(KEY_EVENT, { detail: { clipId, op } }));

const MAX_ROUNDS = 3;

export default function KeyStudio({ player, canvas, tl, projectId, run, flash }: { player: Player | null; canvas: HTMLCanvasElement | null; tl: Timeline; projectId: string; run: (c: Command | Command[], o?: { label?: string }) => unknown; flash: (m: string, bad?: boolean) => void }) {
  const tlRef = useRef(tl);
  useEffect(() => {
    tlRef.current = tl;
  }, [tl]);
  const [picking, setPicking] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loupe, setLoupe] = useState<{ x: number; y: number; c: string } | null>(null);
  const [box, setBox] = useState<DOMRect | null>(null);

  /** The clip's picture as it goes into its key (the playhead moved onto the clip first when it isn't there). */
  const capture = useCallback(
    async (clipId: string, bypass: boolean) => {
      const f = findClip(tlRef.current, clipId);
      if (!f || !player) return null;
      const ms = player.ms;
      if (ms < f.clip.start || ms >= clipEnd(f.clip)) {
        player.seek(f.clip.start + clipLength(f.clip) / 2);
        await new Promise((r) => setTimeout(r, 450));
      }
      keyTap.id = clipId;
      keyTap.bypass = bypass;
      keyTap.m = null;
      player.draw();
      // a video's frame may arrive a moment later
      for (let i = 0; i < 6 && !keyTap.m; i++) {
        await new Promise((r) => setTimeout(r, 120));
        player.draw();
      }
      const img = keyTap.img;
      if (!keyTap.m || !img) return null;
      const g = img.getContext("2d", { willReadFrequently: true })!;
      return { data: g.getImageData(0, 0, img.width, img.height), w: img.width, h: img.height };
    },
    [player],
  );
  const release = useCallback(() => {
    keyTap.id = null;
    keyTap.bypass = false;
    keyTap.m = null;
    player?.draw();
  }, [player]);

  const setKey = useCallback((clipId: string, key: Partial<Keyer>, label: string) => run([{ type: "update_clip", clipId, patch: { key } }], { label }), [run]);

  const auto = useCallback(
    async (clipId: string, quiet = false) => {
      const shot = await capture(clipId, true);
      release();
      if (!shot) return flash("شغّل المقطع لين يبان في المعاينة، وبعدين جرّب.", true);
      const d = detectKey(shot.data.data, shot.w, shot.h);
      if (!d) return flash("ما لقيت شاشة بلون واحد واضح في هالفريم. اختر اللون بنفسك من «🎯 اختر من الشاشة».", true);
      setKey(clipId, { kind: "chroma", color: d.color, tolerance: d.tolerance }, "كشف تلقائي للكي");
      if (!quiet) flash(`🪄 لقيت الشاشة (${Math.round(d.cover * 100)}٪ من الصورة) وضبطت اللون والسماحية.`);
    },
    [capture, release, flash, setKey],
  );

  const ai = useCallback(
    async (clipId: string) => {
      try {
        for (let round = 1; round <= MAX_ROUNDS; round++) {
          setBusy(round === 1 ? "حيدرة يشوف الكي…" : `حيدرة يعيد يشيك (جولة ${round})…`);
          const f = findClip(tlRef.current, clipId);
          const key = f?.clip.key;
          if (!key || key.kind !== "chroma") return flash("شغّل الكروما أول.", true);
          const shot = await capture(clipId, true);
          release();
          if (!shot) return flash("شغّل المقطع لين يبان في المعاينة، وبعدين جرّب.", true);
          const { shots, stats } = pictures(shot.data, key);
          const r = await postJson<{ ok: boolean; verdict: string; key: Partial<Keyer> }>(`/api/jawad/editor/projects/${projectId}`, { action: "key_check", clipId, round, key, shots, stats });
          if (r.ok || !Object.keys(r.key).length) return flash(`🤖 ${r.verdict || "الكي تمام."}`);
          setKey(clipId, r.key, `حيدرة يضبط الكي (${round})`);
          if (round === MAX_ROUNDS) flash(`🤖 ${r.verdict}`);
        }
      } catch (e) {
        flash(e instanceof Error ? e.message : "ما قدر حيدرة يشيك الحين.", true);
      } finally {
        setBusy(null);
      }
    },
    [capture, release, flash, projectId, setKey],
  );

  // the panel's buttons
  useEffect(() => {
    const on = (e: Event) => {
      const { clipId, op } = (e as CustomEvent<{ clipId: string; op: KeyOp }>).detail;
      if (op === "auto") void auto(clipId);
      else if (op === "ai") void ai(clipId);
      else
        void capture(clipId, true).then((s) => {
          if (!s) {
            release();
            return flash("شغّل المقطع لين يبان في المعاينة، وبعدين اختر اللون.", true);
          }
          setPicking(clipId);
          setBox(canvas?.getBoundingClientRect() ?? null);
        });
    };
    window.addEventListener(KEY_EVENT, on);
    return () => window.removeEventListener(KEY_EVENT, on);
  }, [auto, ai, capture, release, flash, canvas]);

  // where a point on the screen is in the clip's picture (or null outside it)
  const sourceAt = (clientX: number, clientY: number) => {
    const img = keyTap.img;
    if (!canvas || !keyTap.m || !img) return null;
    const r = canvas.getBoundingClientRect();
    const cx = ((clientX - r.left) / r.width) * canvas.width;
    const cy = ((clientY - r.top) / r.height) * canvas.height;
    const p = keyTap.m.inverse().transformPoint(new DOMPoint(cx, cy));
    const u = (p.x + keyTap.w / 2) / keyTap.w;
    const v = (p.y + keyTap.h / 2) / keyTap.h;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    return { x: Math.min(img.width - 1, Math.floor(u * img.width)), y: Math.min(img.height - 1, Math.floor(v * img.height)), img };
  };
  const colourAt = (clientX: number, clientY: number, r: number) => {
    const s = sourceAt(clientX, clientY);
    if (!s) return null;
    const g = s.img.getContext("2d", { willReadFrequently: true })!;
    const x0 = Math.max(0, s.x - r),
      y0 = Math.max(0, s.y - r);
    const w = Math.min(s.img.width - x0, r * 2 + 1),
      h = Math.min(s.img.height - y0, r * 2 + 1);
    return sampleAt(g.getImageData(x0, y0, w, h).data, w, h, s.x - x0, s.y - y0, r);
  };
  const stopPicking = () => {
    setPicking(null);
    setLoupe(null);
    release();
  };
  useEffect(() => {
    if (!picking) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && stopPicking();
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  });

  return (
    <>
      {picking && box && (
        <div
          className="fixed z-[80] cursor-crosshair"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          onPointerMove={(e) => {
            const c = colourAt(e.clientX, e.clientY, 1);
            setLoupe(c ? { x: e.clientX, y: e.clientY, c } : null);
          }}
          onPointerLeave={() => setLoupe(null)}
          onClick={(e) => {
            const c = colourAt(e.clientX, e.clientY, 3);
            if (!c) return flash("اضغط على الشاشة الملونة داخل المقطع.", true);
            const id = picking;
            stopPicking();
            setKey(id, { kind: "chroma", color: c }, "لون الكي من الشاشة");
            flash(`🎯 أخذت اللون ${c} — والكي رجع يشتغل.`);
          }}
          role="application"
          aria-label="اضغط على لون الشاشة"
        >
          <div className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit max-w-[95%] rounded-full bg-black/75 px-3 py-1.5 text-center text-xs text-white" dir="rtl">
            🎯 هذي ألوان الفيديو الأصلية — اضغط على الشاشة الخضراء (أو اللون اللي تبي تشيله) · Esc للإلغاء
          </div>
        </div>
      )}
      {picking && loupe && (
        <div className="pointer-events-none fixed z-[81] flex items-center gap-1.5 rounded-full border border-white/40 bg-black/80 py-1 pe-2.5 ps-1 text-[11px] text-white" style={{ left: loupe.x + 16, top: loupe.y + 16 }} dir="ltr">
          <span className="h-6 w-6 rounded-full border border-white/60" style={{ background: loupe.c }} />
          {loupe.c}
        </div>
      )}
      {busy && (
        <div className="fixed bottom-24 start-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/80 px-3 py-1.5 text-xs text-white" aria-live="polite" dir="rtl">
          <span className="jw-spinner !h-3 !w-3" /> {busy}
        </div>
      )}
    </>
  );
}

/** The three pictures for حيدرة (≤ 512 px JPEG, base64) and a few measures of the key on this frame. */
function pictures(src: ImageData, key: Keyer) {
  const s = Math.min(1, 512 / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * s)),
    h = Math.max(1, Math.round(src.height * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  const full = document.createElement("canvas");
  full.width = src.width;
  full.height = src.height;
  full.getContext("2d")!.putImageData(src, 0, 0);
  g.drawImage(full, 0, 0, w, h);
  const orig = g.getImageData(0, 0, w, h);
  const jpg = () => c.toDataURL("image/jpeg", 0.8).split(",")[1];
  const origJpg = jpg();
  const k = { ...key, show: false };
  const matte = keyPixels(new Uint8ClampedArray(orig.data), w, h, k, true);
  g.putImageData(new ImageData(new Uint8ClampedArray(matte), w, h), 0, 0);
  const matteJpg = jpg();
  const keyed = keyPixels(new Uint8ClampedArray(orig.data), w, h, k);
  // over a checkerboard
  const res = new Uint8ClampedArray(keyed.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const bg = ((x >> 4) + (y >> 4)) % 2 ? 200 : 120;
      const a = keyed[i + 3] / 255;
      res[i] = keyed[i] * a + bg * (1 - a);
      res[i + 1] = keyed[i + 1] * a + bg * (1 - a);
      res[i + 2] = keyed[i + 2] * a + bg * (1 - a);
      res[i + 3] = 255;
    }
  g.putImageData(new ImageData(res, w, h), 0, 0);
  const resultJpg = jpg();
  // the measures
  const P = keyParams(k);
  let kept = 0,
    left = 0,
    partial = 0,
    some = 0;
  const bgR: number[] = [],
    bgG: number[] = [],
    bgB: number[] = [];
  for (let i = 0; i < w * h; i++) {
    const a = keyed[i * 4 + 3] / 255;
    const o = i * 4;
    kept += a;
    const sc = screenness(orig.data[o] / 255, orig.data[o + 1] / 255, orig.data[o + 2] / 255, { ...P, hTol: P.hTol + 0.03, sLo: P.sLo - 0.15, cLo: P.cLo - 0.15 });
    if (a > 0.5 && sc > 0.5) left++;
    if (a > 0.05) {
      some++;
      if (a < 0.85) partial++;
    }
    if (a < 0.1 && i % 3 === 0) {
      bgR.push(orig.data[o]);
      bgG.push(orig.data[o + 1]);
      bgB.push(orig.data[o + 2]);
    }
  }
  const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] / 255 : 0);
  const n = w * h;
  return {
    shots: { orig: origJpg, matte: matteJpg, result: resultJpg },
    stats: { kept: kept / n, left: left / n, holes: some ? partial / some : 0, screen: bgR.length ? rgbToHex([med(bgR), med(bgG), med(bgB)]) : null },
  };
}
