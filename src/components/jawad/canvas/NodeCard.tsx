"use client";

// «اللوحة»: one node as the board (and the phone's list) shows it — its name and state, its input rows (the board puts
// the dots on them), and what it holds: the words, the picture, the generator with its price and result, or the
// results gathered at the end.

import Riyal from "@/components/Riyal";
import { NODE_KINDS, type CanvasNode } from "@config/jawad/canvas";
import Icon from "../Icon";
import type { NodeStatus } from "./types";

export interface Media {
  kind: "image" | "video" | "audio";
  url: string | null;
  downloadUrl?: string;
}

const STATE_AR: Record<NodeStatus["state"], string> = { queued: "بالدور", working: "يشتغل", done: "جاهز", failed: "ما نجح", skipped: "توقف", manual: "يحتاج يدك" };

export function MediaThumb({ m, big = false }: { m: Media; big?: boolean }) {
  if (!m.url) return <div className="cv-thumb cv-thumb-empty"><Icon name={m.kind} size={18} /></div>;
  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
  if (m.kind === "image") return <img className={`cv-thumb ${big ? "is-big" : ""}`} src={m.url} alt="" loading="lazy" draggable={false} />;
  if (m.kind === "video") return <video className={`cv-thumb ${big ? "is-big" : ""}`} src={m.url} muted loop playsInline preload="metadata" controls={big} onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()} />;
  return <audio className="cv-audio" src={m.url} controls preload="none" data-nodrag />;
}

export default function NodeCard({
  node,
  status,
  fresh,
  generatorName,
  price,
  owner,
  problem,
  summary,
  media,
  gathered,
  onRun,
  onRerun,
  onManual,
  canRun,
}: {
  node: CanvasNode;
  status?: NodeStatus;
  /** a kept result that still matches its inputs */
  fresh: boolean;
  generatorName?: string;
  /** halalas, for this node alone (null: unknown yet) */
  price?: number | null;
  owner: boolean;
  problem?: string | null;
  /** a line of what it holds (the words, the style's name…) */
  summary?: string;
  /** its picture or result */
  media?: Media | null;
  /** «نتيجة»: what reaches it */
  gathered?: Media[];
  onRun?: () => void;
  onRerun?: () => void;
  /** «امسح/عدّل»: open the painting tool */
  onManual?: () => void;
  canRun: boolean;
}) {
  const def = NODE_KINDS[node.kind];
  const busy = status?.state === "working" || status?.state === "queued";
  const stale = def.runs && media && !fresh && !busy;
  return (
    <>
      <div className="cv-head">
        <span className="cv-icon"><Icon name={def.icon} size={15} /></span>
        <b className="cv-title">{node.data.title || def.label}</b>
        {status && <span className={`cv-state is-${status.state}`}>{busy && <span className="jw-spinner" aria-hidden />}{STATE_AR[status.state]}</span>}
        {!status && stale && <span className="cv-state is-stale" title="تغيّر شي قبلها: بتنعاد في التشغيل الجاي">تغيّر</span>}
      </div>
      {def.inputs.length > 0 && (
        <div className="cv-rows">
          {def.inputs.map((p) => (
            <div key={p.id} className="cv-row">
              {p.label}
              {p.required && <span className="text-jw-danger"> *</span>}
            </div>
          ))}
        </div>
      )}
      <div className="cv-body">
        {generatorName && <p className="cv-gen">{generatorName}</p>}
        {summary && <p className="cv-sum">{summary}</p>}
        {media && <MediaThumb m={media} />}
        {gathered && (gathered.length ? <div className="cv-gathered">{gathered.map((m, i) => <MediaThumb key={i} m={m} />)}</div> : <p className="cv-sum">وصّل هنا النتائج اللي تبيها.</p>)}
        {status?.note && <p className="cv-note">{status.note}</p>}
        {status?.error && <p className="cv-err" role="alert">{status.error}</p>}
        {!status?.error && problem && <p className="cv-warn">{problem}</p>}
        {def.runs && (
          <div className="cv-actions" data-nodrag>
            {price != null && !owner && (
              <span className="cv-price">
                <Riyal halalas={price} size={11} />
              </span>
            )}
            {onManual ? (
              <button type="button" className="jw-btn !min-h-7 !px-2 text-[11px]" disabled={!canRun || busy} onClick={onManual}>
                <Icon name="wand" size={12} /> لوّن وشغّل
              </button>
            ) : status?.state === "failed" ? (
              <button type="button" className="jw-btn !min-h-7 !px-2 text-[11px]" disabled={!canRun} onClick={onRerun}>
                <Icon name="retry" size={12} /> أعد
              </button>
            ) : fresh ? (
              <button type="button" className="jw-btn jw-btn-quiet !min-h-7 !px-2 text-[11px]" disabled={!canRun || busy} onClick={onRerun} title="ولّد من جديد (تدفع عليها)">
                <Icon name="retry" size={12} /> من جديد
              </button>
            ) : (
              <button type="button" className="jw-btn jw-btn-primary !min-h-7 !px-2 text-[11px]" disabled={!canRun || busy} onClick={onRun}>
                <Icon name="play" size={12} /> شغّل هذي
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
