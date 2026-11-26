// «زر الرجوع في الأندرويد يسكّر الورقة أو المحادثة أول» (the plan of 26 November 2026): while a sheet or a dialog is open
// the page keeps one extra history entry for it, so the phone's back (or the browser's) closes the layer instead of
// leaving the screen. Closing it any other way (✕, Esc, a tap outside, «احفظ») takes that entry away again, so no stray
// entries are left behind. Layers stack: back closes the top one only.
//
// The entries carry no URL of their own; Next's router copies its own state into them (it patches pushState). The popstate
// of a step that stays on the same address (back over a layer's entry) is ours alone: it is caught first (capture) and
// kept from Next's router, so the router never "restores" the page — which would also cancel a navigation the layer
// started as it closed (a sheet that saves and moves to another screen).

type HistoryLike = Pick<History, "pushState" | "replaceState" | "go" | "state">;
interface WindowLike {
  history: HistoryLike;
  location: { href: string };
  addEventListener(type: "popstate", fn: (e: { stopImmediatePropagation(): void }) => void, options: { capture: boolean }): void;
}

const KEY = "mLayer";

export interface BackLayers {
  /** A layer opened: one history entry for it. Returns its id, for `close`. */
  open(onBack: () => void): string;
  /** The layer closed by itself (not by back): its entry goes away. */
  close(id: string): void;
}

export function createBackLayers(win: WindowLike, defer: (fn: () => void) => void = queueMicrotask): BackLayers {
  const stack: { id: string; href: string; onBack: () => void }[] = [];
  let seq = 0;
  // entries of closed layers still to be taken off, and the popstate events we cause ourselves (to ignore)
  let pending = 0;
  let skip = 0;
  let skipHref = "";
  let listening = false;

  const isOpen = (id: string) => stack.some((l) => l.id === id);
  // the entry on top is one of ours whose layer has closed (not a page the person moved to meanwhile)
  const topIsClosedLayer = () => {
    const id = (win.history.state as Record<string, unknown> | null)?.[KEY];
    return typeof id === "string" && !isOpen(id);
  };

  function onPop(e: { stopImmediatePropagation(): void }) {
    if (skip > 0) {
      skip--;
      if (win.location.href === skipHref) e.stopImmediatePropagation();
      return;
    }
    const top = stack.pop();
    if (!top) return;
    top.onBack();
    // still on the same screen: nothing for the router to do (a jump further back is left to it)
    if (win.location.href === top.href) e.stopImmediatePropagation();
  }

  function flush() {
    const n = pending;
    pending = 0;
    if (n <= 0 || !topIsClosedLayer()) return;
    skip++;
    skipHref = win.location.href;
    win.history.go(-n);
  }

  return {
    open(onBack) {
      if (!listening) {
        win.addEventListener("popstate", onPop, { capture: true });
        listening = true;
      }
      const id = `l${++seq}`;
      // a layer that closed in the same moment (one sheet giving way to another) hands its entry over
      if (pending > 0 && topIsClosedLayer()) {
        pending--;
        win.history.replaceState({ [KEY]: id }, "");
      } else win.history.pushState({ [KEY]: id }, "");
      stack.push({ id, href: win.location.href, onBack });
      return id;
    },
    close(id) {
      const i = stack.findIndex((l) => l.id === id);
      if (i === -1) return; // closed by back: its entry is already gone
      stack.splice(i, 1);
      pending++;
      defer(flush);
    },
  };
}

let shared: BackLayers | null = null;
/** The one stack of the page (in the browser only). */
export function backLayers(): BackLayers | null {
  if (typeof window === "undefined") return null;
  shared ??= createBackLayers(window);
  return shared;
}
