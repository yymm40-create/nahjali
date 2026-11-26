// A small deletion with «تراجع» (the plan of 26 November 2026: a confirm sheet for the big things, an undo for the
// small ones). The thing disappears at once; it is really deleted only when the undo time runs out, or straight away
// when the page is being left, so nothing waits forever and an «تراجع» never has to bring anything back from the server.

export interface Pending {
  /** «تراجع»: nothing is sent, the thing comes back. */
  undo: () => void;
  /** Sends the deletion now (the page is being left). */
  flush: () => void;
}

const open = new Set<Pending>();
let listening = false;
const flushAll = () => [...open].forEach((p) => p.flush());

/**
 * Hides now, deletes after `ms` unless undone. `restore` runs on «تراجع» or when the deletion fails (with its error).
 * Pure apart from the timer and the page-leave listener, so it can be tested with fake timers.
 */
export function deferDelete(opts: { ms: number; run: () => Promise<unknown>; restore: (error?: Error) => void }): Pending {
  let done = false;
  const finish = () => {
    done = true;
    clearTimeout(timer);
    open.delete(pending);
  };
  const pending: Pending = {
    undo: () => {
      if (done) return;
      finish();
      opts.restore();
    },
    flush: () => {
      if (done) return;
      finish();
      opts.run().catch((e: Error) => opts.restore(e));
    },
  };
  const timer = setTimeout(pending.flush, opts.ms);
  open.add(pending);
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("pagehide", flushAll);
  }
  return pending;
}
