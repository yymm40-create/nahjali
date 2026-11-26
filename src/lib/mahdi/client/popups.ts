// «نافذة وحدة بس في كل زيارة» (owner-approved, 26 November 2026): the layers that open by themselves — a reward, the reading
// challenge's invitation, «كيف تجربتك؟», the Android news — wait their turn. Nothing opens as the app opens (or right after signing
// in): the first one comes a moment after the person completes something (a habit logged…), and only ONE opens per visit; the rest
// wait for the next visit. A visit is this tab's session (sessionStorage), so a reload is the same visit.

export type PopupId = "reward" | "readChallenge" | "feedback" | "androidNews";

/** Who goes first when several wait at once: the reward the person just earned, then the invitation, then the questions. */
export const POPUP_RANK: Record<PopupId, number> = { reward: 0, readChallenge: 1, feedback: 2, androidNews: 3 };

export interface Visit {
  /** the person completed something during this visit */
  acted: boolean;
  /** the one layer already shown during this visit */
  shown: PopupId | null;
}

/** The layer whose turn it is now, or null (nothing done yet, one already shown, or none waiting). Pure. */
export function nextPopup(visit: Visit, waiting: readonly PopupId[]): PopupId | null {
  if (!visit.acted || visit.shown) return null;
  return [...waiting].sort((a, b) => POPUP_RANK[a] - POPUP_RANK[b])[0] ?? null;
}

const KEY = "mahdi:popup-visit";
/** after the action, a short wait: the toast of the tap is read first, and the ones that want to open at the same time compete by rank */
export const SETTLE_MS = 2500;

export function readVisit(): Visit {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Partial<Visit> | null;
    return { acted: Boolean(v?.acted), shown: typeof v?.shown === "string" && v.shown in POPUP_RANK ? (v.shown as PopupId) : null };
  } catch {
    return { acted: false, shown: null };
  }
}

function writeVisit(v: Visit) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}

const waiting = new Map<PopupId, () => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function schedule(ms = SETTLE_MS) {
  if (typeof window === "undefined") return;
  clearTimeout(timer);
  timer = setTimeout(pick, ms);
}

function pick() {
  const id = nextPopup(readVisit(), [...waiting.keys()]);
  if (!id) return;
  // never on top of a sheet the person has open: try again a bit later
  if (document.querySelector("dialog[open]")) return schedule(4000);
  writeVisit({ ...readVisit(), shown: id });
  const grant = waiting.get(id);
  waiting.delete(id);
  grant?.();
}

/** The person completed something (a habit logged, something saved): from now on, one layer may open. */
export function noteAction() {
  if (typeof window === "undefined") return;
  const v = readVisit();
  if (!v.acted) writeVisit({ ...v, acted: true });
  schedule();
}

/** A layer asks for its turn; `grant` is called when it may open. Returns the function that takes the request back. */
export function wantPopup(id: PopupId, grant: () => void): () => void {
  waiting.set(id, grant);
  schedule();
  return () => {
    if (waiting.get(id) === grant) waiting.delete(id);
  };
}
