"use client";

import { useEffect, useRef, useState } from "react";
import type { ThumbnailSide } from "@config/jawad/assistant";
import Dialog from "../Dialog";
import Icon from "../Icon";
import { Masker } from "../editor/segment";
import { uploadImage } from "./upload";
import type { UploadView } from "./types";

export interface ComposerPerson {
  name: string;
  url: string;
}
export interface ComposerResult {
  id: string;
  url: string;
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error("تعذّر تحميل الصورة."));
    img.src = url;
  });

/**
 * The person of a photo, cut out at the photo's own resolution (the pixels are the photo's: the face is never redrawn),
 * trimmed to where the person is. Null when nobody is found.
 */
async function cutOut(url: string): Promise<HTMLCanvasElement | null> {
  const img = await loadImage(url);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const masker = new Masker();
  await masker.load();
  if (!masker.ready) throw new Error("تعذّر تحميل أداة القص (تحتاج اتصالًا بالإنترنت أول مرة).");
  const mask = masker.maskOf("person", img, w, h);
  if (!mask) throw new Error("ما قدرت أقص الصورة.");
  // Where the person is (the mask is small: scan it)
  const mctx = mask.getContext("2d")!;
  const md = mctx.getImageData(0, 0, mask.width, mask.height).data;
  let x0 = mask.width, y0 = mask.height, x1 = -1, y1 = -1;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (md[(y * mask.width + x) * 4 + 3] > 128) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0 || (x1 - x0) * (y1 - y0) < mask.width * mask.height * 0.02) return null;
  const sx = w / mask.width;
  const sy = h / mask.height;
  const bx = Math.max(0, Math.floor(x0 * sx));
  const by = Math.max(0, Math.floor(y0 * sy));
  const bw = Math.min(w - bx, Math.ceil((x1 + 1 - x0) * sx));
  const bh = Math.min(h - by, Math.ceil((y1 + 1 - y0) * sy));
  const full = document.createElement("canvas");
  full.width = w;
  full.height = h;
  const g = full.getContext("2d")!;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "destination-in";
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(mask, 0, 0, w, h);
  const out = document.createElement("canvas");
  out.width = bw;
  out.height = bh;
  out.getContext("2d")!.drawImage(full, bx, by, bw, bh, 0, 0, bw, bh);
  return out;
}

/** A white silhouette of a cut-out (for the outline that makes a person stand out of a thumbnail). */
function silhouette(c: HTMLCanvasElement) {
  const s = document.createElement("canvas");
  s.width = c.width;
  s.height = c.height;
  const g = s.getContext("2d")!;
  g.drawImage(c, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "#fff";
  g.fillRect(0, 0, s.width, s.height);
  return s;
}

const SIDE_X: Record<ThumbnailSide, number> = { left: 0.24, right: 0.76, center: 0.5 };

/** «ركّب الشخص»: the person (cut from their own photo) on the picture the generator made. Download it or keep it as a reference. */
export default function ThumbnailComposer({
  open,
  onClose,
  persons,
  results,
  initial,
  onKeep,
}: {
  open: boolean;
  onClose: () => void;
  persons: ComposerPerson[];
  results: ComposerResult[];
  initial: { person: string; side: ThumbnailSide } | null;
  /** The finished picture, stored as a reference of the person. */
  onKeep: (view: UploadView) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // what the person chose; until they choose, the newest picture and the suggested person
  const [chosenPerson, setPerson] = useState<string | null>(null);
  const [chosenResult, setResultId] = useState<string | null>(null);
  const person = chosenPerson ?? (persons.some((p) => p.name === initial?.person) ? initial!.person : persons[0]?.name ?? "");
  const resultId = chosenResult ?? results[0]?.id ?? "";
  const [side, setSide] = useState<ThumbnailSide>(initial?.side ?? "left");
  const [cx, setCx] = useState(SIDE_X[initial?.side ?? "left"]);
  const [size, setSize] = useState(0.92);
  const [lift, setLift] = useState(0);
  const [flip, setFlip] = useState(false);
  const [outline, setOutline] = useState(true);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const assets = useRef<{ cut: HTMLCanvasElement | null; bg: HTMLImageElement | null; edge: HTMLCanvasElement | null }>({ cut: null, bg: null, edge: null });
  const [version, setVersion] = useState(0);
  const drag = useRef<{ x: number; y: number; cx: number; lift: number } | null>(null);

  const personUrl = persons.find((p) => p.name === person)?.url;
  const resultUrl = results.find((r) => r.id === resultId)?.url;

  // The cut-out and the background load when either picture changes
  useEffect(() => {
    if (!open || !personUrl || !resultUrl) return;
    let live = true;
    queueMicrotask(() => live && setState("loading"));
    Promise.all([cutOut(personUrl), loadImage(resultUrl)])
      .then(([cut, bg]) => {
        if (!live) return;
        if (!cut) {
          setError("ما لقيت شخصًا واضحًا في الصورة؛ جرّب صورة أوضح للوجه والجسم.");
          return setState("error");
        }
        assets.current = { cut, bg, edge: silhouette(cut) };
        setError("");
        setState("ready");
        setVersion((v) => v + 1);
      })
      .catch((e: Error) => {
        if (!live) return;
        setError(e.message);
        setState("error");
      });
    return () => {
      live = false;
    };
  }, [open, personUrl, resultUrl]);

  // Draw (at the picture's own size; the screen just shows it smaller)
  useEffect(() => {
    const c = canvas.current;
    const { cut, bg, edge } = assets.current;
    if (!c || !cut || !bg || !edge) return;
    c.width = bg.naturalWidth;
    c.height = bg.naturalHeight;
    const g = c.getContext("2d")!;
    g.drawImage(bg, 0, 0);
    const ph = c.height * size;
    const pw = (cut.width / cut.height) * ph;
    const x = c.width * cx - pw / 2;
    const y = c.height - ph - c.height * lift;
    g.save();
    if (flip) {
      g.translate(c.width * cx * 2, 0);
      g.scale(-1, 1);
    }
    if (outline) {
      const r = Math.max(4, c.height * 0.008);
      for (let a = 0; a < 24; a++) g.drawImage(edge, x + Math.cos((a / 24) * Math.PI * 2) * r, y + Math.sin((a / 24) * Math.PI * 2) * r, pw, ph);
      g.shadowColor = "rgba(0,0,0,.45)";
      g.shadowBlur = c.height * 0.03;
    }
    g.drawImage(cut, x, y, pw, ph);
    g.restore();
  }, [version, cx, size, lift, flip, outline]);

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx, lift };
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    const c = canvas.current;
    if (!d || !c) return;
    const r = c.getBoundingClientRect();
    setCx(Math.min(1, Math.max(0, d.cx + (e.clientX - d.x) / r.width)));
    setLift(Math.min(0.5, Math.max(-0.3, d.lift - (e.clientY - d.y) / r.height)));
  }

  async function blob(): Promise<Blob> {
    const c = canvas.current!;
    return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("تعذّر حفظ الصورة."))), "image/png"));
  }
  async function download() {
    try {
      const url = URL.createObjectURL(await blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "thumbnail.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function keep() {
    setSaving(true);
    setError("");
    try {
      const file = new File([await blob()], "thumbnail.png", { type: "image/png" });
      onKeep(await uploadImage(file));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="ركّب الشخص على الصورة" wide>
      <div className="space-y-3 p-4">
        {!results.length || !persons.length ? (
          <p className="text-sm text-jw-muted">
            {!persons.length ? "أضف صورتك كمرجع أولًا (أو أرفقها لجواد)." : "ولّد الصورة أولًا، وبعدها ركّب الشخص عليها."}
          </p>
        ) : (
          <>
            <p className="text-xs text-jw-muted">أقص الشخص من صورتك الأصلية وأحطه على الصورة الجديدة، فوجهك يبقى كما هو بدون ما يتغيّر. اسحب الشخص بالماوس أو الإصبع لتحريكه.</p>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                الشخص
                <select className="jw-select" value={person} onChange={(e) => setPerson(e.target.value)}>
                  {persons.map((p) => <option key={p.name} value={p.name}>@{p.name}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2">
                الصورة المولّدة
                <select className="jw-select" value={resultId} onChange={(e) => setResultId(e.target.value)}>
                  {results.map((r, i) => <option key={r.id} value={r.id}>{i === 0 ? "الأحدث" : `قبل ${i}`}</option>)}
                </select>
              </label>
              <div className="jw-seg" role="radiogroup" aria-label="جهة الشخص">
                {(["left", "center", "right"] as const).map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={side === s} onClick={() => { setSide(s); setCx(SIDE_X[s]); setLift(0); }}>
                    {s === "left" ? "يسار" : s === "right" ? "يمين" : "وسط"}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-jw-line bg-jw-bg-2">
              <canvas ref={canvas} className="block h-auto max-h-[60dvh] w-full touch-none object-contain" style={{ cursor: "grab" }} onPointerDown={down} onPointerMove={move} onPointerUp={() => (drag.current = null)} aria-label="معاينة الصورة المركّبة" />
              {state === "loading" && <span className="absolute inset-0 grid place-items-center bg-black/40 text-sm"><span className="flex items-center gap-2"><span className="jw-spinner" aria-hidden /> أقص الشخص…</span></span>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                الحجم
                <input type="range" min={0.5} max={1.2} step={0.01} value={size} onChange={(e) => setSize(Number(e.target.value))} className="mt-1 w-full accent-[var(--jw-accent)]" dir="ltr" />
              </label>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={outline} onChange={(e) => setOutline(e.target.checked)} /> حدّ أبيض</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} /> اقلب</label>
              </div>
            </div>
            {error && <p className="text-xs text-jw-danger" role="alert">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="jw-btn" onClick={download} disabled={state !== "ready"}><Icon name="download" size={16} /> نزّل</button>
              <button type="button" className="jw-btn jw-btn-primary" onClick={keep} disabled={state !== "ready" || saving}>
                {saving ? <span className="jw-spinner" /> : <Icon name="plus" size={16} />} أضفه كمرجع
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
