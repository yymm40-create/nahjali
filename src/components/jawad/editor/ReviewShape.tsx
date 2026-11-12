"use client";

// «رابط مراجعة للعميل»: the box or arrow a client drew on the frame, drawn over the picture (its corners are shares of
// the picture, so it sits right at any size). Used by the public page and the editor's «تعليقات المراجعة».

import { useId } from "react";
import type { Shape } from "@/lib/editor/review";

export default function ReviewShape({ shape, color = "#facc15" }: { shape: Shape; color?: string }) {
  const id = useId().replace(/:/g, "");
  const p = (n: number) => n * 100;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <defs>
        <marker id={`h${id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={color} />
        </marker>
      </defs>
      {shape.t === "box" ? (
        <rect x={p(shape.x1)} y={p(shape.y1)} width={p(shape.x2 - shape.x1)} height={p(shape.y2 - shape.y1)} fill="none" stroke={color} strokeWidth={3} vectorEffect="non-scaling-stroke" rx={0.6} />
      ) : (
        <line x1={p(shape.x1)} y1={p(shape.y1)} x2={p(shape.x2)} y2={p(shape.y2)} stroke={color} strokeWidth={3} vectorEffect="non-scaling-stroke" markerEnd={`url(#h${id})`} />
      )}
    </svg>
  );
}
