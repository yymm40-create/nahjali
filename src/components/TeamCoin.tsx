"use client";

import { useId } from "react";

/**
 * «نقود الفريق الذكي»: an epic coin with a face — molten-gold rim, a crimson-to-royal-purple face, two big eyes that
 * blink and look around, a small smile, a gold crown with three points (the team), and sparkles. Never blue, so it is
 * never mistaken for «النقود الذكية». `alive` animates it (blinking, glancing, twinkling); small sizes stay still.
 */
export default function TeamCoin({ size = 20, alive, className = "" }: { size?: number; alive?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const moving = alive ?? size >= 40;
  const blink = moving ? (
    <animate attributeName="ry" values="2.3;2.3;0.25;2.3;2.3" keyTimes="0;0.9;0.94;0.98;1" dur="4.2s" repeatCount="indefinite" />
  ) : null;
  const look = moving ? <animateTransform attributeName="transform" type="translate" values="0 0;0 0;0.9 0.2;0.9 0.2;-0.9 0.2;-0.9 0.2;0 0" keyTimes="0;0.3;0.38;0.55;0.62;0.82;1" dur="6s" repeatCount="indefinite" /> : null;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden style={moving ? { filter: "drop-shadow(0 0 6px rgba(236, 72, 153, 0.55)) drop-shadow(0 4px 10px rgba(124, 58, 237, 0.45))" } : undefined}>
      <defs>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.35" stopColor="#f6c445" />
          <stop offset="0.7" stopColor="#d4890f" />
          <stop offset="1" stopColor="#8a4b06" />
        </linearGradient>
        <radialGradient id={`${id}-face`} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#ff7a59" />
          <stop offset="0.45" stopColor="#e0245e" />
          <stop offset="1" stopColor="#6d28d9" />
        </radialGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* the coin: gold rim, notched edge, crimson-purple face */}
      <circle cx="16" cy="17" r="14" fill={`url(#${id}-rim)`} />
      <circle cx="16" cy="17" r="13.2" fill="none" stroke="#7a3f05" strokeWidth="0.6" strokeDasharray="1.2 1.4" opacity="0.55" />
      <circle cx="16" cy="17" r="11.2" fill={`url(#${id}-face)`} stroke="#fde68a" strokeWidth="0.7" />
      <ellipse cx="13" cy="11.5" rx="7" ry="3.2" fill={`url(#${id}-shine)`} />

      {/* the crown: three points, the team */}
      <path d="M9.5 6.2 L11.6 2.6 L13.6 5.2 L16 1.4 L18.4 5.2 L20.4 2.6 L22.5 6.2 Z" fill={`url(#${id}-rim)`} stroke="#8a4b06" strokeWidth="0.5" strokeLinejoin="round" />
      <circle cx="16" cy="1.9" r="0.9" fill="#ff4d8d" />
      <circle cx="11.6" cy="3" r="0.7" fill="#a78bfa" />
      <circle cx="20.4" cy="3" r="0.7" fill="#a78bfa" />

      {/* the eyes: they blink, and glance from side to side */}
      <g>
        <ellipse cx="12.4" cy="16" rx="2.6" ry="2.3" fill="#fff">{blink}</ellipse>
        <ellipse cx="19.6" cy="16" rx="2.6" ry="2.3" fill="#fff">{blink}</ellipse>
        <g>
          {look}
          <circle cx="12.8" cy="16.3" r="1.25" fill="#1e1035" />
          <circle cx="20" cy="16.3" r="1.25" fill="#1e1035" />
          <circle cx="13.3" cy="15.7" r="0.42" fill="#fff" />
          <circle cx="20.5" cy="15.7" r="0.42" fill="#fff" />
        </g>
        {/* determined brows */}
        <path d="M10 13.3 Q12.4 12.2 14.6 13.1" stroke="#3b0a2a" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        <path d="M17.4 13.1 Q19.6 12.2 22 13.3" stroke="#3b0a2a" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      </g>
      {/* a confident smile */}
      <path d="M12.8 21 Q16 23.6 19.2 21" stroke="#fde68a" strokeWidth="1.1" fill="none" strokeLinecap="round" />

      {/* sparkles */}
      <g fill="#fff7c2">
        <path d="M27.5 8.5 l0.6 1.5 1.5 0.6 -1.5 0.6 -0.6 1.5 -0.6 -1.5 -1.5 -0.6 1.5 -0.6z">
          {moving && <animate attributeName="opacity" values="0;1;0" dur="2.4s" repeatCount="indefinite" />}
        </path>
        <path d="M4 24 l0.45 1.1 1.1 0.45 -1.1 0.45 -0.45 1.1 -0.45 -1.1 -1.1 -0.45 1.1 -0.45z">
          {moving && <animate attributeName="opacity" values="1;0;1" dur="3.1s" repeatCount="indefinite" />}
        </path>
      </g>
    </svg>
  );
}
