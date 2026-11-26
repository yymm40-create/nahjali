"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fmtPct, fmtPoints, t } from "@/lib/mahdi/i18n";

/**
 * «تقدّمي» has three tabs (the plan of 26 November 2026: five became three): الأسبوع (the overview of this week, and any week's
 * report), الشهر (the month's report, with «قارن» inside it) and التقويم. `match` lists the pages each tab covers.
 */
export const PROGRESS_TABS = [
  { href: "/mahdi/progress", label: "الأسبوع", match: ["/mahdi/progress", "/mahdi/progress/week"] },
  { href: "/mahdi/progress/month", label: "الشهر", match: ["/mahdi/progress/month", "/mahdi/progress/compare"] },
  { href: "/mahdi/progress/calendar", label: "التقويم", match: ["/mahdi/progress/calendar"] },
] as const;

/** The tab a progress page belongs to (0 · 1 · 2). */
export const progressTab = (pathname: string) => Math.max(0, PROGRESS_TABS.findIndex((x) => (x.match as readonly string[]).includes(pathname)));

/** The three tabs of «تقدّمي», on the segmented control. */
export function ProgressTabs() {
  const pathname = usePathname();
  const k = progressTab(pathname);
  return (
    <nav aria-label={t.progress.title} className="flex justify-center">
      <div className="m-slider" data-n="3" style={{ "--k": k } as React.CSSProperties}>
        <span className="m-slider-knob" aria-hidden="true" />
        {PROGRESS_TABS.map((tab, i) => (
          <Link key={tab.href} href={tab.href} aria-current={i === k ? "page" : undefined}>
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="m-card p-4">
      <p className="m-eyebrow">{label}</p>
      <p className="m-num text-2xl font-semibold">{value}</p>
      {sub && <p className="m-num text-xs m-muted">{sub}</p>}
    </div>
  );
}

/** Labelled horizontal bar (value text always shown, so colour is never the only cue). */
export function BarRow({ label, score, color = "gold", href, extra }: { label: string; score: number | null; color?: string; href?: string; extra?: string }) {
  const body = (
    <>
      <div className="flex justify-between gap-3 text-sm">
        <span className="truncate">{label}</span>
        <span className="m-num shrink-0 font-semibold">
          {fmtPct(score)}
          {extra && <span className="m-muted font-normal"> {extra}</span>}
        </span>
      </div>
      <div className="m-bar" aria-hidden="true">
        <span style={{ width: `${Math.round((score ?? 0) * 100)}%` }} />
      </div>
    </>
  );
  return <li className={`p-${color} space-y-1`}>{href ? <Link href={href} className="block space-y-1">{body}</Link> : body}</li>;
}

/** «72% → 84%» with the change in points. */
export function Delta({ a, b, delta }: { a: number | null; b: number | null; delta: number | null }) {
  const tone = delta === null ? "var(--m-muted)" : delta >= 1 ? "var(--m-success)" : delta <= -1 ? "var(--m-warning)" : "var(--m-muted)";
  return (
    <span className="m-num inline-flex items-center gap-1.5">
      {fmtPct(a)} <span aria-hidden="true">←</span>
      <span className="sr-only">{t.compare.second}</span> {fmtPct(b)}
      {delta !== null && (
        <span className="text-sm font-semibold" style={{ color: tone }}>
          ({fmtPoints(delta)})
        </span>
      )}
    </span>
  );
}

export function Insights({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <ul className="space-y-2">
      {lines.map((l) => (
        <li key={l} className="m-note text-sm">{l}</li>
      ))}
    </ul>
  );
}
