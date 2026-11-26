"use client";

import { useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import Sheet from "./Sheet";

/**
 * Asks before something big (the plan of 26 November 2026: a confirm sheet for the big things, like deleting a group;
 * an undo for the small ones). `tone="primary"` for a big step that is not a deletion (announcing a winner).
 */
export default function ConfirmSheet({
  open,
  onClose,
  title,
  body,
  confirmLabel = t.common.confirmDelete,
  onConfirm,
  tone = "danger",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  tone?: "danger" | "primary";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="space-y-5">
        {body && <p>{body}</p>}
        {error && <p className="m-error" role="alert">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            className={`m-btn flex-1 ${tone === "primary" ? "m-btn-primary" : "m-btn-danger"}`}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onConfirm();
                onClose();
              } catch (e) {
                setError((e as Error).message);
              }
              setBusy(false);
            }}
          >
            {busy ? t.common.saving : confirmLabel}
          </button>
          <button type="button" className="m-btn m-btn-ghost flex-1" onClick={onClose} autoFocus>
            {t.common.cancel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
