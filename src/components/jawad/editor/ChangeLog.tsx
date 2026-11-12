"use client";

// «🕘 سجل التغييرات»: the project's saved changes, newest first — who made each (أنت / حيدرا ماكس), what in plain Arabic,
// and when; a turn of حيدرا ماكس shows the steps he took. «ارجع لهنا» brings the project back to a kept point as a new
// change (one undo takes it back); before the database is updated (0111) the log shows and the button is hidden.

import { useEffect, useState } from "react";
import { postJson } from "@/lib/fetch";
import { restoreLabel, SNAPSHOT_CAP, type Change } from "@/lib/editor/changes-core";
import DockFrame from "./DockFrame";
import Icon from "../Icon";

/** «قبل ٥ دقائق», «أمس 9:40 م»… */
function when(at: string, now: number) {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return "";
  const s = Math.round((t - now) / 1000);
  if (s > -45) return "الحين";
  const rel = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
  if (s > -3600) return rel.format(Math.round(s / 60), "minute");
  if (s > -86_400) return rel.format(Math.round(s / 3600), "hour");
  return new Date(t).toLocaleString("ar", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function ChangeLog({
  dock,
  open,
  onClose,
  projectId,
  flush,
  onRestore,
  readOnly,
}: {
  /** the editor's right column (a computer); a dialog on a phone */
  dock?: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** saves what is waiting first, so the newest change is in the list */
  flush: () => Promise<void>;
  /** brings a kept version back (true when it went on) */
  onRestore: (version: number, label: string) => Promise<boolean>;
  readOnly: boolean;
}) {
  const [data, setData] = useState<{ changes: Change[]; points: number[] | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  const load = async () => {
    setError(null);
    try {
      await flush();
      const r = await postJson<{ changes: Change[]; points: number[] | null }>(`/api/jawad/editor/projects/${projectId}`, { action: "history" });
      setData(r);
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const restore = async (c: Change, version: number, undoTurn: boolean) => {
    const label = restoreLabel(c, undoTurn);
    if (!window.confirm(undoTurn ? `تلغي تعديل حيدرا ماكس ${c.what} وترجع المشروع لما كان قبله؟\nتقدر تتراجع عنها بعدين.` : `ترجع المشروع لحالته بعد «${c.what.slice(0, 80)}»؟\nتقدر تتراجع عنها بعدين.`)) return;
    setBusy(version);
    const ok = await onRestore(version, label);
    setBusy(null);
    if (ok) void load();
  };

  const points = data?.points ? new Set(data.points) : null;
  return (
    <DockFrame dock={dock} open={open} onClose={onClose} title="سجل التغييرات">
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-2">
          <p className="m-0 flex-1 text-[12px] leading-5 text-jw-muted">كل تعديل انحفظ: مين سوّاه، وش هو، ومتى.</p>
          <button type="button" className="jw-btn jw-btn-quiet !min-h-8 text-xs" onClick={() => void load()} title="حدّث القائمة">
            <Icon name="retry" size={14} /> حدّث
          </button>
        </div>
        {data && !points && <p className="m-0 rounded-lg bg-jw-surface-2 px-2 py-1.5 text-[12px] text-jw-muted">ℹ️ «ارجع لهنا» يشتغل بعد تحديث قاعدة البيانات (ملف 0111)؛ السجل يشتغل الحين.</p>}
        {points && !readOnly && (
          <p className="m-0 text-[11px] leading-5 text-jw-faint">
            نقاط الرجوع تنحفظ قبل وبعد كل دور لحيدرا ماكس، وكل كم دقيقة من شغلك (آخر {SNAPSHOT_CAP} نقطة).
          </p>
        )}
        {error && <p className="m-0 text-[12px] text-jw-danger">{error}</p>}
        {!data && !error && (
          <p className="m-0 flex items-center gap-2 text-[12px] text-jw-muted">
            <span className="jw-spinner !h-3 !w-3" /> نجيب السجل…
          </p>
        )}
        {data && !data.changes.length && <p className="m-0 text-[13px] text-jw-muted">ما فيه تعديلات محفوظة لين الحين.</p>}
        <ol className="m-0 list-none space-y-2 p-0">
          {data?.changes.map((c, i) => {
            const mine = c.who === "you";
            const back = !readOnly && i > 0 && points?.has(c.version);
            // his last turn, taken back whole (an older one: «ارجع لهنا» on the change before it)
            const undoTurn = !readOnly && !mine && !c.restore && i === 0 && points?.has(c.from);
            return (
              <li key={`${c.version}-${i}`} className={`rounded-xl border p-2.5 ${i === 0 ? "border-jw-accent/50" : "border-jw-line"}`}>
                <div className="flex items-center gap-2 text-[12px]">
                  {mine ? <Icon name="user" size={14} /> : <span className="jw-orb h-4 w-4 shrink-0" aria-hidden />}
                  <b>{mine ? "أنت" : "حيدرا ماكس"}</b>
                  <span className="text-jw-faint">{when(c.at, now)}</span>
                  {i === 0 && <span className="ms-auto rounded-full bg-jw-accent/15 px-2 py-0.5 text-[10px] font-semibold text-jw-accent">المشروع الحين</span>}
                </div>
                <p className="m-0 mt-1 text-[13px] leading-6" dir="auto">
                  {c.restore ? "↩️ " : ""}
                  {c.what}
                </p>
                {c.steps.length > 0 && (
                  <details className="mt-1" open={i === 0 && !mine}>
                    <summary className="cursor-pointer text-[12px] text-jw-muted">
                      {mine ? "التفاصيل" : "خطواته"} ({c.steps.length})
                    </summary>
                    <ol className="m-0 mt-1 list-decimal space-y-0.5 ps-5 text-[12px] leading-5 text-jw-muted">
                      {c.steps.map((s, k) => (
                        <li key={k} dir="auto">{s}</li>
                      ))}
                    </ol>
                  </details>
                )}
                {(back || undoTurn) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {back && (
                      <button type="button" className="jw-btn !min-h-8 text-xs" disabled={busy !== null} onClick={() => void restore(c, c.version, false)} title="رجّع المشروع لحالته بعد هذا التعديل (تقدر تتراجع)">
                        {busy === c.version ? <span className="jw-spinner !h-3 !w-3" /> : <Icon name="undo" size={14} />} ارجع لهنا
                      </button>
                    )}
                    {undoTurn && (
                      <button type="button" className="jw-btn jw-btn-quiet !min-h-8 text-xs" disabled={busy !== null} onClick={() => void restore(c, c.from, true)} title="رجّع المشروع لما كان قبل هذا الدور من حيدرا ماكس (تقدر تتراجع)">
                        {busy === c.from ? <span className="jw-spinner !h-3 !w-3" /> : <Icon name="x" size={14} />} ألغِ تعديله
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </DockFrame>
  );
}
