"use client";

// «لأجل المهدي» — a holy shrine drawn in code (lib/mahdi/shrine-art.ts), in the drawing style of the design: gold and
// real colours, flat, flat with black outlines and a hard shadow, a silhouette, thin lines, glowing neon lines, a
// gradient, halftone dots, or a pencil sketch. Colours come from the design's tokens wherever the style is not «real».

import { useId } from "react";
import { shrineParts, shrineSpec, TINT, type ArtStyle, type Part } from "@/lib/mahdi/shrine-art";

export default function ShrineArt({ shrineId, style, className = "", sky = false, label }: { shrineId: string | null | undefined; style: ArtStyle; className?: string; sky?: boolean; label?: string }) {
  const uid = useId().replace(/:/g, "");
  const parts = shrineParts(shrineSpec(shrineId));
  const real = style === "gold" || style === "flat" || style === "outline";
  const fillOf = (p: Part) => {
    if (style === "gold") return p.role === "detail" ? "none" : `url(#${uid}-${p.tint})`;
    if (style === "flat" || style === "outline") return p.role === "detail" ? "none" : TINT[p.tint][p.role === "wall" ? 1 : 0];
    if (style === "silhouette" || style === "dots") return p.role === "detail" ? "none" : "currentColor";
    if (style === "gradient") return p.role === "detail" ? "none" : `url(#${uid}-grad)`;
    return "none";
  };
  const strokeOf = (p: Part) => {
    if (style === "outline") return "#121212";
    if (style === "line" || style === "sketch") return "currentColor";
    if (style === "glow") return p.role === "dome" ? "var(--m-gold)" : "var(--m-gold-2)";
    if (real && p.role === "detail") return p.tint === "white" ? "#1e3a6e" : "rgba(0,0,0,.35)";
    if ((style === "silhouette" || style === "dots" || style === "gradient") && p.role === "detail") return "var(--m-bg)";
    return "none";
  };
  const width = style === "outline" ? 2.2 : style === "glow" ? 1.6 : style === "line" ? 1.2 : style === "sketch" ? 1.3 : 1;
  const filter = style === "glow" ? `url(#${uid}-glow)` : style === "sketch" ? `url(#${uid}-sketch)` : undefined;
  const mask = style === "dots" ? `url(#${uid}-dots)` : undefined;
  const shapes = (shift = 0) =>
    parts.map((p, k) => (
      <path key={k} d={p.d} fill={shift ? (p.role === "detail" ? "none" : "#121212") : fillOf(p)} stroke={shift ? "none" : strokeOf(p)} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" transform={shift ? `translate(${shift} ${shift})` : undefined} />
    ));
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMax meet" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        {style === "gold" &&
          (Object.keys(TINT) as (keyof typeof TINT)[]).map((t) => (
            <linearGradient key={t} id={`${uid}-${t}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={TINT[t][0]} />
              <stop offset="1" stopColor={TINT[t][1]} />
            </linearGradient>
          ))}
        <linearGradient id={`${uid}-grad`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--m-gold)" />
          <stop offset="1" stopColor="var(--m-gold-2)" />
        </linearGradient>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--m-gold-2)" stopOpacity=".0" />
          <stop offset="1" stopColor="var(--m-gold)" stopOpacity=".28" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${uid}-sketch`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="2.6" />
        </filter>
        <pattern id={`${uid}-dotp`} width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="1.7" fill="#fff" />
        </pattern>
        <mask id={`${uid}-dots`}>
          <rect width="400" height="200" fill={`url(#${uid}-dotp)`} />
        </mask>
      </defs>
      {sky && <rect x="0" y="0" width="400" height="184" fill={`url(#${uid}-sky)`} />}
      <g filter={filter} mask={mask}>
        {style === "outline" && shapes(4)}
        {shapes()}
        {style === "sketch" && <g transform="translate(1.2 -0.8)" opacity=".45">{shapes()}</g>}
      </g>
      {(style === "gold" || style === "flat" || style === "outline") && <rect x="0" y="184" width="400" height="16" fill={style === "outline" ? "#121212" : "rgba(0,0,0,.12)"} />}
    </svg>
  );
}
