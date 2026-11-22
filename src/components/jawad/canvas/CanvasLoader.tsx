"use client";

// «اللوحة» is a browser-only tool: its code loads on its own page, after the page shell (nothing of it reaches the
// studio's or any other page's bundle).

import dynamic from "next/dynamic";
import type { CanvasProps } from "./types";

const CanvasStudio = dynamic(() => import("./CanvasStudio"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[calc(100dvh-var(--jw-header-h)-var(--jw-bar-h))] place-items-center" dir="rtl">
      <span className="flex items-center gap-2 text-sm text-jw-muted">
        <span className="jw-spinner" aria-hidden /> يجهّز اللوحة…
      </span>
    </div>
  ),
});

export default function CanvasLoader(props: CanvasProps) {
  return <CanvasStudio {...props} />;
}
