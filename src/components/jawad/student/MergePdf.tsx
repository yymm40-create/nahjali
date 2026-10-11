"use client";

// «الطالب الذكي» · «ادمج النواتج في PDF واحد» — one button that puts every finished output's PDF in a single file, in
// the order the outputs are listed (free; made again each time, so it holds the outputs as they are now). The file
// downloads by itself, and its link stays on the page in case the browser held the download back.

import { useState } from "react";
import Icon from "@/components/jawad/Icon";
import type { OutputView } from "./client";
import { mergeParts } from "@/lib/jawad/student/merge-parts";
import type { ProjectHook } from "./StudentProject";
import { ErrorLine, useAsync } from "./ui";

export interface MergedView {
  url: string;
  titles: string[];
  skipped: string[];
  failed: string[];
  pages: number;
}

/** How many finished outputs have a PDF to put in (the button shows from two). */
export const mergeable = (outputs: OutputView[]) =>
  mergeParts(outputs.map((o) => ({ id: o.id, title: o.title, kind: o.kind, ord: o.ord, status: o.status, files: Object.fromEntries(o.files.map((f) => [f, f])) }))).parts.length;

/** Starts the download of a signed link (a link that downloads, never a new tab). */
export function download(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** The line under the button: what went in and what was left out. */
export function MergedNote({ m }: { m: MergedView }) {
  return (
    <div className="space-y-1 rounded-xl border border-jw-line bg-white p-3 text-sm">
      <a href={m.url} className="font-bold text-violet-700 underline" rel="noreferrer">
        📎 نزّل الملف المدموج ({m.pages} صفحة)
      </a>
      <p className="text-xs text-jw-muted">فيه بالترتيب: {m.titles.join(" ← ")}.</p>
      {!!m.skipped.length && <p className="text-xs text-jw-faint">ما دخل (ما له PDF أو ما اكتمل): {m.skipped.join("، ")}.</p>}
      {!!m.failed.length && <p className="text-xs text-jw-danger">ما قدرت أقرأ ملف: {m.failed.join("، ")}.</p>}
      <p className="text-xs text-jw-faint">الرابط يعمل ١٠ دقائق؛ اضغط الزر مرة ثانية يطلع لك جديد.</p>
    </div>
  );
}

export default function MergePdf({ p, className = "" }: { p: ProjectHook; className?: string }) {
  const { busy, error, run } = useAsync();
  const [done, setDone] = useState<MergedView | null>(null);
  const ready = mergeable(p.state.outputs);
  if (ready < 2) return null;
  return (
    <div className={`space-y-2 ${className}`}>
      <button
        type="button"
        className="jw-btn"
        disabled={busy}
        title="يجمع ملفات PDF للنواتج الجاهزة في ملف واحد بترتيبها (مجاني)"
        onClick={() =>
          void run(async () => {
            const r = (await p.act({ action: "merge_pdf" })) as unknown as MergedView;
            setDone(r);
            download(r.url);
          })
        }
      >
        {busy ? <span className="jw-spinner" aria-hidden /> : <Icon name="layers" size={16} />} ادمج النواتج في PDF واحد
      </button>
      <ErrorLine error={error} />
      {done && <MergedNote m={done} />}
    </div>
  );
}
