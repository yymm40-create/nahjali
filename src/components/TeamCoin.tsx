"use client";

import { useId } from "react";

/**
 * «نقود الفريق الذكي»: an epic coin with a fired-up, challenging face — a crimson-to-royal-purple face in a molten-gold
 * rim with a three-point crown (the team), sharp brows pulled down in the middle, narrowed eyes locked forward with a
 * glint, a wide confident grin, and flames licking around it. Never blue, so it is never mistaken for «النقود الذكية».
 * `alive` animates it (the flames flicker, the eyes glint and squint, sparks fly); small sizes stay still.
 */
export default function TeamCoin({ size = 20, alive, className = "" }: { size?: number; alive?: boolean; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const moving = alive ?? size >= 40;
  const flicker = (values: string, dur: string) => (moving ? <animate attributeName="d" values={values} dur={dur} repeatCount="indefinite" /> : null);
  // the narrowed eye: a quick fierce squint now and then
  const squint = moving ? <animateTransform attributeName="transform" type="scale" values="1 1;1 1;1 0.55;1 1;1 1" keyTimes="0;0.86;0.9;0.95;1" dur="3.4s" repeatCount="indefinite" additive="sum" /> : null;
  const flameA = "M4.2 21.3 Q2.4 21.1 -0.3 19.8 Q2.9 15.5 3.6 14.5 Q0.6 13.0 -1.2 10.2 Q4.4 7.9 6.8 8.4 Q5.8 6.5 5.7 3.4 Q11.3 4.3 12.6 4.9 Q12.3 0.6 14.1 -2.4 Q19.0 1.7 19.4 4.9 Q20.7 3.2 23.4 1.7 Q25.2 7.0 25.2 8.4 Q28.4 6.7 31.8 6.8 Q30.4 12.8 28.4 14.5 Q30.0 15.0 32.4 16.6 Q28.7 20.5 27.8 21.3 Q25.0 31.2 16.0 30.2 Q7.0 31.2 4.2 21.3Z";
  const flameB = "M4.2 21.3 Q1.7 21.3 -1.1 20.0 Q2.2 15.4 3.6 14.5 Q1.7 13.3 -0.0 10.7 Q5.2 8.5 6.8 8.4 Q4.9 5.5 4.8 2.2 Q10.8 3.1 12.6 4.9 Q12.6 1.9 14.2 -0.9 Q18.7 2.9 19.4 4.9 Q21.1 2.0 24.0 0.4 Q25.9 6.1 25.2 8.4 Q27.4 7.5 30.5 7.7 Q29.2 13.2 28.4 14.5 Q30.6 14.9 33.2 16.6 Q29.3 20.6 27.8 21.3 Q25.0 31.2 16.0 30.2 Q7.0 31.2 4.2 21.3Z";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
      style={moving ? { filter: "drop-shadow(0 0 7px rgba(251, 146, 60, 0.6)) drop-shadow(0 5px 12px rgba(124, 29, 111, 0.5))", overflow: "visible" } : { overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.35" stopColor="#f6c445" />
          <stop offset="0.7" stopColor="#d4890f" />
          <stop offset="1" stopColor="#8a4b06" />
        </linearGradient>
        <radialGradient id={`${id}-face`} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#ff6a3d" />
          <stop offset="0.45" stopColor="#d61f5a" />
          <stop offset="1" stopColor="#5b1a9e" />
        </radialGradient>
        <linearGradient id={`${id}-fire`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff3d00" />
          <stop offset="0.55" stopColor="#ff9f1c" />
          <stop offset="1" stopColor="#ffe066" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* the flames around it: it's fired up (left out on small icons, where they'd only blur it) */}
      {size >= 30 && (
      <path d={flameA} fill={`url(#${id}-fire)`} opacity="0.95">
        {flicker(`${flameA};${flameB};${flameA}`, "0.9s")}
      </path>
      )}

      {/* the coin: gold rim, notched edge, crimson-purple face */}
      <circle cx="16" cy="17" r="13.4" fill={`url(#${id}-rim)`} />
      <circle cx="16" cy="17" r="12.6" fill="none" stroke="#7a3f05" strokeWidth="0.6" strokeDasharray="1.2 1.4" opacity="0.55" />
      <circle cx="16" cy="17" r="10.8" fill={`url(#${id}-face)`} stroke="#fde68a" strokeWidth="0.7" />
      <ellipse cx="12.5" cy="11.2" rx="6" ry="2.6" fill={`url(#${id}-shine)`} />

      {/* the crown: three points, the team */}
      <path d="M10 7.2 L11.9 3.6 L13.8 6.1 L16 2.4 L18.2 6.1 L20.1 3.6 L22 7.2 Z" fill={`url(#${id}-rim)`} stroke="#8a4b06" strokeWidth="0.5" strokeLinejoin="round" />
      <circle cx="16" cy="2.9" r="0.85" fill="#ff4d6d" />
      <circle cx="11.9" cy="4" r="0.6" fill="#c084fc" />
      <circle cx="20.1" cy="4" r="0.6" fill="#c084fc" />

      {/* narrowed eyes, locked forward: the upper lid cuts straight across, slanting down to the middle */}
      <g>
        <g transform="translate(12.2 16.6)">
          <g>
            {squint}
            <path d="M-2.9 -0.2 L2.6 1.1 Q2.4 2.9 0 3 Q-2.7 2.9 -2.9 -0.2Z" fill="#fff" />
            <circle cx="0.6" cy="1.55" r="1.25" fill="#1e1035" />
            <circle cx="1" cy="1.15" r="0.42" fill="#fff" />
          </g>
        </g>
        <g transform="translate(19.8 16.6)">
          <g>
            {squint}
            <path d="M2.9 -0.2 L-2.6 1.1 Q-2.4 2.9 0 3 Q2.7 2.9 2.9 -0.2Z" fill="#fff" />
            <circle cx="-0.6" cy="1.55" r="1.25" fill="#1e1035" />
            <circle cx="-0.2" cy="1.15" r="0.42" fill="#fff" />
          </g>
        </g>
        {/* sharp brows pulled down hard in the middle */}
        <path d="M8.6 13.1 L14.9 15.6 L14.6 16.5 L8.4 14.4 Z" fill="#2a0620" />
        <path d="M23.4 13.1 L17.1 15.6 L17.4 16.5 L23.6 14.4 Z" fill="#2a0620" />
      </g>

      {/* a wide, confident grin: teeth showing, one corner higher */}
      <path d="M11.6 21.2 Q16 25.6 20.8 20.4 Q16.4 22.4 11.6 21.2Z" fill="#2a0620" />
      <path d="M12.6 21.6 Q16.2 22.7 19.9 20.9 L19.6 21.7 Q16.2 23.3 12.9 22.3Z" fill="#fff" />

      {/* the glint in its eye, and sparks */}
      <g fill="#fffbe0">
        <path d="M21.3 14.6 l0.35 0.85 0.85 0.35 -0.85 0.35 -0.35 0.85 -0.35 -0.85 -0.85 -0.35 0.85 -0.35z">
          {moving && <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;0.6;0.7;0.8;1" dur="2.6s" repeatCount="indefinite" />}
        </path>
        <path d="M28.4 8.6 l0.5 1.3 1.3 0.5 -1.3 0.5 -0.5 1.3 -0.5 -1.3 -1.3 -0.5 1.3 -0.5z">
          {moving && <animate attributeName="opacity" values="0;1;0" dur="1.7s" repeatCount="indefinite" />}
        </path>
        <path d="M3.4 9.4 l0.4 1 1 0.4 -1 0.4 -0.4 1 -0.4 -1 -1 -0.4 1 -0.4z">
          {moving && <animate attributeName="opacity" values="1;0;1" dur="2.2s" repeatCount="indefinite" />}
        </path>
      </g>
    </svg>
  );
}
