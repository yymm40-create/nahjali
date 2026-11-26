import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createBackLayers } from "@/lib/mahdi/client/back-layers";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

/** A small browser history: entries, the current one, and popstate fired after a traversal (as browsers do). */
function fakeWindow() {
  const entries: unknown[] = [{ page: true }];
  const urls: string[] = ["/mahdi"];
  let at = 0;
  let stopped = 0;
  const listeners: ((e: { stopImmediatePropagation(): void }) => void)[] = [];
  const queue: (() => void)[] = [];
  const history = {
    get state() {
      return entries[at] ?? null;
    },
    pushState(data: unknown, _t?: string, url?: string) {
      entries.splice(at + 1);
      urls.splice(at + 1);
      entries.push(data);
      urls.push(url ?? urls[at]);
      at++;
    },
    replaceState(data: unknown) {
      entries[at] = data;
    },
    go(n: number) {
      at = Math.max(0, Math.min(entries.length - 1, at + n));
      queue.push(() => {
        let cut = false;
        const e = { stopImmediatePropagation: () => (cut = true) };
        for (const fn of listeners) if (!cut) fn(e);
        if (cut) stopped++;
      });
    },
  };
  return {
    win: {
      history: history as unknown as History,
      location: {
        get href() {
          return urls[at];
        },
      },
      addEventListener: (_: "popstate", fn: (e: { stopImmediatePropagation(): void }) => void) => listeners.push(fn),
    },
    /** how many popstate events were kept from the router */
    stopped: () => stopped,
    /** the person presses the phone's back */
    back: () => history.go(-1),
    /** runs what the browser and the microtasks would run next */
    settle: () => {
      while (queue.length) queue.shift()!();
    },
    depth: () => at,
    navigate: () => history.pushState({ page: "other" }, "", "/mahdi/other"),
  };
}

describe("the phone's back closes the open layer first (the plan of 26 November 2026)", () => {
  it("back closes the sheet and stays on the screen", () => {
    const w = fakeWindow();
    const tasks: (() => void)[] = [];
    const layers = createBackLayers(w.win, (fn) => tasks.push(fn));
    let closed = 0;
    const id = layers.open(() => closed++);
    expect(w.depth()).toBe(1);
    w.back();
    w.settle();
    expect(closed).toBe(1);
    expect(w.depth()).toBe(0);
    // same screen: the router is not told (it would cancel a navigation in flight)
    expect(w.stopped()).toBe(1);
    // the sheet's own cleanup afterwards does nothing more
    layers.close(id);
    tasks.splice(0).forEach((fn) => fn());
    expect(w.depth()).toBe(0);
  });

  it("closing it another way (✕, Esc, save) leaves no extra entry, and that back is not taken as the person's", () => {
    const w = fakeWindow();
    const tasks: (() => void)[] = [];
    const layers = createBackLayers(w.win, (fn) => tasks.push(fn));
    let closed = 0;
    const id = layers.open(() => closed++);
    layers.close(id);
    tasks.splice(0).forEach((fn) => fn());
    w.settle();
    expect(w.depth()).toBe(0);
    expect(closed).toBe(0);
    expect(w.stopped()).toBe(1);
  });

  it("layers stack: back closes the top one only; two closed at once take both entries", () => {
    const w = fakeWindow();
    const tasks: (() => void)[] = [];
    const layers = createBackLayers(w.win, (fn) => tasks.push(fn));
    const shut: string[] = [];
    const a = layers.open(() => shut.push("a"));
    layers.open(() => shut.push("confirm"));
    w.back();
    w.settle();
    expect(shut).toEqual(["confirm"]);
    expect(w.depth()).toBe(1);
    const c = layers.open(() => shut.push("c"));
    layers.close(c);
    layers.close(a);
    tasks.splice(0).forEach((fn) => fn());
    w.settle();
    expect(w.depth()).toBe(0);
    expect(shut).toEqual(["confirm"]);
  });

  it("a sheet giving way to another keeps one entry", () => {
    const w = fakeWindow();
    const tasks: (() => void)[] = [];
    const layers = createBackLayers(w.win, (fn) => tasks.push(fn));
    const a = layers.open(() => {});
    layers.close(a);
    layers.open(() => {});
    tasks.splice(0).forEach((fn) => fn());
    expect(w.depth()).toBe(1);
  });

  it("a link inside the sheet moves on to its page: closing never undoes that move", () => {
    const w = fakeWindow();
    const tasks: (() => void)[] = [];
    const layers = createBackLayers(w.win, (fn) => tasks.push(fn));
    const a = layers.open(() => {});
    w.navigate();
    layers.close(a);
    tasks.splice(0).forEach((fn) => fn());
    expect(w.depth()).toBe(2);
  });

  it("every sheet and dialog of the app uses it", () => {
    expect(read("src/components/mahdi/Sheet.tsx")).toContain("useBackClose(open, onClose)");
    for (const f of ["social/Stories.tsx", "social/StoryCamera.tsx", "race/RaceRoom.tsx", "health/CoachChat.tsx"]) expect(read(`src/components/mahdi/${f}`), f).toContain("useBackClose(");
  });
});
