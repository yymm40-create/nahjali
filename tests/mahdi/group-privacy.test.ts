import { describe, expect, it } from "vitest";
import { cleanVisibility, rankingFor, seesEveryone, visibilityMissing, workFor } from "@/lib/mahdi/groups/privacy";
import type { Seat } from "@/lib/mahdi/groups/program";

const seat = (role: Seat["role"], perms: Seat["perms"] = []) => ({ role, perms });

describe("إخوة الولاية · who sees each member's progress", () => {
  it("an open group (the default, and every group before SQL 0129) shows everyone to everyone", () => {
    expect(cleanVisibility(undefined)).toBe("all");
    expect(cleanVisibility("nonsense")).toBe("all");
    expect(cleanVisibility("leaders")).toBe("leaders");
    expect(seesEveryone(seat("member"), "all")).toBe(true);
  });

  it("a private group shows everyone only to the leader and admins holding «الإحصائيات»", () => {
    expect(seesEveryone(seat("leader"), "leaders")).toBe(true);
    expect(seesEveryone(seat("admin", ["stats"]), "leaders")).toBe(true);
    expect(seesEveryone(seat("admin", ["program", "members"]), "leaders")).toBe(false);
    expect(seesEveryone(seat("member"), "leaders")).toBe(false);
  });

  it("a member of a private group gets only their own row of the ranking, with their own place", () => {
    const ranking = {
      ranked: [
        { rank: 1, displayName: "A", mine: false, score: 0.9 },
        { rank: 2, displayName: "Me", mine: true, score: 0.7 },
        { rank: 3, displayName: "C", mine: false, score: 0.5 },
      ],
      unranked: [{ displayName: "D", mine: false }],
      min: 3,
    };
    const mine = rankingFor(ranking, false);
    expect(mine.onlyMine).toBe(true);
    expect(mine.ranked).toEqual([{ rank: 2, displayName: "Me", mine: true, score: 0.7 }]);
    expect(mine.unranked).toEqual([]);
    expect(JSON.stringify(mine)).not.toMatch(/"A"|"C"|"D"/);
    const all = rankingFor(ranking, true);
    expect(all.onlyMine).toBe(false);
    expect(all.ranked).toHaveLength(3);
    expect(all.unranked).toHaveLength(1);
  });

  it("a shared work: own tick always, counts only when open or a leader, names only for «الإحصائيات»", () => {
    const work = { id: "w", title: "t", details: "", cadence: "daily" as const, dueDate: null };
    const names = { A: "أحمد", B: "باقر", M: "أنا" } as Record<string, string>;
    const nameOf = (id: string) => names[id] ?? "";
    // B left the group: their old tick no longer counts
    const doneBy = ["A", "M", "X"];
    const active = ["A", "B", "M"];
    const member = workFor(work, doneBy, active, "M", { full: false, names: false, nameOf });
    expect(member.mineDone).toBe(true);
    expect(member.doneCount).toBeNull();
    expect(member.memberCount).toBeNull();
    expect(member.doneBy).toBeUndefined();
    const open = workFor(work, doneBy, active, "B", { full: true, names: false, nameOf });
    expect(open).toMatchObject({ mineDone: false, doneCount: 2, memberCount: 3 });
    expect(open.doneBy).toBeUndefined();
    const leader = workFor(work, doneBy, active, "L", { full: true, names: true, nameOf });
    expect(leader.doneBy).toEqual(["أحمد", "أنا"]);
  });

  it("knows when the column of SQL 0129 is not there yet", () => {
    expect(visibilityMissing({ code: "42703", message: "column mahdi_groups.progress_visibility does not exist" })).toBe(true);
    expect(visibilityMissing({ code: "PGRST204", message: "Could not find the 'progress_visibility' column of 'mahdi_groups' in the schema cache" })).toBe(true);
    expect(visibilityMissing({ code: "", message: "column mahdi_groups.progress_visibility does not exist" })).toBe(true);
    expect(visibilityMissing({ code: "23514", message: 'new row violates check constraint "mahdi_groups_progress_visibility_check"' })).toBe(false);
    expect(visibilityMissing(null)).toBe(false);
  });
});
