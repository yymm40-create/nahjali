"use client";

import { useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { REPORT_CATEGORIES, type ReportCategory } from "@/lib/mahdi/social";
import { useMahdi } from "../Provider";
import Sheet from "../Sheet";

const R = t.social.report;

/** One-tap reasons (singing or music, indecent scenes, abuse, other); the report reaches the owner at once. */
export default function ReportSheet({ open, onClose, target }: { open: boolean; onClose: () => void; target: { post?: string; story?: string } }) {
  const { toast } = useMahdi();
  const [category, setCategory] = useState<ReportCategory>("singing");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const url = target.post ? `/api/mahdi/community/posts/${target.post}` : `/api/mahdi/social/stories/${target.story}`;
      await mahdiFetch(url, { method: "POST", json: { report: reason, category } });
      toast(R.sent);
      setReason("");
      onClose();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <Sheet open={open} onClose={onClose} title={R.title}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <p>{R.body}</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={R.title}>
          {REPORT_CATEGORIES.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={category === c} className="m-option min-h-12 px-3 text-sm font-semibold" onClick={() => setCategory(c)}>
              {R.categories[c]}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="m-label">{R.reason}</span>
          <textarea className="m-field" rows={2} maxLength={300} dir="auto" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <button className="m-btn m-btn-primary w-full" disabled={busy}>{R.send}</button>
      </form>
    </Sheet>
  );
}
