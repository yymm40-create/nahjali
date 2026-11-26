import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KIND_TOP, isSteady, kindBoard, nudgeBlock, nudgesMissing, presentDays, steadyFor, windowDays } from "@/lib/mahdi/groups/kind";
import { rankingFor } from "@/lib/mahdi/groups/privacy";
import { deferDelete } from "@/lib/mahdi/client/undo";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const row = (rank: number, name: string, mine = false) => ({ rank, displayName: name, mine });

describe("المجتمع · a small ranking that never shows who is at the bottom", () => {
  const ten = Array.from({ length: 10 }, (_, i) => row(i + 1, `P${i + 1}`));

  it("shows the first three places and nobody below them", () => {
    const b = kindBoard(ten);
    expect(KIND_TOP).toBe(3);
    expect(b.entries.map((e) => e.displayName)).toEqual(["P1", "P2", "P3"]);
    expect(b.me).toBeNull();
    expect(b.total).toBe(10);
    expect(JSON.stringify(b)).not.toMatch(/"P(4|5|6|7|8|9|10)"/);
  });

  it("adds my own place apart when I am below the top, and only mine", () => {
    const list = ten.map((e) => (e.rank === 8 ? { ...e, mine: true } : e));
    const b = kindBoard(list);
    expect(b.entries).toHaveLength(3);
    expect(b.me?.rank).toBe(8);
    expect(JSON.stringify(b)).not.toMatch(/"P(4|5|6|7|9|10)"/);
  });

  it("does not repeat me when I am already in the top", () => {
    const list = ten.map((e) => (e.rank === 2 ? { ...e, mine: true } : e));
    expect(kindBoard(list).me).toBeNull();
  });

  it("keeps shared places together (1, 1, 3) without growing without end", () => {
    const tied = [row(1, "A"), row(1, "B"), row(3, "C"), row(3, "D"), row(5, "E")];
    expect(kindBoard(tied).entries.map((e) => e.displayName)).toEqual(["A", "B", "C", "D"]);
  });

  it("works after the group privacy rule: a member of a private group still sees only themselves", () => {
    const ranking = { ranked: ten.map((e) => (e.rank === 6 ? { ...e, mine: true } : e)), unranked: [{ displayName: "U", mine: false }] };
    const seen = rankingFor(ranking, false);
    const b = kindBoard(seen.ranked);
    expect(b.entries).toEqual([]);
    expect(b.me?.displayName).toBe("P6");
  });
});

describe("المجتمع · «أهل الثبات» rewards showing up, not doing the most", () => {
  it("looks at the last seven days, today included", () => {
    expect(windowDays("2026-11-26")).toEqual(["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26"]);
    expect(windowDays("2026-03-01", 3)).toEqual(["2026-02-27", "2026-02-28", "2026-03-01"]);
  });

  it("counts each day once, however much was done on it, and ignores zeros and older days", () => {
    const logs = {
      h1: { "2026-11-26": 5, "2026-11-25": 1, "2026-11-10": 9 },
      h2: { "2026-11-26": 30, "2026-11-24": 0 },
      "c:x": { "2026-11-23": 1 },
    };
    expect(presentDays(logs, "2026-11-26")).toBe(3);
    expect(presentDays(logs, "2026-11-26", ["2026-11-22", "2026-11-23"])).toBe(4);
  });

  it("five days of seven earn it (two days of excuse, like the habits)", () => {
    expect(isSteady(5)).toBe(true);
    expect(isSteady(7)).toBe(true);
    expect(isSteady(4)).toBe(false);
  });

  it("lists only who earned it, and in a private group only myself", () => {
    const rows = [
      { displayName: "A", username: "a", avatarUrl: null, days: 7, mine: false },
      { displayName: "B", username: "b", avatarUrl: null, days: 2, mine: false },
      { displayName: "Me", username: "me", avatarUrl: null, days: 5, mine: true },
    ];
    expect(steadyFor(rows, true).map((r) => r.displayName)).toEqual(["A", "Me"]);
    expect(steadyFor(rows, false).map((r) => r.displayName)).toEqual(["Me"]);
    expect(JSON.stringify(steadyFor(rows, true))).not.toContain('"B"');
  });
});

describe("المجتمع · «ذكّرته بلطف» once a day", () => {
  it("never to myself, only to an active member, once a day", () => {
    const base = { me: "u1", target: "u2", targetActive: true, sentToday: new Set<string>() };
    expect(nudgeBlock(base)).toBeNull();
    expect(nudgeBlock({ ...base, target: "u1" })).toBe("self");
    expect(nudgeBlock({ ...base, targetActive: false })).toBe("notMember");
    expect(nudgeBlock({ ...base, sentToday: new Set(["u2"]) })).toBe("already");
  });

  it("knows when the table of SQL 0135 is not there yet, and the screen works before it runs", () => {
    expect(nudgesMissing({ code: "42P01" })).toBe(true);
    expect(nudgesMissing({ code: "PGRST205", message: "Could not find the table 'public.mahdi_group_nudges'" })).toBe(true);
    expect(nudgesMissing({ code: "23505" })).toBe(false);
    expect(nudgesMissing(null)).toBe(false);
    const sql = read("supabase/migrations/0135_mahdi_group_nudges.sql");
    expect(sql).toContain("create table if not exists public.mahdi_group_nudges");
    expect(sql).toContain("primary key (from_id, to_id, nudge_date)");
    expect(sql).toContain("enable row level security");
    const route = read("src/app/api/mahdi/groups/[id]/route.ts");
    expect(route).toContain("nudgesMissing");
    expect(route).toContain('case "nudge"');
  });
});

describe("المجتمع · a small deletion has «تراجع»", () => {
  afterEach(() => vi.useRealTimers());

  it("deletes only when the undo time runs out", async () => {
    vi.useFakeTimers();
    const run = vi.fn(() => Promise.resolve());
    const restore = vi.fn();
    deferDelete({ ms: 6000, run, restore });
    vi.advanceTimersByTime(5999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(restore).not.toHaveBeenCalled();
  });

  it("«تراجع» sends nothing and brings it back", () => {
    vi.useFakeTimers();
    const run = vi.fn(() => Promise.resolve());
    const restore = vi.fn();
    const p = deferDelete({ ms: 6000, run, restore });
    p.undo();
    vi.advanceTimersByTime(10_000);
    expect(run).not.toHaveBeenCalled();
    expect(restore).toHaveBeenCalledTimes(1);
    p.flush();
    expect(run).not.toHaveBeenCalled();
  });

  it("brings it back with the error when the deletion fails", async () => {
    vi.useFakeTimers();
    const err = new Error("x");
    const restore = vi.fn();
    const p = deferDelete({ ms: 6000, run: () => Promise.reject(err), restore });
    p.flush();
    await Promise.resolve();
    await Promise.resolve();
    expect(restore).toHaveBeenCalledWith(err);
  });

  it("the comment and the story use it; a group is deleted from a confirm sheet", () => {
    expect(read("src/components/mahdi/social/CommentsSheet.tsx")).toContain("deferDelete(");
    expect(read("src/components/mahdi/social/Stories.tsx")).toContain("deferDelete(");
    const group = read("src/app/mahdi/(app)/groups/[id]/page.tsx");
    expect(group).toContain("<ConfirmSheet");
    expect(group).toContain('kind: "delete"');
  });
});

describe("المجتمع · one clear page", () => {
  it("two tabs (المتابَعون · استكشف); «منشور جديد» lives only in the top bar «+»", () => {
    const page = read("src/app/mahdi/(app)/community/page.tsx");
    expect(page).toContain('["feed", "explore"]');
    expect(page).not.toContain("/mahdi/post/new");
    expect(page).not.toContain("LeaderboardTab");
    expect(read("src/components/mahdi/AppShell.tsx")).toContain("/mahdi/post/new");
    expect(read("src/app/mahdi/(app)/more/page.tsx")).toContain("/mahdi/u/");
  });

  it("the post card is solid and calm, and the stories ring wears the achievement yellow", () => {
    const card = read("src/components/mahdi/social/PostCard.tsx");
    expect(card).not.toMatch(/backdrop|blur\(/);
    expect(card).not.toMatch(/#[0-9a-f]{6}/i);
    expect(read("src/components/mahdi/social/Stories.tsx")).toContain("var(--m-gold)");
  });

  it("story backgrounds are light now", () => {
    const social = read("src/lib/mahdi/social.ts");
    const block = social.slice(social.indexOf("export const STORY_BACKGROUNDS"), social.indexOf("} as const;", social.indexOf("export const STORY_BACKGROUNDS")));
    for (const dark of ["#14110c", "#0b0e18", "#0a1510", "#150b0f"]) expect(block).not.toContain(dark);
  });
});
