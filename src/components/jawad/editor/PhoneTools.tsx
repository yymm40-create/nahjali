"use client";

// The phone's tool bar, CapCut's way: a row of tools at the bottom. «صوت» or «نص» slides its own row in (with a
// back arrow that brings the main row back), and a clip tapped on the timeline brings that clip's tools instead.

import { useState } from "react";
import Icon from "../Icon";
import type { InspectorTab } from "./Inspector";

export type ClipKindOf = "video" | "image" | "audio" | "text";

export type PhoneAction =
  | { kind: "library" }
  | { kind: "split" }
  | { kind: "delete" }
  | { kind: "duplicate" }
  | { kind: "text" }
  | { kind: "captions" }
  | { kind: "claude" }
  | { kind: "ask"; text: string }
  | { kind: "extract" }
  | { kind: "separate" }
  | { kind: "sceneCut" }
  | { kind: "tab"; tab: InspectorTab }
  | { kind: "project" }
  | { kind: "pick" }
  | { kind: "deselect" };

type Menu = "main" | "audio" | "text" | "clip";

interface Chip {
  id: string;
  label: string;
  icon: string;
  go: PhoneAction | Menu;
  accent?: boolean;
  disabled?: boolean;
}

const MENU_TITLE: Record<Menu, string> = { main: "", audio: "الصوت", text: "النص", clip: "المقطع" };

/** The tools for a clip of this kind (what its settings offer, as CapCut lays them out). */
function clipChips(kind: ClipKindOf, hasAudio: boolean): Chip[] {
  const visual = kind !== "audio";
  const media = kind !== "text";
  return [
    { id: "split", label: "قص", icon: "scissors", go: { kind: "split" } },
    { id: "basic", label: kind === "text" ? "النص" : kind === "audio" ? "السرعة" : "تعديل", icon: kind === "text" ? "type" : "settings", go: { kind: "tab", tab: "basic" } },
    ...(hasAudio || kind === "audio" ? [{ id: "sound", label: "الصوت", icon: "volume", go: { kind: "tab", tab: "sound" } } as Chip] : []),
    { id: "delete", label: "حذف", icon: "trash", go: { kind: "delete" } },
    ...(visual ? [{ id: "anim", label: "حركة", icon: "wand", go: { kind: "tab", tab: "anim" } } as Chip] : []),
    ...(visual ? [{ id: "fx", label: "مؤثرات", icon: "burst", go: { kind: "tab", tab: "fx" } } as Chip] : []),
    ...(visual && media ? [{ id: "color", label: "ألوان", icon: "palette", go: { kind: "tab", tab: "color" } } as Chip] : []),
    ...(visual ? [{ id: "transition", label: "انتقال", icon: "frames", go: { kind: "tab", tab: "transition" } } as Chip] : []),
    ...(visual ? [{ id: "motion", label: "موضع", icon: "diamond", go: { kind: "tab", tab: "motion" } } as Chip] : []),
    ...(visual && media ? [{ id: "backdrop", label: "الخلفية", icon: "user", go: { kind: "tab", tab: "backdrop" } } as Chip] : []),
    ...(kind === "video" ? [{ id: "scene", label: "تقطيع ذكي", icon: "sparkles", go: { kind: "sceneCut" }, accent: true } as Chip] : []),
    ...(hasAudio ? [{ id: "extract", label: "استخراج الصوت", icon: "music", go: { kind: "extract" } } as Chip] : []),
    ...(hasAudio || kind === "audio" ? [{ id: "separate", label: "فصل الصوت", icon: "layers", go: { kind: "separate" } } as Chip] : []),
    { id: "dup", label: "تكرار", icon: "copy", go: { kind: "duplicate" } },
  ];
}

const MAIN: Chip[] = [
  { id: "edit", label: "تعديل", icon: "settings", go: { kind: "pick" } },
  { id: "audio", label: "صوت", icon: "music", go: "audio" },
  { id: "text", label: "نص", icon: "type", go: "text" },
  { id: "claude", label: "حيدرة", icon: "orb", go: { kind: "claude" }, accent: true },
  { id: "captions", label: "كابشن", icon: "sparkles", go: { kind: "captions" } },
  { id: "media", label: "الوسائط", icon: "folder", go: { kind: "library" } },
  { id: "project", label: "المقاس", icon: "ratio", go: { kind: "project" } },
];

const AUDIO: Chip[] = [
  { id: "lib", label: "من ملفاتي", icon: "folder", go: { kind: "library" } },
  { id: "music", label: "موسيقى", icon: "music", go: { kind: "ask", text: "سوّ لي موسيقى تناسب جو الفيديو وحطها من البداية." }, accent: true },
  { id: "sfx", label: "مؤثر صوتي", icon: "burst", go: { kind: "ask", text: "أبي مؤثر صوتي يناسب اللحظة اللي عند المؤشر." }, accent: true },
  { id: "extract", label: "استخراج الصوت", icon: "volume", go: { kind: "extract" } },
  { id: "separate", label: "فصل الصوت", icon: "layers", go: { kind: "separate" } },
];

const TEXT: Chip[] = [
  { id: "add", label: "أضف نص", icon: "type", go: { kind: "text" } },
  { id: "hook", label: "نص الهوك", icon: "wand", go: { kind: "ask", text: "سوّ لي نص هوك قوي لبداية الفيديو." }, accent: true },
  { id: "captions", label: "كابشن تلقائي", icon: "sparkles", go: { kind: "captions" } },
];

export default function PhoneTools({ selected, hasAudio, total, readOnly, on }: { selected: ClipKindOf | null; hasAudio: boolean; total: number; readOnly: boolean; on: (a: PhoneAction) => void }) {
  const [row, setMenu] = useState<Exclude<Menu, "clip">>("main");
  // a clip selected on the timeline brings its tools; unselected, the row it came from
  const menu: Menu = selected ? "clip" : row;
  const chips = selected ? clipChips(selected, hasAudio) : menu === "audio" ? AUDIO : menu === "text" ? TEXT : MAIN;
  const back = () => (menu === "clip" ? on({ kind: "deselect" }) : setMenu("main"));
  const disabled = (c: Chip) => readOnly || (c.id === "split" && !total) || (menu === "main" && c.id === "edit" && !total);

  return (
    <nav className="flex items-stretch border-t border-jw-line bg-jw-surface pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="الأدوات">
      {menu !== "main" && (
        <button type="button" className="flex w-12 shrink-0 flex-col items-center justify-center gap-0.5 border-e border-jw-line text-[10px] text-jw-muted" onClick={back} aria-label={`رجوع من ${MENU_TITLE[menu]}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
          رجوع
        </button>
      )}
      <div key={menu} className="jw-phone-row jw-scroll flex min-w-0 flex-1 overflow-x-auto px-1" style={{ scrollbarWidth: "none" }}>
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={disabled(c)}
            onClick={() => (typeof c.go === "string" ? setMenu(c.go as Exclude<Menu, "clip">) : on(c.go))}
            className={`flex w-[4.6rem] shrink-0 flex-col items-center justify-end gap-1 px-1 pb-1.5 pt-2 text-[11px] leading-tight disabled:opacity-40 ${c.accent ? "text-jw-accent" : "text-jw-muted"}`}
          >
            {c.icon === "orb" ? <span className="jw-orb h-7 w-7" aria-hidden /> : <Icon name={c.icon} size={22} />}
            <span className="whitespace-nowrap">{c.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
