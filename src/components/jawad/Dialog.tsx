"use client";

import { useEffect, useRef } from "react";
import Icon from "./Icon";

/** A native modal dialog (focus trap, Escape, backdrop click) in JAWAD AI's style. */
export default function Dialog({
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
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`jw-dialog m-auto ${wide ? "max-w-[min(1100px,calc(100vw-2rem))]" : ""}`}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
    >
      {open && (
        <>
          <div className="flex items-center justify-between gap-3 border-b border-jw-line px-4 py-3">
            <h2 className="truncate font-semibold">{title}</h2>
            <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" onClick={onClose} aria-label="إغلاق">
              <Icon name="x" />
            </button>
          </div>
          {children}
        </>
      )}
    </dialog>
  );
}
