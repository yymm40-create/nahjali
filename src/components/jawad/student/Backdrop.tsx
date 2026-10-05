"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#a855f7", "#ec4899", "#f97316", "#0ea5e9", "#22c55e", "#facc15"];

/**
 * «الطالب الذكي»'s living background: soft coloured particles drifting and twinkling, and 3D study objects (a pencil,
 * books, a cube, an orb, a star) floating slowly. Decorative only; calm when the reader prefers reduced motion.
 */
export default function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    type P = { x: number; y: number; r: number; vx: number; vy: number; c: string; t: number; s: number; shape: number };
    let ps: P[] = [];
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(70, (w * h) / 22000));
      ps = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1.5 + Math.random() * 3.5,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.15 - Math.random() * 0.35,
        c: COLORS[Math.floor(Math.random() * COLORS.length)],
        t: Math.random() * Math.PI * 2,
        s: 0.01 + Math.random() * 0.03,
        shape: Math.random() < 0.25 ? 1 : 0,
      }));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        if (!still) {
          p.x += p.vx;
          p.y += p.vy;
          p.t += p.s;
          if (p.y < -10) {
            p.y = h + 10;
            p.x = Math.random() * w;
          }
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
        }
        const a = 0.35 + 0.35 * Math.sin(p.t);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.c;
        if (p.shape) {
          // a little sparkle (four points)
          const r = p.r * 1.8;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - r);
          ctx.quadraticCurveTo(p.x, p.y, p.x + r, p.y);
          ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + r);
          ctx.quadraticCurveTo(p.x, p.y, p.x - r, p.y);
          ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - r);
          ctx.fill();
        } else {
          ctx.shadowColor = p.c;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      ctx.globalAlpha = 1;
      if (!still) raf = requestAnimationFrame(draw);
    };
    draw();
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !still) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div className="st-scene" aria-hidden>
      <canvas ref={ref} className="absolute inset-0 size-full" />
      <div className="st-float" style={{ top: "9%", insetInlineEnd: "6%", animationDelay: "-2s" }}>
        <div className="st-pencil">
          <span className="face" />
          <span className="face b" />
          <span className="face c" />
          <span className="tip" />
          <span className="eraser" />
        </div>
      </div>
      <div className="st-float hide-sm" style={{ top: "46%", insetInlineStart: "3%", animationDelay: "-5s", animationDuration: "11s" }}>
        <div className="st-book">
          <span className="back" />
          <span className="pages" />
          <span className="cover" />
        </div>
      </div>
      <div className="st-float hide-sm" style={{ top: "70%", insetInlineEnd: "8%", animationDelay: "-1s", animationDuration: "10s" }}>
        <div className="st-cube">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="st-float" style={{ top: "26%", insetInlineStart: "12%", animationDelay: "-7s", animationDuration: "13s" }}>
        <div className="st-orb" />
      </div>
      <div className="st-float hide-sm" style={{ top: "84%", insetInlineStart: "38%", animationDelay: "-3s", animationDuration: "12s" }}>
        <div className="st-star" />
      </div>
    </div>
  );
}
