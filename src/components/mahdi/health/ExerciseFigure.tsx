"use client";

// «الصحة العلوية»: an exercise's technique drawing, moving slowly between its key positions (a coach's tempo), with the
// last position as a faint ghost and an arrow along the movement. Tap to pause. Still (first position + ghost + arrow)
// for those who prefer less motion, and while it is off screen.
import { useEffect, useRef, useState } from "react";
import { FIGURES } from "@config/mahdi/exercise-figures";
import { figureShapes, VIEW, type Shape, type Tone } from "@/lib/mahdi/health/figure";

const COLORS: Record<Tone, string> = {
  body: "#f3f4f1",
  far: "#7d8794",
  gear: "#9aa3ad",
  gearSoft: "#3a424b",
  accent: "#c6ff1a",
  ghost: "#f3f4f1",
  floor: "#2a3038",
};
const HOLD = 650;
const MOVE = 1150;

/** Where the loop is at a time: forward through the key positions, a pause, and back. */
function phase(ms: number, steps: number): number {
  const leg = HOLD + steps * MOVE;
  const t = ms % (leg * 2);
  const one = (x: number) => (x < HOLD ? 0 : Math.min(steps, (x - HOLD) / MOVE));
  return t < leg ? one(t) : steps - one(t - leg);
}

function draw(s: Shape, i: number) {
  const o = s.o;
  switch (s.k) {
    case "line":
      return <line key={i} x1={s.a[0]} y1={s.a[1]} x2={s.b[0]} y2={s.b[1]} stroke={COLORS[s.c]} strokeWidth={s.w} strokeLinecap="round" opacity={o} />;
    case "circle":
      return s.fill ? (
        <circle key={i} cx={s.at[0]} cy={s.at[1]} r={s.r} fill={COLORS[s.c]} opacity={o} />
      ) : (
        <circle key={i} cx={s.at[0]} cy={s.at[1]} r={s.r} fill="none" stroke={COLORS[s.c]} strokeWidth={s.w ?? 2} opacity={o} />
      );
    case "rect":
      return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx ?? 0} fill={COLORS[s.c]} opacity={o} />;
    case "path":
      return (
        <path
          key={i}
          d={s.d}
          fill={s.fill ? COLORS[s.c] : "none"}
          stroke={COLORS[s.c]}
          strokeWidth={s.w}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={s.dash}
          opacity={o}
        />
      );
  }
}

export default function ExerciseFigure({ id, name, compact = false }: { id: string; name: string; compact?: boolean }) {
  const def = FIGURES[id];
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const [paused, setPaused] = useState(false);
  const steps = def ? def.frames.length - 1 : 0;

  useEffect(() => {
    if (!def || paused) return;
    const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const pulsing = Boolean(def.pulse);
    if (still || (steps === 0 && !pulsing)) return;
    let raf = 0;
    let visible = true;
    const start = performance.now();
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(tick);
    });
    if (ref.current) io.observe(ref.current);
    function tick(now: number) {
      raf = 0;
      if (!visible) return;
      // a held squeeze breathes in and out; a movement runs through its positions
      setP(steps === 0 ? (Math.sin((now - start) / 450) + 1) / 2 : phase(now - start, steps));
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [def, steps, paused]);

  if (!def) return null;
  const shapes = figureShapes(def, steps === 0 ? 0 : p);
  // the pulse of a held squeeze grows and shrinks
  const pulse = def.pulse && steps === 0 ? 0.75 + p * 0.5 : 1;

  return (
    <div ref={ref} className="gym-figure">
      <button
        type="button"
        className="block w-full"
        onClick={() => setPaused((v) => !v)}
        aria-label={paused ? `شغّل حركة ${name}` : `أوقف حركة ${name}`}
      >
        <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="img" aria-label={`رسم يوضح طريقة ${name}`} className={compact ? "max-h-40" : "max-h-72"}>
          {shapes.map((s, i) =>
            s.k === "circle" && !s.fill && s.c === "accent" && pulse !== 1 ? draw({ ...s, r: s.r * pulse }, i) : draw(s, i),
          )}
        </svg>
      </button>
      <p className="gym-small text-center">
        {def.pulse && steps === 0 ? "الدائرة: المكان اللي تشدّه وتثبّت." : "الظل الفاتح: آخر الحركة · السهم: اتجاهها"}
        {paused && " · موقوف (اضغط للتشغيل)"}
      </p>
    </div>
  );
}

/** A small still drawing (first position, ghost and arrow) for lists. */
export function ExerciseThumb({ id }: { id: string }) {
  const def = FIGURES[id];
  if (!def) return null;
  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden="true" className="gym-thumb">
      {figureShapes(def, 0).map(draw)}
    </svg>
  );
}
