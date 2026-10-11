"use client";

// «الطالب الذكي» — at the plan, BEFORE the content is written: the material is measured against the page count the student
// asked for (capacity.ts, kept by the plan step), and when they don't fit the student is asked what to do — take the number
// the material honestly makes (the plan is made again for it), or approve the plan as it is and have the number kept
// (padding it, or squeezing the material) — instead of finding out from a finished file.

import { capacityLine, readCapacity } from "@/lib/jawad/student/capacity";
import type { OutputView } from "./client";
import { PaidButton } from "./ui";

export default function CapacityAsk({ o, additionsAllowed, act, running }: { o: OutputView; additionsAllowed: boolean; act: (b: Record<string, unknown>) => Promise<unknown>; running: boolean }) {
  const c = readCapacity(o.settings);
  if (!c || c.verdict === "fits" || o.status !== "plan_review") return null;
  // the settings without the measure the plan step kept (a saved setting starts a new measure)
  const settings = Object.fromEntries(Object.entries(o.settings).filter(([k]) => k !== "_capacity"));
  return (
    <div className="space-y-3 rounded-2xl border border-jw-warn/50 bg-jw-warn/10 p-4" role="note" aria-label="هل المادة تكفي للصفحات؟">
      <p className="font-bold">⚖️ قبل ما يكتب صادق: هل المادة تكفي للصفحات؟</p>
      <p className="text-sm">{capacityLine(c, additionsAllowed)}</p>
      <div className="flex flex-wrap items-center gap-2">
        <PaidButton
          label={`خلّها ${c.best.toLocaleString("ar")} صفحة وأعد الخطة`}
          what={`يغيّر عدد الصفحات من ${c.pages.toLocaleString("ar")} إلى ${c.best.toLocaleString("ar")} (اللي تكفيه مادتك)، ويُعاد إعداد الخطة عليه، قبل أي كتابة.`}
          disabled={running}
          run={async (b) => {
            // the number is changed only once the student has agreed to the new plan
            if (b.confirm) await act({ action: "settings", settings: { ...settings, pages: c.best } });
            return act({ action: "plan", ...b });
          }}
        />
        <span className="text-xs text-jw-muted">أو اعتمد الخطة تحت كما هي، ويلتزم صادق بـ {c.pages.toLocaleString("ar")} صفحة بالضبط.</span>
      </div>
    </div>
  );
}
