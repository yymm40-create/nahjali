// «الواجهة الاحترافية» (the pro look): حيدرة كت dressed for a cinema suite on a big screen — the pages (الوسائط ·
// المونتاج · المؤثرات · التلوين · الصوت · التصدير), a menu bar, and the colours of a grading room: NEUTRAL greys with no
// hue at all (the eye judges colour against them) and ONE amber accent for what is live. It is one design of ours (built
// from what grading and editing suites have learned, copying none of them): flat panels with 4–6 px corners, line icons
// instead of emoji, numbers in a fixed-width face you drag to change, thin precise faders. The colour page opens as a
// whole room (workspaces.css, ColourRoom.tsx).

export type PageId = "media" | "cut" | "edit" | "fx" | "motion" | "color" | "audio" | "captions" | "deliver";

/** What each page does in حيدرة كت (the big pages: the settings panel takes most of the screen on that tab). */
export const PAGE_INFO: Record<PageId, { ar: string; big: boolean; tab?: "color" | "fx" | "sound" | "motion" }> = {
  media: { ar: "الوسائط", big: false },
  cut: { ar: "القص السريع", big: false },
  edit: { ar: "المونتاج", big: false },
  fx: { ar: "المؤثرات", big: true, tab: "fx" },
  motion: { ar: "الحركة", big: true, tab: "motion" },
  color: { ar: "التلوين", big: true, tab: "color" },
  audio: { ar: "الصوت", big: true, tab: "sound" },
  captions: { ar: "الكابشن", big: false },
  deliver: { ar: "التصدير", big: false },
};

/** The menus' contents (the same everywhere; each program names and orders its own menus). */
export type MenuGroup = "file" | "edit" | "clip" | "timeline" | "marker" | "titles" | "color" | "audio" | "effects" | "view" | "playback" | "window" | "help";

export interface Workspace {
  id: string;
  ar: string;
  en: string;
  icon: string;
  hint: string;
  /** the colours: background, panels, lines, text, the accent and the text on it */
  pal: { bg: string; s1: string; s2: string; s3: string; line: string; ink: string; muted: string; accent: string; onAccent: string };
  light?: boolean;
  /** corners in px (Avid and Premiere are square, CapCut and Filmora round) */
  radius: number;
  font: string | null;
  scale: number;
  /** where the sections sit: a column at the side, or page tabs under the work */
  rail: "side" | "pages";
  /** the panels on the other side (the library and settings where this program keeps them) */
  mirror?: boolean;
  tl: "classic" | "pro";
  /** the menu bar: [group, its name in this program] */
  menus: [MenuGroup, string][];
  /** the page tabs, as this program names them */
  pages: [PageId, string][];
}

export const PRO: Workspace = {
  id: "pro",
  ar: "احترافي سينمائي",
  en: "Cinema",
  icon: "🎞️",
  hint: "رمادي محايد ولون واحد، أرقام دقيقة، صفحات كاملة (للشاشات الكبيرة)",
  pal: { bg: "#111111", s1: "#181818", s2: "#1e1e1e", s3: "#2d2d2d", line: "#2b2b2b", ink: "#e8e8e8", muted: "#a6a6a6", accent: "#e8a33d", onAccent: "#1f1405" },
  radius: 5,
  font: "readex-pro",
  scale: 0.94,
  rail: "pages",
  tl: "pro",
  menus: [["file", "ملف"], ["edit", "تعديل"], ["clip", "مقطع"], ["timeline", "تايملاين"], ["marker", "علامات"], ["titles", "نصوص"], ["view", "عرض"], ["window", "نافذة"], ["help", "مساعدة"]],
  pages: [["media", "الوسائط"], ["edit", "المونتاج"], ["fx", "المؤثرات"], ["color", "التلوين"], ["audio", "الصوت"], ["deliver", "التصدير"]],
};

export const WORKSPACES: Workspace[] = [PRO];
export const WS_BY_ID = new Map(WORKSPACES.map((w) => [w.id, w]));

/** The CSS variables the pro look sets on the editor (the site's tokens, so everything follows). */
export function wsVars(w: Workspace): Record<string, string> {
  const p = w.pal;
  return {
    "--jw-bg": p.bg,
    "--jw-bg-2": p.bg,
    "--jw-surface": p.s1,
    "--jw-surface-2": p.s2,
    "--jw-surface-3": p.s3,
    "--jw-line": p.line,
    "--jw-line-strong": "#3a3a3e",
    "--jw-ink": p.ink,
    "--jw-muted": p.muted,
    "--jw-faint": "#6e6e75",
    "--jw-accent": p.accent,
    "--jw-on-accent": p.onAccent,
    "--ws-radius": `${w.radius}px`,
    colorScheme: "dark",
    background: p.bg,
  };
}
