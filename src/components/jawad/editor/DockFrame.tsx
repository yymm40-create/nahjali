"use client";

// «كاب كت» (the owner): an option that needs its own window opens in the editor's RIGHT column on a computer (the
// screen stays in the middle, the menus at the left); on a phone, or with no column, it is the usual dialog.

import { createPortal } from "react-dom";
import Dialog from "../Dialog";
import Icon from "../Icon";

export default function DockFrame({ dock, open, onClose, title, children }: { dock?: HTMLElement | null; open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!dock) return <Dialog open={open} onClose={onClose} title={title}>{children}</Dialog>;
  if (!open) return null;
  return createPortal(
    <section className="flex min-h-0 flex-1 flex-col" aria-label={title} dir="rtl">
      <header className="flex shrink-0 items-center gap-2 border-b border-jw-line px-3 py-2">
        <b className="flex-1 text-sm">{title}</b>
        <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" onClick={onClose} aria-label="إغلاق">
          <Icon name="x" />
        </button>
      </header>
      <div className="jw-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>,
    dock,
  );
}
