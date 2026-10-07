"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const KEY = "site-sounds";

/**
 * The site's sounds, made in the browser (no files) and quiet: a soft tap when something is pressed and a light
 * swoosh when the page changes — in «الفيلم السينمائي» a projector's click and a reel's whirr instead. One small button
 * turns them off (remembered on this device). Nothing plays while typing, nor on the first arrival.
 */
export default function UiSounds() {
  const [on, setOn] = useState(true);
  const onRef = useRef(true);
  const ctx = useRef<AudioContext | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        // the film maker's own switch (before the sounds covered the whole site) still counts
        const v = (localStorage.getItem(KEY) ?? localStorage.getItem("film-sounds")) !== "off";
        onRef.current = v;
        setOn(v);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const audio = () => {
      if (!onRef.current) return null;
      try {
        ctx.current ??= new AudioContext();
        if (ctx.current.state === "suspended") void ctx.current.resume();
        return ctx.current;
      } catch {
        return null;
      }
    };
    const down = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("button, a, [role=button], [role=radio], [role=tab], [role=menuitem], [role=switch], summary, label, select");
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true" || el.closest("[data-no-sound]")) return;
      const a = audio();
      if (!a) return;
      if (el.closest("[data-jw-section=film]")) projectorClick(a);
      else tap(a);
    };
    window.addEventListener("pointerdown", down, true);
    return () => window.removeEventListener("pointerdown", down, true);
  }, []);

  // a page change (not the first arrival)
  const path = usePathname();
  const first = useRef(path);
  useEffect(() => {
    if (first.current === path) return;
    first.current = path;
    if (!onRef.current) return;
    try {
      ctx.current ??= new AudioContext();
      const a = ctx.current;
      if (/^\/(jawad-ai\/)?film(\/|$)/.test(path)) reelWhirr(a);
      else swoosh(a);
    } catch {}
  }, [path]);

  const toggle = () => {
    const v = !on;
    setOn(v);
    onRef.current = v;
    try {
      localStorage.setItem(KEY, v ? "on" : "off");
    } catch {}
  };
  // the editor's screen is full of its own controls: no floating button there (its sounds follow this setting)
  if (/^\/(jawad-ai\/)?editor\/./.test(path)) return null;
  return (
    <button
      type="button"
      data-no-sound
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "اكتم أصوات الموقع" : "شغّل أصوات الموقع"}
      title={on ? "اكتم أصوات الموقع" : "شغّل أصوات الموقع"}
      className="fixed bottom-4 left-4 z-40 grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white/90 text-base shadow-lg backdrop-blur transition-transform hover:scale-105 active:scale-95"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      {on ? "🔊" : "🔇"}
    </button>
  );
}

/** a soft, rounded tap: a short sine blip falling in pitch */
function tap(a: AudioContext) {
  const t = a.currentTime;
  const o = a.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(880, t);
  o.frequency.exponentialRampToValueAtTime(520, t + 0.07);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + 0.11);
}

/** a light swoosh: filtered noise sweeping up */
function swoosh(a: AudioContext) {
  const t = a.currentTime;
  const len = Math.round(a.sampleRate * 0.28);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len);
  const n = a.createBufferSource();
  n.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(600, t);
  bp.frequency.exponentialRampToValueAtTime(3200, t + 0.26);
  const g = a.createGain();
  g.gain.value = 0.05;
  n.connect(bp).connect(g).connect(a.destination);
  n.start(t);
}

/** a projector's click: a tiny burst of noise through a band filter, and a soft high blip */
function projectorClick(a: AudioContext) {
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
}

/** a reel's whirr: ticks speeding up then slowing, under a soft rising tone */
function reelWhirr(a: AudioContext) {
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
}
