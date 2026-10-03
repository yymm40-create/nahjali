"use client";

import { useEffect, useId, useRef } from "react";
import { t } from "@/lib/mahdi/i18n";
import Icon from "./Icon";

/**
 * Bottom sheet on phones, centred dialog on larger screens. Built on the native <dialog>, so focus stays inside,
 * Esc closes it, and screen readers announce it as a dialog.
 */
export default function Sheet({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="m-sheet"
      style={wide ? { maxWidth: 720 } : undefined}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <>
          <div className="m-sheet-grip" aria-hidden="true" />
          <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-inherit px-5 pb-2 pt-3">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button type="button" className="m-icon-btn -me-2" onClick={onClose} aria-label={t.common.close}>
              <Icon name="close" />
            </button>
          </header>
          <div className="px-5 pb-6">{children}</div>
        </>
      )}
    </dialog>
  );
}
