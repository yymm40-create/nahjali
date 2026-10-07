"use client";

import type { ReactNode } from "react";
import Markdown from "@/components/Markdown";
import ActionBar, { type SendMode } from "./ActionBar";
import { STATUS_LABELS } from "@config/film";
import { credits } from "@/lib/film/credits";

export const statusChip = (s: string) =>
  s === "approved" ? "bg-teal text-white" : s === "awaiting_approval" || s === "generated" ? "bg-gold text-on-gold" : s === "failed" ? "bg-red-500 text-white" : "";

/** What a step card shows of a deliverable version (sheet maker, director). */
export interface StepVersion {
  version: number;
  status: string;
  body: string;
  data: { notes?: string; suggestion?: string; cost_usd?: number };
}

/**
 * One deliverable of a film assistant: its text (prompts in ``` blocks stay hidden), notes, a suggested
 * change, and the shared actions (approve | edit · new direction).
 */
export default function StepCard({
  title,
  v,
  current,
  busy,
  hideBody,
  onApprove,
  approveLabel,
  onSend,
  warning,
  noActions,
  children,
}: {
  title: string;
  v: StepVersion;
  current: boolean;
  busy: boolean;
  hideBody?: boolean;
  onApprove?: () => void;
  approveLabel?: string;
  onSend?: (mode: SendMode, text: string) => void;
  warning?: string;
  /** The card's actions live inside its children (the map: approval needs the per-item choices). */
  noActions?: boolean;
  children?: ReactNode;
}) {
  const pending = v.status === "awaiting_approval";
  return (
    <article className={`card space-y-3 p-5 ${pending ? "border-2 border-gold" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">{title} <span className="text-sm text-muted">· النسخة {v.version}</span></h2>
        <span className="flex items-center gap-1.5">
          {typeof v.data.cost_usd === "number" && <span className="chip text-xs" title="تكلفة هذا الرد">{credits(v.data.cost_usd)}</span>}
          <span className={`chip ${statusChip(v.status)}`}>{STATUS_LABELS[v.status]}</span>
        </span>
      </header>
      {!hideBody && (
        <details open={pending || current}>
          <summary className="cursor-pointer text-sm font-extrabold text-muted">اعرض النص</summary>
          <Markdown text={v.body} highlightRequests={pending} hideCode />
          {v.data.notes && (
            <div className="mt-2 rounded-2xl bg-surface-2 p-3 text-sm">
              <p className="font-extrabold">ملاحظات</p>
              <Markdown text={v.data.notes} />
            </div>
          )}
        </details>
      )}
      {pending && v.data.suggestion && (
        <div className="space-y-2 rounded-2xl border-2 border-gold bg-gold/10 p-4">
          <p className="font-extrabold">💡 اقتراح تعديل</p>
          <p className="font-bold leading-8">{v.data.suggestion}</p>
          {!busy && onSend && (
            <button className="btn btn-secondary w-full" onClick={() => onSend("edit", `نفّذ التعديل المقترح: ${v.data.suggestion}`)}>نفّذ التعديل المقترح</button>
          )}
          <p className="text-sm font-bold text-muted">أو اعتمد وكمّل بدون تعديل.</p>
        </div>
      )}
      {children}
      {!noActions && (
        <ActionBar busy={busy} onApprove={onApprove} approveLabel={approveLabel} onSend={onSend} warning={warning} />
      )}
    </article>
  );
}

