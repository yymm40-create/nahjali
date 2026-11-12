"use client";

// The owner's «معرض الناس» review: each work with its picture or video, title, prompt and who sent it, and the buttons
// (وافق، ارفض، أخفِ، ميّز). Every press goes to /api/jawad/admin/gallery (owner only) and the list reloads.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUS_LABEL, shapeOf, type ReviewAction } from "@config/jawad/gallery";
import type { ReviewFilter, ReviewRow } from "@/lib/jawad/server/gallery";
import { GalleryMedia } from "../gallery/GalleryBrowser";
import Icon from "../Icon";
import LocalTime from "../LocalTime";

const BUTTONS: { action: ReviewAction; label: string; icon: string; tone: string; when: (r: ReviewRow) => boolean }[] = [
  { action: "approve", label: "وافق", icon: "check", tone: "jw-btn-primary", when: (r) => r.status === "pending" || r.status === "rejected" },
  { action: "feature", label: "ميّزه", icon: "sparkles", tone: "", when: (r) => !r.featured && (r.status === "approved" || r.status === "pending") },
  { action: "unfeature", label: "شيل التمييز", icon: "x", tone: "jw-btn-quiet", when: (r) => r.featured },
  { action: "reject", label: "ارفض", icon: "x", tone: "jw-btn-quiet", when: (r) => r.status === "pending" || r.status === "approved" },
  { action: "hide", label: "أخفِ (والرابط)", icon: "eyeOff", tone: "jw-btn-quiet text-jw-danger", when: (r) => r.status !== "hidden" },
  { action: "unhide", label: "رجّعه خاص", icon: "undo", tone: "jw-btn-quiet", when: (r) => r.status === "hidden" },
];

function Row({ r }: { r: ReviewRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState<ReviewAction | null>(null);
  const [error, setError] = useState("");
  const act = async (action: ReviewAction) => {
    setBusy(action);
    setError("");
    try {
      const res = await fetch("/api/jawad/admin/gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, action }) });
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(b.error ?? "تعذّر.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const shape = shapeOf(r.settings);
  return (
    <li className="jw-panel grid gap-3 overflow-hidden p-3 sm:grid-cols-[220px_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-lg">
        <GalleryMedia item={r} />
      </div>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="jw-chip">{STATUS_LABEL[r.status]}</span>
          {r.featured && <span className="jw-chip text-jw-gold">★ مختار</span>}
          {r.shareOn && <span className="jw-chip">🔗 رابطه شغّال</span>}
          <span className="jw-chip" dir="ltr">{r.generatorName}</span>
          {shape && <span className="jw-chip" dir="ltr">{shape}</span>}
        </div>
        <p className="text-sm font-semibold" dir="auto">{r.title || <span className="text-jw-faint">بدون عنوان</span>}</p>
        <p className="line-clamp-4 whitespace-pre-wrap text-xs text-jw-muted" dir="auto">{r.prompt || "— (برومبت خاص)"}</p>
        <p className="text-[11px] text-jw-faint">
          من <span dir="ltr">{r.email ?? r.userId.slice(0, 8)}</span>
          {r.submittedAt && (
            <>
              {" · "}أُرسل <LocalTime iso={r.submittedAt} />
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BUTTONS.filter((b) => b.when(r)).map((b) => (
            <button key={b.action} type="button" className={`jw-btn !min-h-8 !px-2.5 text-xs ${b.tone}`} disabled={Boolean(busy)} onClick={() => act(b.action)}>
              {busy === b.action ? <span className="jw-spinner" /> : <Icon name={b.icon} size={14} />} {b.label}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-jw-danger" role="alert">{error}</p>}
      </div>
    </li>
  );
}

export default function GalleryReview({ rows, filter }: { rows: ReviewRow[]; filter: ReviewFilter }) {
  if (!rows.length) return <p className="jw-panel p-6 text-center text-sm text-jw-muted">{filter === "pending" ? "ما فيه أعمال تنتظر موافقتك." : "ما فيه شي هنا."}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <Row key={r.id} r={r} />
      ))}
    </ul>
  );
}
