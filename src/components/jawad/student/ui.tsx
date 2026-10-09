"use client";

// «الطالب الذكي» — shared pieces: a paid action (price first, then confirm), the three-way review gate
// (اعتمد / عدّل / أمر آخر), job status, and small helpers.

import { fmtSar } from "@config/coins";
import { useRef, useState } from "react";
import Dialog from "@/components/jawad/Dialog";
import Icon from "@/components/jawad/Icon";
import { newKey, type JobView } from "./client";

export function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-jw-danger/40 bg-jw-danger/10 px-3 py-2 text-sm text-jw-danger">
      <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
      {error}
    </p>
  );
}

/**
 * A paid step: asks the server for the price first (nothing runs), shows it with the balance, and runs only on
 * confirmation — with one key for this attempt, so a repeated click or a lost connection never charges twice.
 */
export function PaidButton({
  label,
  run,
  disabled,
  primary = true,
  what,
}: {
  label: string;
  run: (body: Record<string, unknown>) => Promise<unknown>;
  disabled?: boolean;
  primary?: boolean;
  what: string;
}) {
  const [quote, setQuote] = useState<{ coins: number; balance: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string>("");

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = (await run({ confirm: false })) as { quote?: number; balance?: number | null };
      key.current = newKey();
      // free steps start right away: nothing to agree to
      if (!r.quote) {
        await run({ confirm: true, key: key.current });
        return;
      }
      setQuote({ coins: r.quote ?? 0, balance: r.balance ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await run({ confirm: true, key: key.current });
      setQuote(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={`jw-btn ${primary ? "jw-btn-primary" : ""}`} onClick={ask} disabled={disabled || busy}>
        {busy && !quote ? <span className="jw-spinner" aria-hidden /> : null}
        {label}
      </button>
      {error && !quote && <ErrorLine error={error} />}
      <Dialog open={Boolean(quote)} onClose={() => !busy && setQuote(null)} title={label}>
        {quote && (
          <div className="space-y-4 p-4">
            <p className="text-sm text-jw-muted">{what}</p>
            <div className="jw-panel flex items-center justify-between gap-3 p-3">
              <span>التكلفة {quote.coins ? "(الحد الأعلى)" : ""}</span>
              <b className="text-lg">{quote.coins ? `${fmtSar(quote.coins)} ر.س` : "مجانًا"}</b>
            </div>
            {quote.coins > 0 && (
              <p className="text-xs text-jw-faint">
                يُحجز هذا المبلغ الآن، ثم يُخصم منه ما كلّفته الخطوة فعلًا ويرجع لك الباقي. إذا فشلت الخطوة يرجع كاملًا.
                {quote.balance !== null ? ` رصيدك: ${fmtSar(quote.balance)} ر.س.` : ""}
              </p>
            )}
            <ErrorLine error={error} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="jw-btn jw-btn-primary" onClick={go} disabled={busy}>
                {busy ? <span className="jw-spinner" aria-hidden /> : <Icon name="check" size={16} />}
                {quote.coins ? "أوافق، ابدأ" : "ابدأ"}
              </button>
              <button type="button" className="jw-btn jw-btn-quiet" onClick={() => setQuote(null)} disabled={busy}>
                إلغاء
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

/**
 * Every review stage: what happens next, and three clear ways on — approve, edit (with a note), or «أمر آخر»
 * (a new requirement or a correction of an earlier decision).
 */
export function Gate({
  next,
  onApprove,
  approveLabel = "اعتمد",
  onEdit,
  editLabel = "عدّل",
  onOther,
  editHint,
  disabled,
  children,
}: {
  next: string;
  onApprove: () => Promise<unknown>;
  approveLabel?: string;
  /** a note → a (paid) revision; omit to hide */
  onEdit?: (note: string) => React.ReactNode;
  editLabel?: string;
  onOther?: (note: string) => React.ReactNode;
  editHint?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const [mode, setMode] = useState<null | "edit" | "other">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      await onApprove();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="jw-panel space-y-3 border-jw-line-strong p-4">
      <p className="text-sm text-jw-muted">
        <Icon name="info" size={14} className="me-1 inline" />
        بعد الاعتماد: {next}
      </p>
      {children}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="jw-btn jw-btn-primary" onClick={approve} disabled={disabled || busy}>
          {busy ? <span className="jw-spinner" aria-hidden /> : <Icon name="check" size={16} />}
          {approveLabel}
        </button>
        {onEdit && (
          <button type="button" className="jw-btn" aria-pressed={mode === "edit"} onClick={() => setMode(mode === "edit" ? null : "edit")}>
            {editLabel}
          </button>
        )}
        {onOther && (
          <button type="button" className="jw-btn" aria-pressed={mode === "other"} onClick={() => setMode(mode === "other" ? null : "other")}>
            أمر آخر
          </button>
        )}
      </div>
      {mode && (
        <div className="space-y-2">
          <label className="jw-label" htmlFor="gate-note">
            {mode === "edit" ? editHint ?? "ما الذي تريد تعديله؟" : "أضف مطلبًا جديدًا أو صحّح قرارًا سابقًا:"}
          </label>
          <textarea id="gate-note" className="jw-textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          {note.trim().length > 2 && (mode === "edit" ? onEdit?.(note.trim()) : onOther?.(note.trim()))}
        </div>
      )}
      <ErrorLine error={error} />
    </div>
  );
}

export function JobStatus({ job }: { job: JobView | undefined }) {
  if (!job) return null;
  if (job.status === "failed") return <ErrorLine error={job.error ?? "فشلت الخطوة."} />;
  if (job.status === "succeeded") return null;
  return (
    <div className="jw-panel flex items-center gap-3 p-3 text-sm" role="status" aria-live="polite">
      <span className="jw-spinner" aria-hidden />
      <span>{job.stage || "في الطابور"}</span>
    </div>
  );
}

export const Seg = <T extends string>({ value, options, onChange, label }: { value: T; options: readonly { id: T; label: string }[]; onChange: (v: T) => void; label: string }) => (
  <div className="jw-seg flex-wrap" role="radiogroup" aria-label={label}>
    {options.map((o) => (
      <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
        {o.label}
      </button>
    ))}
  </div>
);

export function useAsync() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}
