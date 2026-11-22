"use client";

import { t } from "@/lib/mahdi/i18n";
import Robot from "@/components/mahdi/Robot";
import SheikhChat from "@/components/mahdi/SheikhChat";

const S = t.sheikh;

/** «الشيخ الذكي» on its own page: the same kept conversation as the floating robot's, at the page's full height. */
export default function SheikhPage() {
  return (
    <div className="flex h-[calc(100dvh-11rem)] min-h-[28rem] flex-col gap-3">
      <header className="flex items-center gap-3">
        <Robot size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="m-display text-2xl">{S.title}</h1>
          <p className="m-muted text-sm">{S.tagline}</p>
        </div>
      </header>
      <SheikhChat />
    </div>
  );
}
