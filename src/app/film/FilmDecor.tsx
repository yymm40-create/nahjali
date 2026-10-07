"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * «الفيلم السينمائي»'s stage: two film reels turning slowly, a strip of film running across, a clapperboard and a
 * spotlight — in the logo's navy, blue and gold, faint behind the work (never in the way: no pointer, no motion when
 * the device asks for less). And its sounds: a projector's click when something is pressed, a reel's whirr when
 * the page changes — made here in the browser (no files), quiet, and off with one tap (remembered on this device).
 */
export default function FilmDecor() {
  const [on, setOn] = useState(true);
  const ctx = useRef<AudioContext | null>(null);
  const onRef = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = localStorage.getItem("film-sounds") !== "off";
        onRef.current = v;
        setOn(v);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const audio = () => {
    if (!onRef.current || typeof window === "undefined") return null;
    try {
      ctx.current ??= new AudioContext();
      if (ctx.current.state === "suspended") void ctx.current.resume();
      return ctx.current;
    } catch {
      return null;
    }
  };
  /** a projector's click: a tiny burst of noise through a band filter, and a soft high blip */
  const click = () => {
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    const buf = a.createBuffer(1, Math.round(a.sampleRate * 0.03), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    const n = a.createBufferSource();
    n.buffer = buf;
    const bp = a.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    bp.Q.value = 1.2;
    const g = a.createGain();
    g.gain.value = 0.22;
    n.connect(bp).connect(g).connect(a.destination);
    n.start(t);
    const o = a.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(1320, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.06);
    const og = a.createGain();
    og.gain.setValueAtTime(0.05, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(og).connect(a.destination);
    o.start(t);
    o.stop(t + 0.09);
  };
  /** a reel's whirr: ticks speeding up then slowing, under a soft rising tone */
  const whirr = () => {
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    for (let i = 0; i < 9; i++) {
      const at = t + 0.025 * i + 0.003 * i * i;
      const o = a.createOscillator();
      o.type = "square";
      o.frequency.value = 180 + i * 12;
      const g = a.createGain();
      g.gain.setValueAtTime(0.025, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.02);
      o.connect(g).connect(a.destination);
      o.start(at);
      o.stop(at + 0.025);
    }
    const s = a.createOscillator();
    s.type = "sine";
    s.frequency.setValueAtTime(420, t);
    s.frequency.exponentialRampToValueAtTime(760, t + 0.32);
    const sg = a.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(0.035, t + 0.08);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    s.connect(sg).connect(a.destination);
    s.start(t);
    s.stop(t + 0.4);
  };

  // a click on anything pressable inside the film section
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("button, a, [role=button], [role=radio], [role=tab], summary, label");
      if (el && !(el as HTMLButtonElement).disabled && el.closest("[data-jw-section=film]")) click();
    };
    window.addEventListener("pointerdown", down, true);
    return () => window.removeEventListener("pointerdown", down, true);
  });
  // a whirr when the page changes (not on the first arrival)
  const path = usePathname();
  const first = useRef(path);
  useEffect(() => {
    if (first.current === path) return;
    first.current = path;
    whirr();
  });

  const toggle = () => {
    const v = !on;
    setOn(v);
    onRef.current = v;
    try {
      localStorage.setItem("film-sounds", v ? "on" : "off");
    } catch {}
  };

  return (
    <>
      <div className="film-decor" aria-hidden>
        <div className="spot" />
        <Reel className="reel a" />
        <Reel className="reel b" />
        <svg className="strip" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <rect width="1200" height="120" fill="#0b1d47" />
          <g className="strip-holes" fill="#ffffff">
            {Array.from({ length: 70 }, (_, i) => (
              <g key={i}>
                <rect x={i * 20 + 4} y="8" width="10" height="12" rx="2" />
                <rect x={i * 20 + 4} y="100" width="10" height="12" rx="2" />
              </g>
            ))}
          </g>
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} x={i * 150 + 12} y="30" width="126" height="60" rx="4" fill={i % 2 ? "#1f63f0" : "#e2a72c"} opacity="0.55" />
          ))}
        </svg>
        <svg className="clap" viewBox="0 0 100 90">
          <g transform="rotate(-12 10 30)">
            <rect x="6" y="20" width="88" height="16" rx="3" fill="#0b1d47" />
            {[0, 1, 2, 3].map((i) => <polygon key={i} points={`${14 + i * 21},20 ${26 + i * 21},20 ${18 + i * 21},36 ${6 + i * 21},36`} fill="#ffffff" />)}
          </g>
          <rect x="6" y="38" width="88" height="48" rx="4" fill="#0b1d47" />
          <rect x="14" y="48" width="72" height="4" rx="2" fill="#e2a72c" />
          <rect x="14" y="60" width="50" height="4" rx="2" fill="#3b8cff" />
          <rect x="14" y="72" width="60" height="4" rx="2" fill="#ffffff" opacity="0.7" />
        </svg>
      </div>
      <button type="button" className="film-sound" onClick={toggle} aria-pressed={on} aria-label={on ? "اكتم أصوات الواجهة" : "شغّل أصوات الواجهة"} title={on ? "اكتم أصوات الواجهة" : "شغّل أصوات الواجهة"}>
        {on ? "🔊" : "🔇"}
      </button>
    </>
  );
}

/** A film reel: a navy disc with five windows around a dark hub, a gold rim. */
function Reel({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="96" fill="#0b1d47" stroke="#e2a72c" strokeWidth="5" />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i * 72 * Math.PI) / 180;
        return <circle key={i} cx={100 + Math.cos(a) * 52} cy={100 + Math.sin(a) * 52} r="25" fill="#f4f7ff" />;
      })}
      <circle cx="100" cy="100" r="16" fill="#1f63f0" />
      <circle cx="100" cy="100" r="6" fill="#050b1c" />
    </svg>
  );
}
