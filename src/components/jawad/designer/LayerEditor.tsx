/* eslint-disable @next/next/no-img-element */
"use client";

// «محرر الطبقات» — the design as the person edits it: the artwork at the back, every word a real text layer in one of
// the site's Arabic fonts (drag it, change the font, size, colour, outline, shadow, glow, pill, width, rotation),
// a cut-out as a movable picture layer, and the final PNG drawn by the browser at the design's own pixel size (the
// same drawing as the preview: the preview is the design at full size, scaled to fit). Fonts are loaded from the
// site's own files, so what is seen is what is saved.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LAYER_EFFECTS, LAYER_ROLES } from "@config/designer";
import { layerId, type ImageLayer, type Layer, type TextLayer } from "@/lib/designer/layers";

export interface FontDef { id: string; family: string; label: string; role: string; files: { url: string; weight: string }[] }
export interface DesignView {
  id: string;
  aspect: string;
  width: number;
  height: number;
  artwork: string | null;
  artworkUrl?: string | null;
  layers: (Layer & { url?: string | null })[];
  state: "drawing" | "ready" | "failed";
  error?: string;
  detail?: string;
  flag?: string;
  final?: string;
  finalUrl?: string | null;
}

const ROLE_AR: Record<string, string> = { title: "عنوان", subtitle: "عنوان فرعي", body: "نص", names: "أسماء", date: "تاريخ", place: "مكان", badge: "شارة", caption: "سطر صغير" };
const loaded = new Set<string>();

/** Loads a font's files into the page once (the preview and the canvas both use the family name). */
export async function loadFont(f: FontDef) {
  if (loaded.has(f.id) || typeof document === "undefined") return;
  loaded.add(f.id);
  await Promise.all(
    f.files.map(async (file) => {
      try {
        const face = new FontFace(f.family, `url(${file.url})`, { weight: file.weight });
        await face.load();
        document.fonts.add(face);
      } catch { /* the browser falls back to a system font */ }
    }),
  );
}

/** The text of a layer wrapped into lines that fit its box (the same for the preview and the canvas). */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(""); continue; }
    let line = "";
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

const px = (l: TextLayer, H: number) => Math.max(4, (l.size / 100) * H);

/** Draws one text layer on a canvas at the design's full size. */
function drawText(ctx: CanvasRenderingContext2D, l: TextLayer, W: number, H: number, family: string) {
  const size = px(l, H);
  ctx.save();
  ctx.translate((l.x / 100) * W, (l.y / 100) * H);
  ctx.rotate((l.rotate * Math.PI) / 180);
  ctx.globalAlpha = l.opacity;
  ctx.font = `${l.weight} ${size}px "${family}", sans-serif`;
  ctx.direction = "rtl";
  ctx.textBaseline = "middle";
  ctx.textAlign = l.align;
  try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(l.spacing / 100) * size}px`; } catch { /* older browsers */ }
  const boxW = (l.w / 100) * W;
  const lines = wrapLines(ctx, l.text, boxW);
  const lh = size * l.lineHeight;
  const total = lh * lines.length;
  const x0 = l.align === "center" ? 0 : l.align === "right" ? boxW / 2 : -boxW / 2;
  if (l.effect === "pill") {
    const pad = size * 0.35;
    const widest = Math.max(...lines.map((s) => ctx.measureText(s).width));
    const bw = Math.min(boxW, widest) + pad * 2;
    const bx = l.align === "center" ? -bw / 2 : l.align === "right" ? boxW / 2 - bw + pad : -boxW / 2 - pad;
    ctx.fillStyle = l.effectColor;
    const r = size * 0.3;
    const by = -total / 2 - pad * 0.4;
    const bh = total + pad * 0.8;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, r);
    ctx.fill();
  }
  lines.forEach((s, i) => {
    const y = -total / 2 + lh * i + lh / 2;
    if (l.effect === "shadow") { ctx.shadowColor = l.effectColor; ctx.shadowBlur = size * 0.25; ctx.shadowOffsetX = size * 0.05; ctx.shadowOffsetY = size * 0.08; }
    if (l.effect === "glow") { ctx.shadowColor = l.effectColor; ctx.shadowBlur = size * 0.6; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
    if (l.effect === "outline") {
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.lineWidth = Math.max(1, size * 0.12);
      ctx.strokeStyle = l.effectColor;
      ctx.strokeText(s, x0, y);
    }
    ctx.fillStyle = l.color;
    ctx.fillText(s, x0, y);
    if (l.effect === "glow") { ctx.fillText(s, x0, y); }
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  });
  ctx.restore();
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("image"));
    im.src = url;
  });

/** The whole design as a PNG blob at its own pixel size. */
export async function renderDesign(d: DesignView, fonts: FontDef[]): Promise<Blob> {
  await Promise.all(fonts.filter((f) => d.layers.some((l) => l.kind === "text" && l.font === f.id)).map(loadFont));
  await document.fonts.ready;
  const c = document.createElement("canvas");
  c.width = d.width;
  c.height = d.height;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, d.width, d.height);
  if (d.artworkUrl) {
    const im = await loadImage(d.artworkUrl);
    ctx.drawImage(im, 0, 0, d.width, d.height);
  }
  for (const l of d.layers) {
    if (l.kind === "image") {
      if (!l.url) continue;
      const im = await loadImage(l.url);
      const w = (l.w / 100) * d.width;
      const h = w * (im.naturalHeight / im.naturalWidth);
      ctx.save();
      ctx.translate((l.x / 100) * d.width, (l.y / 100) * d.height);
      ctx.rotate((l.rotate * Math.PI) / 180);
      if (l.flip) ctx.scale(-1, 1);
      ctx.globalAlpha = l.opacity;
      ctx.drawImage(im, -w / 2, -h / 2, w, h);
      ctx.restore();
    } else drawText(ctx, l, d.width, d.height, fonts.find((f) => f.id === l.font)?.family ?? "sans-serif");
  }
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/png"));
}

/** A text layer as the preview draws it (CSS mirrors the canvas: the same font size, box, effects). */
function TextPreview({ l, H, family, selected, onDown }: { l: TextLayer; H: number; family: string; selected: boolean; onDown: (e: React.PointerEvent) => void }) {
  const size = px(l, H);
  const effect: React.CSSProperties =
    l.effect === "outline" ? { WebkitTextStroke: `${Math.max(1, size * 0.12) / 2}px ${l.effectColor}`, paintOrder: "stroke fill" }
    : l.effect === "shadow" ? { textShadow: `${size * 0.05}px ${size * 0.08}px ${size * 0.25}px ${l.effectColor}` }
    : l.effect === "glow" ? { textShadow: `0 0 ${size * 0.3}px ${l.effectColor}, 0 0 ${size * 0.6}px ${l.effectColor}` }
    : {};
  return (
    <div
      className={`dz-layer ${selected ? "sel" : ""}`}
      onPointerDown={onDown}
      style={{
        left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`,
        transform: `translate(-50%, -50%) rotate(${l.rotate}deg)`,
        textAlign: l.align, opacity: l.opacity,
        fontFamily: `"${family}", sans-serif`, fontSize: size, fontWeight: l.weight, lineHeight: l.lineHeight, letterSpacing: `${(l.spacing / 100) * size}px`,
        color: l.color, direction: "rtl", whiteSpace: "pre-wrap", wordBreak: "break-word", ...effect,
      }}
    >
      {l.effect === "pill" ? (
        <span style={{ display: "inline-block", background: l.effectColor, padding: `${size * 0.14}px ${size * 0.35}px`, borderRadius: size * 0.3 }}>{l.text}</span>
      ) : l.text}
    </div>
  );
}

export default function LayerEditor({ design, fonts, onChange, onSave, saving, onRedraw, busy }: { design: DesignView; fonts: FontDef[]; onChange: (layers: Layer[]) => void; onSave: (blob: Blob) => Promise<void>; saving: boolean; onRedraw?: () => void; busy: boolean }) {
  const [sel, setSel] = useState<string | null>(design.layers.find((l) => l.kind === "text")?.id ?? null);
  const [scale, setScale] = useState(0.3);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; sx: number; sy: number; x: number; y: number } | null>(null);
  const layers = design.layers;
  const cur = layers.find((l) => l.id === sel) ?? null;
  const family = useCallback((id: string) => fonts.find((f) => f.id === id)?.family ?? "sans-serif", [fonts]);

  // the fonts in use are loaded as the design shows
  useEffect(() => {
    const ids = new Set(layers.filter((l): l is TextLayer => l.kind === "text").map((l) => l.font));
    fonts.filter((f) => ids.has(f.id)).forEach((f) => void loadFont(f));
  }, [layers, fonts]);

  // the preview is the design at full size, scaled to the box
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / design.width));
    ro.observe(el);
    setScale(el.clientWidth / design.width);
    return () => ro.disconnect();
  }, [design.width]);

  const set = (id: string, patch: Partial<TextLayer> | Partial<ImageLayer>) => onChange(layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)));
  const down = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    setSel(id);
    const l = layers.find((x) => x.id === id)!;
    drag.current = { id, sx: e.clientX, sy: e.clientY, x: l.x, y: l.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const nx = Math.max(0, Math.min(100, d.x + ((e.clientX - d.sx) / scale / design.width) * 100));
    const ny = Math.max(0, Math.min(100, d.y + ((e.clientY - d.sy) / scale / design.height) * 100));
    set(d.id, { x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 });
  };
  const up = () => { drag.current = null; };

  const addText = () => {
    const l: TextLayer = { id: layerId(), kind: "text", role: "body", text: "نص جديد", font: fonts[0]?.id ?? "readex", size: 4, color: "#FFFFFF", weight: 700, x: 50, y: 50, w: 70, align: "center", effect: "shadow", effectColor: "#000000", lineHeight: 1.25, spacing: 0, rotate: 0, opacity: 1 };
    onChange([...layers, l]);
    setSel(l.id);
  };
  const remove = (id: string) => { onChange(layers.filter((l) => l.id !== id)); if (sel === id) setSel(null); };
  const duplicate = (id: string) => {
    const l = layers.find((x) => x.id === id);
    if (!l) return;
    const copy = { ...l, id: layerId(), y: Math.min(100, l.y + 6) } as Layer;
    onChange([...layers, copy]);
    setSel(copy.id);
  };
  const order = (id: string, dir: -1 | 1) => {
    const i = layers.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= layers.length) return;
    const copy = [...layers];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };

  const save = async () => {
    const blob = await renderDesign(design, fonts);
    await onSave(blob);
  };
  const download = async () => {
    const blob = await renderDesign(design, fonts);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `design-${design.id}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const texts = useMemo(() => layers.filter((l): l is TextLayer => l.kind === "text"), [layers]);

  return (
    <div className="dz-editor">
      <div className="dz-stage-wrap" ref={wrap}>
        <div className="dz-stage" style={{ width: design.width, height: design.height, transform: `scale(${scale})` }} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={(e) => e.target === e.currentTarget && setSel(null)}>
          {design.artworkUrl ? <img src={design.artworkUrl} alt="" draggable={false} /> : <div className="dz-stage-empty" />}
          {layers.map((l) =>
            l.kind === "image" ? (
              <div key={l.id} className={`dz-layer dz-img ${sel === l.id ? "sel" : ""}`} onPointerDown={down(l.id)} style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`, transform: `translate(-50%, -50%) rotate(${l.rotate}deg)${l.flip ? " scaleX(-1)" : ""}`, opacity: l.opacity }}>
                {l.url && <img src={l.url} alt="" draggable={false} />}
              </div>
            ) : (
              <TextPreview key={l.id} l={l} H={design.height} family={family(l.font)} selected={sel === l.id} onDown={down(l.id)} />
            ),
          )}
        </div>
        <div style={{ height: design.height * scale }} />
      </div>

      <div className="dz-panel">
        <div className="dz-panel-head">
          <b>🧩 الطبقات</b>
          <div className="dz-row">
            <button type="button" className="dz-mini" onClick={addText}>＋ نص</button>
            {onRedraw && <button type="button" className="dz-mini" disabled={busy} onClick={onRedraw}>🔁 أعد رسم الصورة</button>}
          </div>
        </div>
        <ul className="dz-layers">
          {[...layers].reverse().map((l) => (
            <li key={l.id} className={sel === l.id ? "sel" : ""} onClick={() => setSel(l.id)}>
              <span className="k">{l.kind === "image" ? "🖼️" : "🅰️"}</span>
              <span className="t">{l.kind === "image" ? "عنصر مقصوص" : `${ROLE_AR[l.role] ?? l.role}: ${l.text.split("\n")[0]}`}</span>
              <span className="tools">
                <button type="button" aria-label="فوق" onClick={(e) => { e.stopPropagation(); order(l.id, 1); }}>↑</button>
                <button type="button" aria-label="تحت" onClick={(e) => { e.stopPropagation(); order(l.id, -1); }}>↓</button>
                <button type="button" aria-label="انسخ" onClick={(e) => { e.stopPropagation(); duplicate(l.id); }}>⧉</button>
                <button type="button" aria-label="احذف" onClick={(e) => { e.stopPropagation(); remove(l.id); }}>✕</button>
              </span>
            </li>
          ))}
        </ul>

        {cur && cur.kind === "text" && (
          <div className="dz-props">
            <label>النص<textarea dir="auto" rows={2} value={cur.text} onChange={(e) => set(cur.id, { text: e.target.value.slice(0, 600) })} /></label>
            <label>الخط
              <select value={cur.font} onChange={(e) => set(cur.id, { font: e.target.value })}>
                {fonts.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
            <div className="dz-fontrow">
              {fonts.map((f) => (
                <button key={f.id} type="button" className={`dz-fontchip ${cur.font === f.id ? "on" : ""}`} style={{ fontFamily: `"${f.family}", sans-serif` }} onMouseEnter={() => void loadFont(f)} onClick={() => { void loadFont(f); set(cur.id, { font: f.id }); }}>{f.label.split(" (")[0]}</button>
              ))}
            </div>
            <div className="dz-grid2">
              <label>الدور<select value={cur.role} onChange={(e) => set(cur.id, { role: e.target.value as TextLayer["role"] })}>{LAYER_ROLES.map((r) => <option key={r} value={r}>{ROLE_AR[r]}</option>)}</select></label>
              <label>الوزن<select value={cur.weight} onChange={(e) => set(cur.id, { weight: Number(e.target.value) === 400 ? 400 : 700 })}><option value={700}>عريض</option><option value={400}>عادي</option></select></label>
              <label>الحجم {cur.size}%<input type="range" min={1} max={25} step={0.25} value={cur.size} onChange={(e) => set(cur.id, { size: Number(e.target.value) })} /></label>
              <label>العرض {cur.w}%<input type="range" min={10} max={100} step={1} value={cur.w} onChange={(e) => set(cur.id, { w: Number(e.target.value) })} /></label>
              <label>اللون<span className="dz-color"><input type="color" value={cur.color} onChange={(e) => set(cur.id, { color: e.target.value.toUpperCase() })} /><input dir="ltr" value={cur.color} onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && set(cur.id, { color: e.target.value.toUpperCase() })} /></span></label>
              <label>المحاذاة<select value={cur.align} onChange={(e) => set(cur.id, { align: e.target.value as TextLayer["align"] })}><option value="center">وسط</option><option value="right">يمين</option><option value="left">يسار</option></select></label>
              <label>التأثير<select value={cur.effect} onChange={(e) => set(cur.id, { effect: e.target.value as TextLayer["effect"] })}>{LAYER_EFFECTS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label>لون التأثير<span className="dz-color"><input type="color" value={cur.effectColor} onChange={(e) => set(cur.id, { effectColor: e.target.value.toUpperCase() })} /><input dir="ltr" value={cur.effectColor} onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && set(cur.id, { effectColor: e.target.value.toUpperCase() })} /></span></label>
              <label>ارتفاع السطر {cur.lineHeight}<input type="range" min={0.8} max={2.2} step={0.05} value={cur.lineHeight} onChange={(e) => set(cur.id, { lineHeight: Number(e.target.value) })} /></label>
              <label>تباعد الحروف {cur.spacing}<input type="range" min={-10} max={40} step={1} value={cur.spacing} onChange={(e) => set(cur.id, { spacing: Number(e.target.value) })} /></label>
              <label>الدوران {cur.rotate}°<input type="range" min={-45} max={45} step={1} value={cur.rotate} onChange={(e) => set(cur.id, { rotate: Number(e.target.value) })} /></label>
              <label>الشفافية {Math.round(cur.opacity * 100)}%<input type="range" min={0.1} max={1} step={0.05} value={cur.opacity} onChange={(e) => set(cur.id, { opacity: Number(e.target.value) })} /></label>
              <label>أفقي {cur.x}%<input type="range" min={0} max={100} step={0.5} value={cur.x} onChange={(e) => set(cur.id, { x: Number(e.target.value) })} /></label>
              <label>عمودي {cur.y}%<input type="range" min={0} max={100} step={0.5} value={cur.y} onChange={(e) => set(cur.id, { y: Number(e.target.value) })} /></label>
            </div>
          </div>
        )}
        {cur && cur.kind === "image" && (
          <div className="dz-props">
            <div className="dz-grid2">
              <label>الحجم {cur.w}%<input type="range" min={5} max={150} step={1} value={cur.w} onChange={(e) => set(cur.id, { w: Number(e.target.value) })} /></label>
              <label>الدوران {cur.rotate}°<input type="range" min={-45} max={45} step={1} value={cur.rotate} onChange={(e) => set(cur.id, { rotate: Number(e.target.value) })} /></label>
              <label>الشفافية {Math.round(cur.opacity * 100)}%<input type="range" min={0.1} max={1} step={0.05} value={cur.opacity} onChange={(e) => set(cur.id, { opacity: Number(e.target.value) })} /></label>
              <label>اقلب<select value={cur.flip ? "1" : "0"} onChange={(e) => set(cur.id, { flip: e.target.value === "1" })}><option value="0">لا</option><option value="1">نعم</option></select></label>
              <label>أفقي {cur.x}%<input type="range" min={0} max={100} step={0.5} value={cur.x} onChange={(e) => set(cur.id, { x: Number(e.target.value) })} /></label>
              <label>عمودي {cur.y}%<input type="range" min={0} max={100} step={0.5} value={cur.y} onChange={(e) => set(cur.id, { y: Number(e.target.value) })} /></label>
            </div>
          </div>
        )}
        {!cur && <p className="dz-muted">اضغط على أي نص في التصميم أو في القائمة لتعديله، واسحبه ليتحرك. {texts.length === 0 ? "أضف نصًا بزر «＋ نص»." : ""}</p>}

        <div className="dz-row dz-save">
          <button type="button" className="dz-send" disabled={saving || busy} onClick={() => void save()}>{saving ? "…" : "💾 احفظ PNG النهائي"}</button>
          <button type="button" className="dz-mini" disabled={saving} onClick={() => void download()}>⬇️ حمّل الآن</button>
          {design.finalUrl && <a className="dz-mini" href={design.finalUrl} download>⬇️ آخر نسخة محفوظة</a>}
        </div>
        <p className="dz-muted" style={{ fontSize: 11 }}>{design.width}×{design.height} بكسل · كل كلمة طبقة حقيقية بخط عربي أصلي؛ الصورة مرسومة بلا كتابة.</p>
      </div>
    </div>
  );
}
