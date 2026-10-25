"use client";

// The menu row and the page tabs of the pro look (workspaces.ts): the menus' items (every one does something here, with
// its shortcut from «⌨️ الاختصارات») and the pages — a big page (التلوين، المؤثرات، الصوت) gives the tools most of the
// screen. The tabs sit in the top bar, the menus in a slim row under it.

import { useEffect, useRef, useState } from "react";
import { KEYMAPS, showCombo, type ActionId, type ProgramId } from "@/lib/editor/shortcuts";
import Icon, { type IconName } from "../Icon";
import { PAGE_INFO, type MenuGroup, type PageId, type Workspace } from "./workspaces";

/** What an item does: a shortcut's job, a page, or one of the editor's windows. */
export type MenuAct = { key: ActionId } | { page: PageId } | { open: "captions" | "shortcuts" | "layout" | "haidara" | "haidaraDock" | "styles" | "project" | "media" };

const ITEMS: Record<MenuGroup, ([string, MenuAct] | "-")[]> = {
  file: [["استورد ملفات…", { key: "import" }], ["احفظ", { key: "save" }], "-", ["المشروع (المقاس والخلفية)", { open: "project" }], ["صدّر الفيديو…", { key: "export" }]],
  edit: [["تراجع", { key: "undo" }], ["إعادة", { key: "redo" }], "-", ["قص", { key: "cut" }], ["نسخ", { key: "copy" }], ["لصق", { key: "paste" }], ["لصق السمات", { key: "pasteAttrs" }], ["تكرار", { key: "duplicate" }], "-", ["حذف", { key: "delete" }], ["حذف وسحب اللي بعده (Ripple)", { key: "ripple" }], "-", ["اختر الكل", { key: "selectAll" }], ["شيل الاختيار", { key: "deselect" }], "-", ["الاختصارات…", { open: "shortcuts" }]],
  clip: [["قص عند المؤشر", { key: "split" }], ["قص كل المسارات", { key: "splitAll" }], ["قص البداية لين المؤشر", { key: "trimStart" }], ["قص النهاية من المؤشر", { key: "trimEnd" }], "-", ["أضف انتقال تلاشي", { key: "transition" }], ["الحركة والمكان", { page: "motion" }], ["المؤثرات", { page: "fx" }]],
  timeline: [["قص كل المسارات", { key: "splitAll" }], ["القصّة اللي قبل", { key: "prevEdit" }], ["القصّة اللي بعد", { key: "nextEdit" }], "-", ["كبّر التايملاين", { key: "zoomIn" }], ["صغّر التايملاين", { key: "zoomOut" }], ["كل التايملاين في الشاشة", { key: "zoomFit" }], "-", ["بداية منطقة التصدير (In)", { key: "markIn" }], ["نهاية منطقة التصدير (Out)", { key: "markOut" }], ["شيل منطقة التصدير", { key: "clearRange" }]],
  marker: [["علامة عند المؤشر", { key: "marker" }], ["العلامة اللي بعد", { key: "nextMarker" }], ["العلامة اللي قبل", { key: "prevMarker" }]],
  titles: [["كابشن ونصوص…", { page: "captions" }], ["أساليب جاهزة", { open: "styles" }]],
  color: [["صفحة التلوين", { page: "color" }]],
  audio: [["صفحة الصوت", { page: "audio" }]],
  effects: [["المؤثرات", { page: "fx" }], ["الحركة (كي فريم)", { page: "motion" }], ["أساليب جاهزة", { open: "styles" }]],
  view: [["المونتاج (الواجهة العادية)", { page: "edit" }], ["غرفة التلوين (صفحة كاملة)", { page: "color" }], ["صفحة المؤثرات", { page: "fx" }], ["صفحة الصوت", { page: "audio" }], "-", ["وضع التركيز (الشاشة والتايملاين)", { key: "focus" }], ["المعاينة ملء الشاشة", { key: "full" }], "-", ["كبّر التايملاين", { key: "zoomIn" }], ["صغّر التايملاين", { key: "zoomOut" }], ["كل التايملاين في الشاشة", { key: "zoomFit" }]],
  playback: [["شغّل / وقّف", { key: "play" }], ["فريم لقدّام", { key: "frameFwd" }], ["فريم للورا", { key: "frameBack" }], ["أول الفيديو", { key: "start" }], ["آخر الفيديو", { key: "end" }]],
  window: [["الوسائط", { open: "media" }], ["حيدرا ماكس", { open: "haidara" }], ["حيدرا ماكس فوق التايملاين (تعديل مباشر)", { open: "haidaraDock" }], ["رتّب واجهتي…", { open: "layout" }], ["الاختصارات…", { open: "shortcuts" }]],
  help: [["الاختصارات…", { open: "shortcuts" }], ["اسأل حيدرا ماكس", { open: "haidara" }]],
};

const mac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const PAGE_ICON: Record<PageId, IconName> = { media: "folder", cut: "scissors", edit: "frames", fx: "sparkles", motion: "diamond", color: "palette", audio: "audio", captions: "type", deliver: "download" };

/** The pages as tabs (the top bar's middle): an icon and a name, the open one lit from below in the accent. */
export function PageTabs({ ws, page, onAct }: { ws: Workspace; page: PageId; onAct: (a: MenuAct) => void }) {
  return (
    <nav className="pro-tabs" aria-label="الصفحات">
      {ws.pages.map(([p, name]) => (
        <button key={p} type="button" aria-pressed={page === p} className={page === p ? "on" : ""} onClick={() => onAct({ page: p })} title={PAGE_INFO[p].big ? `${name}: صفحة كاملة، الأدوات بحجم مريح` : name}>
          <Icon name={PAGE_ICON[p]} size={15} />
          {name}
        </button>
      ))}
    </nav>
  );
}

/** The menus: a slim row under the top bar, each opening a list with its shortcuts. */
export default function MenuBar({ ws, keysFrom, onAct }: { ws: Workspace; keysFrom: ProgramId; onAct: (a: MenuAct) => void }) {
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
    <div ref={bar} className="pro-menus" role="menubar" aria-label="القوائم">
      {ws.menus.map(([g, name], i) => (
        <div key={`${g}${i}`} className="relative">
          <button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={open === i} className={open === i ? "on" : ""} onClick={() => setOpen(open === i ? null : i)} onPointerEnter={() => open !== null && setOpen(i)}>
            {name}
          </button>
          {open === i && (
            <div role="menu" className="pro-menu">
              {ITEMS[g].map((it, j) =>
                it === "-" ? (
                  <div key={j} className="sep" />
                ) : (
                  <button key={j} type="button" role="menuitem" onClick={() => go(it[1])}>
                    <span className="flex-1">{it[0]}</span>
                    {"key" in it[1] && <kbd dir="ltr">{keyOf(it[1].key)}</kbd>}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
