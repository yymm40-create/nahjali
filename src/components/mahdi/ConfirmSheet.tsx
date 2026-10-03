"use client";

import { useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import Sheet from "./Sheet";

/** Asks before something that can't be undone (deleting). */
export default function ConfirmSheet({
  open,
  onClose,
  title,
  body,
  confirmLabel = t.common.confirmDelete,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="space-y-5">
        <p>{body}</p>
        {error && <p className="m-error" role="alert">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            className="m-btn m-btn-danger flex-1"
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
