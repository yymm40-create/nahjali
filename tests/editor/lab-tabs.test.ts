// «مختبر الموشن» in tabs: what is kept about the tabs, and where each tab keeps its work.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NEW_TITLE, readTabs, storeOf, tabsKey } from "@/components/jawad/editor/lab-tabs";

const kept = new Map<string, string>();
beforeEach(() => {
  kept.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());

describe("the lab's tabs", () => {
  it("the first tab keeps the project's own key (the work from before tabs is still there); the others have theirs", () => {
    expect(storeOf("p1", "main")).toBe("p1");
    expect(storeOf("p1", "ab12cd")).toBe("p1-ab12cd");
    expect(new Set(["main", "a", "b"].map((t) => storeOf("p1", t))).size).toBe(3);
  });

  it("nothing kept: no tabs", () => {
    expect(readTabs("p1")).toBeNull();
    kept.set(tabsKey("p1"), "not json");
    expect(readTabs("p1")).toBeNull();
    kept.set(tabsKey("p1"), JSON.stringify({ tabs: [] }));
    expect(readTabs("p1")).toBeNull();
  });

  it("the tabs come back as they were left, with the one that was on show", () => {
    kept.set(tabsKey("p1"), JSON.stringify({ tabs: [{ id: "main", title: "قلب" }, { id: "x9", title: "إعلان" }], active: "x9" }));
    expect(readTabs("p1")).toEqual({ tabs: [{ id: "main", title: "قلب" }, { id: "x9", title: "إعلان" }], active: "x9" });
  });

  it("made safe: a tab with no id or a repeated id is dropped, a missing title is named, an unknown active falls back to the first", () => {
    kept.set(tabsKey("p1"), JSON.stringify({ tabs: [{ title: "بلا رقم" }, { id: "a", title: "" }, { id: "a", title: "مكرر" }, { id: "b/../x", title: "y" }], active: "zzz" }));
    expect(readTabs("p1")).toEqual({ tabs: [{ id: "a", title: NEW_TITLE }, { id: "bx", title: "y" }], active: "a" });
  });
});
