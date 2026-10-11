"use client";

// The menu bar and the page tabs of «واجهات البرامج» (workspaces.ts): each program's own menu names, the same
// working items behind them (every item does something here, with its shortcut from «⌨️ الاختصارات»), and its pages —
// a big page (التلوين، المؤثرات، الصوت، الحركة) gives the tools most of the screen.

import { useEffect, useRef, useState } from "react";
import { KEYMAPS, showCombo, type ActionId, type ProgramId } from "@/lib/editor/shortcuts";
import { PAGE_INFO, type MenuGroup, type PageId, type Workspace } from "./workspaces";

/** What an item does: a shortcut's job, a page, or one of the editor's windows. */
export type MenuAct = { key: ActionId } | { page: PageId } | { open: "captions" | "shortcuts" | "layout" | "haidara" | "themes" | "styles" | "project" | "media" };

const ITEMS: Record<MenuGroup, ([string, MenuAct] | "-")[]> = {
  file: [["استورد ملفات…", { key: "import" }], ["احفظ", { key: "save" }], "-", ["المشروع (المقاس والخلفية)", { open: "project" }], ["صدّر الفيديو…", { key: "export" }]],
  edit: [["تراجع", { key: "undo" }], ["إعادة", { key: "redo" }], "-", ["قص", { key: "cut" }], ["نسخ", { key: "copy" }], ["لصق", { key: "paste" }], ["لصق السمات", { key: "pasteAttrs" }], ["تكرار", { key: "duplicate" }], "-", ["حذف", { key: "delete" }], ["حذف وسحب اللي بعده (Ripple)", { key: "ripple" }], "-", ["اختر الكل", { key: "selectAll" }], ["شيل الاختيار", { key: "deselect" }], "-", ["الاختصارات…", { open: "shortcuts" }]],
  clip: [["قص عند المؤشر", { key: "split" }], ["قص كل المسارات", { key: "splitAll" }], ["قص البداية لين المؤشر", { key: "trimStart" }], ["قص النهاية من المؤشر", { key: "trimEnd" }], "-", ["أضف انتقال تلاشي", { key: "transition" }], ["الحركة والمكان", { page: "motion" }], ["المؤثرات", { page: "fx" }]],
  timeline: [["قص كل المسارات", { key: "splitAll" }], ["القصّة اللي قبل", { key: "prevEdit" }], ["القصّة اللي بعد", { key: "nextEdit" }], "-", ["كبّر التايملاين", { key: "zoomIn" }], ["صغّر التايملاين", { key: "zoomOut" }], ["كل التايملاين في الشاشة", { key: "zoomFit" }]],
  marker: [["علامة عند المؤشر", { key: "marker" }], ["العلامة اللي بعد", { key: "nextMarker" }], ["العلامة اللي قبل", { key: "prevMarker" }]],
  titles: [["كابشن ونصوص…", { page: "captions" }], ["أساليب جاهزة", { open: "styles" }]],
  color: [["صفحة التلوين", { page: "color" }]],
  audio: [["صفحة الصوت", { page: "audio" }]],
  effects: [["المؤثرات", { page: "fx" }], ["الحركة (كي فريم)", { page: "motion" }], ["أساليب جاهزة", { open: "styles" }]],
  view: [["المعاينة ملء الشاشة", { key: "full" }], "-", ["كبّر التايملاين", { key: "zoomIn" }], ["صغّر التايملاين", { key: "zoomOut" }], ["كل التايملاين في الشاشة", { key: "zoomFit" }]],
  playback: [["شغّل / وقّف", { key: "play" }], ["فريم لقدّام", { key: "frameFwd" }], ["فريم للورا", { key: "frameBack" }], ["أول الفيديو", { key: "start" }], ["آخر الفيديو", { key: "end" }]],
  window: [["الوسائط", { open: "media" }], ["حيدرة", { open: "haidara" }], ["رتّب واجهتي…", { open: "layout" }], ["الثيمات والواجهات…", { open: "themes" }], ["الاختصارات…", { open: "shortcuts" }]],
  help: [["الاختصارات…", { open: "shortcuts" }], ["اسأل حيدرة", { open: "haidara" }]],
};

const mac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export default function MenuBar({ ws, page, keysFrom, onAct }: { ws: Workspace; page: PageId; keysFrom: ProgramId; onAct: (a: MenuAct) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open === null) return;
    const away = (e: PointerEvent) => !bar.current?.contains(e.target as Node) && setOpen(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  const keyOf = (a: ActionId) => {
    const c = KEYMAPS[keysFrom][a]?.[0] ?? KEYMAPS.jawad[a]?.[0];
    return c ? showCombo(c, mac()) : "";
  };
  const go = (a: MenuAct) => {
    setOpen(null);
    onAct(a);
  };
  return (
    <div className="ws-bars mx-2 mt-1 hidden flex-col gap-1 lg:flex">
      <div ref={bar} className="ws-menubar flex items-center gap-0.5 px-1 text-[12px]" role="menubar" aria-label={`قوائم ${ws.ar}`}>
        <span className="me-1 select-none px-1.5 text-[11px] font-bold text-jw-muted" title={`واجهة بنمط ${ws.en}`}>
          {ws.icon} {ws.en}
        </span>
        {ws.menus.map(([g, name], i) => (
          <div key={`${g}${i}`} className="relative">
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={open === i}
              className={`rounded px-2 py-1 ${open === i ? "bg-jw-accent text-jw-on-accent" : "hover:bg-jw-surface-2"}`}
              onClick={() => setOpen(open === i ? null : i)}
              onPointerEnter={() => open !== null && setOpen(i)}
            >
              {name.split(" · ")[0]}
            </button>
            {open === i && (
              <div role="menu" className="ws-menu absolute start-0 top-full z-[70] mt-0.5 min-w-60 py-1 shadow-2xl">
                {ITEMS[g].map((it, j) =>
                  it === "-" ? (
                    <div key={j} className="my-1 border-t border-jw-line" />
                  ) : (
                    <button key={j} type="button" role="menuitem" className="flex w-full items-center gap-4 px-3 py-1.5 text-start hover:bg-jw-accent hover:text-jw-on-accent" onClick={() => go(it[1])}>
                      <span className="flex-1">{it[0]}</span>
                      {"key" in it[1] && (
                        <kbd className="text-[10px] opacity-70" dir="ltr">
                          {keyOf(it[1].key)}
                        </kbd>
                      )}
                    </button>
                  ),
                )}
                {name.includes(" · ") && <p className="mt-1 border-t border-jw-line px-3 pt-1 text-[10px] text-jw-muted" dir="ltr">{name.split(" · ")[1]}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
      <nav className="ws-pages flex items-center gap-0.5 overflow-x-auto p-0.5" aria-label="الصفحات">
        {ws.pages.map(([p, name]) => (
          <button key={p + name} type="button" aria-pressed={page === p} className={`ws-page flex shrink-0 items-center gap-1.5 px-3 py-1 text-[12px] ${page === p ? "on" : ""}`} onClick={() => go({ page: p })} title={PAGE_INFO[p].big ? `${PAGE_INFO[p].ar}: صفحة كبيرة، الأدوات بحجم مريح` : PAGE_INFO[p].ar}>
            {name}
          </button>
        ))}
      </nav>
    </div>
  );
}
