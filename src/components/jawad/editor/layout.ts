// «واجهتي»: the person arranges the editor on a computer — which side each panel sits on, how wide the settings
// panel is, and any panel taken out as a window that floats where they put it (dragged by its bar, resized from its
// corner). Kept on this device.

export type PanelId = "chat" | "preview" | "panel";
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Layout {
  /** the docked panels from the start of the row (the right in Arabic) */
  order: PanelId[];
  /** the panels taken out as windows */
  float: Partial<Record<PanelId, Rect>>;
  /** the settings / library panel's width */
  panelW: number;
}

export const PANELS: Record<PanelId, string> = { chat: "حيدرة", preview: "المعاينة", panel: "الإعدادات والمكتبة" };
export const DEFAULT_LAYOUT: Layout = { order: ["chat", "preview", "panel"], float: {}, panelW: 320 };
const KEY = "jw-editor-layout";

export function readLayout(): Layout {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!v || typeof v !== "object") return DEFAULT_LAYOUT;
    const ids = Object.keys(PANELS) as PanelId[];
    const order = Array.isArray(v.order) && v.order.length === 3 && ids.every((id) => v.order.includes(id)) ? (v.order as PanelId[]) : DEFAULT_LAYOUT.order;
    const float: Layout["float"] = {};
    for (const id of ids) {
      const r = v.float?.[id];
      if (r && [r.x, r.y, r.w, r.h].every((n) => Number.isFinite(n))) float[id] = { x: r.x, y: r.y, w: Math.max(240, r.w), h: Math.max(160, r.h) };
    }
    const panelW = Number.isFinite(v.panelW) ? Math.min(720, Math.max(260, v.panelW)) : DEFAULT_LAYOUT.panelW;
    return { order, float, panelW };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayout(l: Layout) {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {}
}

/** A window's first place: in the middle of the screen, sized for what it holds. */
export function firstRect(id: PanelId, others = 0): Rect {
  const W = typeof window === "undefined" ? 1280 : window.innerWidth;
  const H = typeof window === "undefined" ? 800 : window.innerHeight;
  const w = id === "preview" ? Math.min(640, W * 0.45) : 380;
  const h = Math.min(H - 120, id === "preview" ? 460 : 620);
  // each new window steps aside from the ones already out, so none hides another's bar
  return { x: Math.round((W - w) / 2 - others * 60), y: 90 + others * 48, w: Math.round(w), h: Math.round(h) };
}

/** A window kept on the screen (its bar always reachable). */
export function onScreen(r: Rect): Rect {
  const W = window.innerWidth;
  const H = window.innerHeight;
  return { ...r, x: Math.min(W - 80, Math.max(-r.w + 120, r.x)), y: Math.min(H - 40, Math.max(0, r.y)) };
}
