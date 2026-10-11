"use client";

// «السكوبات» of the colour room: the program's picture measured the way a colourist reads it — the RGB parade (or the
// waveform, or the histogram) above, the vectorscope with its colour boxes and skin line below. The preview canvas is
// copied small a few times a second (and after every change) and counted in scope-draw.ts.

import { useEffect, useRef, useState } from "react";
import { glow, LEVELS, scopeData, skinLine, vectorTargets, type ScopeData } from "@/lib/editor/scope-draw";
import Icon from "../Icon";
import type { Player } from "./player";

type Top = "parade" | "wave" | "hist";
const W = 256;

export default function ScopesPanel({ canvas, player, tick }: { canvas: HTMLCanvasElement | null; player: Player | null; /** changes whenever the timeline does */ tick: unknown }) {
  const [top, setTop] = useState<Top>("parade");
  const [data, setData] = useState<ScopeData | null>(null);
  const small = useRef<HTMLCanvasElement | null>(null);
  const topCv = useRef<HTMLCanvasElement>(null);
  const vecCv = useRef<HTMLCanvasElement>(null);

  // measure the picture: now, after a change, and while it plays (about 8 times a second)
  useEffect(() => {
    if (!canvas) return;
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () => {
      try {
        const h = Math.max(2, Math.round((W * canvas.height) / Math.max(1, canvas.width)));
        const c = (small.current ??= document.createElement("canvas"));
        if (c.width !== W || c.height !== h) {
          c.width = W;
          c.height = h;
        }
        const g = c.getContext("2d", { willReadFrequently: true })!;
        g.drawImage(canvas, 0, 0, W, h);
        setData(scopeData(g.getImageData(0, 0, W, h).data, W, h));
      } catch {
        /* a frame that can't be read */
      }
    };
    timer = setTimeout(read, 90);
    const off = player?.subscribe(() => {
      const now = performance.now();
      if (now - last < 120) return;
      last = now;
      clearTimeout(timer);
      timer = setTimeout(read, 30);
    });
    return () => {
      clearTimeout(timer);
      off?.();
    };
  }, [canvas, player, tick]);

  // the top scope
  useEffect(() => {
    const cv = topCv.current;
    if (!cv || !data) return;
    const w = (cv.width = 640),
      h = (cv.height = 300);
    const g = cv.getContext("2d")!;
    g.fillStyle = "#050505";
    g.fillRect(0, 0, w, h);
    // graticule: 0, 25, 50, 75, 100 %
    g.strokeStyle = "rgba(255,255,255,.09)";
    g.lineWidth = 1;
    g.fillStyle = "rgba(255,255,255,.3)";
    g.font = "10px sans-serif";
    for (let k = 0; k <= 4; k++) {
      const y = 8 + ((h - 16) * k) / 4;
      g.beginPath();
      g.moveTo(26, y);
      g.lineTo(w, y);
      g.stroke();
      g.fillText(String(1023 - Math.round((1023 * k) / 4)), 2, y + 3);
    }
    const img = g.getImageData(0, 0, w, h);
    const px = img.data;
    const plot = (counts: Float32Array, cols: number, x0: number, x1: number, rgb: [number, number, number], max: number) => {
      for (let c = 0; c < cols; c++) {
        const x = Math.floor(x0 + ((x1 - x0) * c) / cols);
        const x2 = Math.max(x + 1, Math.floor(x0 + ((x1 - x0) * (c + 1)) / cols));
        for (let l = 0; l < LEVELS; l++) {
          const v = glow(counts[c * LEVELS + l], max);
          if (v < 0.02) continue;
          const y = Math.round(8 + (h - 16) * (1 - l / 255));
          for (let xx = x; xx < x2; xx++)
            for (let dy = 0; dy < 2; dy++) {
              const i = ((y + dy) * w + xx) * 4;
              px[i] = Math.min(255, px[i] + rgb[0] * v);
              px[i + 1] = Math.min(255, px[i + 1] + rgb[1] * v);
              px[i + 2] = Math.min(255, px[i + 2] + rgb[2] * v);
            }
        }
      }
    };
    if (top === "parade") {
      const third = (w - 30) / 3;
      (
        [
          [255, 90, 82],
          [82, 230, 122],
          [90, 140, 255],
        ] as [number, number, number][]
      ).forEach((rgb, k) => plot(data.parade[k], data.cols, 30 + third * k + 2, 30 + third * (k + 1) - 2, rgb, data.max.parade));
    } else if (top === "wave") plot(data.wave, data.cols, 30, w, [110, 235, 130], data.max.wave);
    else {
      // histogram: four filled curves
      const rows = [
        ["rgba(255,90,82,.55)", 0],
        ["rgba(82,230,122,.55)", 1],
        ["rgba(90,140,255,.55)", 2],
        ["rgba(255,255,255,.35)", 3],
      ] as const;
      img.data.set(px);
      g.putImageData(img, 0, 0);
      for (const [col, k] of rows) {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(30, h - 8);
        for (let l = 0; l < LEVELS; l++) g.lineTo(30 + ((w - 30) * l) / 255, h - 8 - Math.pow(data.hist[k][l] / Math.max(1, data.max.hist), 0.5) * (h - 20));
        g.lineTo(w, h - 8);
        g.closePath();
        g.fill();
      }
      return;
    }
    g.putImageData(img, 0, 0);
  }, [data, top]);

  // the vectorscope
  useEffect(() => {
    const cv = vecCv.current;
    if (!cv || !data) return;
    const S = (cv.width = cv.height = 320);
    const g = cv.getContext("2d")!;
    g.fillStyle = "#050505";
    g.fillRect(0, 0, S, S);
    g.strokeStyle = "rgba(255,255,255,.1)";
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.44, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.22, 0, Math.PI * 2);
    g.stroke();
    const n = data.vecSize;
    const img = g.getImageData(0, 0, S, S);
    const cell = S / n;
    for (let vy = 0; vy < n; vy++)
      for (let vx = 0; vx < n; vx++) {
        const v = glow(data.vec[vy * n + vx], data.max.vec);
        if (v < 0.02) continue;
        const x0 = Math.floor(vx * cell),
          y0 = Math.floor(vy * cell);
        for (let dy = 0; dy < Math.ceil(cell); dy++)
          for (let dx = 0; dx < Math.ceil(cell); dx++) {
            const i = ((y0 + dy) * S + x0 + dx) * 4;
            img.data[i] = Math.min(255, img.data[i] + 240 * v);
            img.data[i + 1] = Math.min(255, img.data[i + 1] + 190 * v);
            img.data[i + 2] = Math.min(255, img.data[i + 2] + 90 * v);
          }
      }
    g.putImageData(img, 0, 0);
    // the colour boxes, and the skin line
    g.font = "10px sans-serif";
    g.textAlign = "center";
    for (const [name, x, y] of vectorTargets()) {
      const X = x * S,
        Y = y * S;
      g.strokeStyle = "rgba(255,255,255,.28)";
      g.strokeRect(X - 7, Y - 7, 14, 14);
      g.fillStyle = "rgba(255,255,255,.45)";
      g.fillText(name, X, Y + 21);
    }
    const sk = skinLine();
    g.strokeStyle = "rgba(232,163,61,.85)";
    g.setLineDash([4, 4]);
    g.beginPath();
    g.moveTo(S / 2, S / 2);
    g.lineTo(S / 2 + sk.x * S * 0.46, S / 2 + sk.y * S * 0.46);
    g.stroke();
    g.setLineDash([]);
  }, [data]);

  return (
    <aside className="room-scopes" aria-label="السكوبات">
      <div className="room-ph">
        <Icon name="waveform" size={14} />
        <b>السكوبات</b>
        <span className="jw-seg" role="radiogroup" aria-label="نوع السكوب">
          {(
            [
              ["parade", "Parade"],
              ["wave", "Waveform"],
              ["hist", "Hist"],
            ] as [Top, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={top === k} onClick={() => setTop(k)}>
              {l}
            </button>
          ))}
        </span>
      </div>
      <div className="room-scope-top">
        <canvas ref={topCv} />
      </div>
      <div className="room-ph">
        <Icon name="node" size={14} />
        <b>Vectorscope</b>
        <span className="skin">— خط البشرة</span>
      </div>
      <div className="room-scope-vec">
        <canvas ref={vecCv} />
      </div>
    </aside>
  );
}
