// «الختمة العلوية» end to end on a small in-memory stand-in for the database (only what these functions use), with the
// same unique keys as migration 0080: one reader per portion, one khatma per number per group.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeDb, type Row } from "./fake-db";
import { claimPortion, extendKhatma, khatmaView, markPortion, nextKhatma, releaseReader, saveSettings, stopKhatma, dedicate, freePortion } from "@/lib/mahdi/server/khatma";

const G = "group-1";
const MEMBERS = ["leader", "ali", "hasan"];
const S = { division: "juz" as const, weeks: 1, endDow: 4, endHour: 21, timeZone: "Asia/Riyadh", noRepeat: 2, active: true };

describe("«الختمة العلوية» on the server", () => {
  let db: SupabaseClient;
  let tables: Record<string, Row[]>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T07:00:00Z")); // Monday 10:00 Riyadh
    ({ db, tables } = fakeDb());
  });
  afterEach(() => vi.useRealTimers());
  const view = (me: string) => khatmaView(db, G, me, me === "leader", MEMBERS);

  it("not set up: nothing to show, then the leader starts it and it ends on the chosen night", async () => {
    expect(await view("ali")).toMatchObject({ ready: true, settings: null, khatma: null });
    await saveSettings(db, G, "leader", MEMBERS, S);
    const v = await view("ali");
    expect(v.khatma).toMatchObject({ number: 1, division: "juz", status: "open", total: 30, done: 0, overdue: false });
    expect(v.khatma!.endsAt).toBe("2026-10-22T18:00:00.000Z");
    expect(v.portions).toHaveLength(30);
    expect(v.portions!.every((s) => s === "free")).toBe(true);
  });

  it("one reader per portion: taken = hidden from the others; a second tap on it is refused", async () => {
    await saveSettings(db, G, "leader", MEMBERS, S);
    await claimPortion(db, G, "ali", MEMBERS, 5);
    await expect(claimPortion(db, G, "hasan", MEMBERS, 5)).rejects.toThrow(/سبقك/);
    expect((await view("ali")).portions![4]).toBe("reading");
    expect((await view("hasan")).portions![4]).toBe("taken");
    await markPortion(db, G, "ali", MEMBERS, 5, "done");
    expect((await view("ali")).portions![4]).toBe("done");
    // only my own portion can be marked
    await expect(markPortion(db, G, "hasan", MEMBERS, 5, "release")).rejects.toThrow();
    await expect(claimPortion(db, G, "ali", MEMBERS, 31)).rejects.toThrow();
  });

  it("the leader sees who reads what and can free a portion being read; leaving frees mine too", async () => {
    await saveSettings(db, G, "leader", MEMBERS, S);
    await claimPortion(db, G, "ali", MEMBERS, 1);
    await claimPortion(db, G, "hasan", MEMBERS, 2);
    expect((await view("leader")).readers!.map((r) => r.portion)).toEqual([1, 2]);
    expect((await view("ali")).readers).toBeUndefined();
    await freePortion(db, G, MEMBERS, 1);
    expect((await view("hasan")).portions![0]).toBe("free");
    await releaseReader(db, G, "hasan");
    expect((await view("ali")).portions![1]).toBe("free");
    // someone no longer in the group: what they were holding goes back by itself
    await claimPortion(db, G, "ali", MEMBERS, 3);
    expect((await khatmaView(db, G, "hasan", false, ["leader", "hasan"])).portions![2]).toBe("free");
  });

  it("a reader backs out of a portion (read or not), and the leader takes a reader off one; either way someone else takes it", async () => {
    await saveSettings(db, G, "leader", MEMBERS, S);
    await claimPortion(db, G, "ali", MEMBERS, 4);
    await markPortion(db, G, "ali", MEMBERS, 4, "done");
    // ali backs out even after marking it read
    await markPortion(db, G, "ali", MEMBERS, 4, "release");
    expect((await view("hasan")).portions![3]).toBe("free");
    await claimPortion(db, G, "hasan", MEMBERS, 4);
    // only the one reading it can back out
    await expect(markPortion(db, G, "ali", MEMBERS, 4, "release")).rejects.toThrow();
    expect((await view("hasan")).portions![3]).toBe("reading");
    // the leader takes hasan off it (read or not), and ali takes it
    await markPortion(db, G, "hasan", MEMBERS, 4, "done");
    await freePortion(db, G, MEMBERS, 4);
    expect((await view("ali")).portions![3]).toBe("free");
    await expect(freePortion(db, G, MEMBERS, 4)).rejects.toThrow();
    await claimPortion(db, G, "ali", MEMBERS, 4);
    expect((await view("leader")).readers).toMatchObject([{ portion: 4, status: "reading" }]);
  });

  it("every portion read → the khatma is done; the next starts after its night with the same dedication", async () => {
    await saveSettings(db, G, "leader", MEMBERS, S);
    await dedicate(db, G, "صاحب العصر والزمان عجل الله فرجه", "المرحوم الحاج علي");
    for (let n = 1; n <= 30; n++) {
      const who = n <= 3 ? "ali" : "hasan";
      await claimPortion(db, G, who, MEMBERS, n);
      await markPortion(db, G, who, MEMBERS, n, "done");
    }
    let v = await view("ali");
    expect(v.khatma).toMatchObject({ number: 1, status: "done", done: 30 });
    await expect(claimPortion(db, G, "leader", MEMBERS, 1)).rejects.toThrow();
    // Thursday night passes
    vi.setSystemTime(new Date("2026-10-22T18:00:01Z"));
    v = await view("ali");
    expect(v.khatma).toMatchObject({ number: 2, status: "open", dedicatedTo: "صاحب العصر والزمان عجل الله فرجه", forSoulOf: "المرحوم الحاج علي" });
    expect(v.khatma!.startsAt).toBe("2026-10-22T18:00:00.000Z");
    expect(v.khatma!.endsAt).toBe("2026-10-29T18:00:00.000Z");
    expect(v.history![0]).toMatchObject({ number: 1, status: "done", done: 30, total: 30 });
    // what ali read last time is grey for him (juz 1–3), free for hasan
    expect(v.portions!.slice(0, 4)).toEqual(["blocked", "blocked", "blocked", "free"]);
    await expect(claimPortion(db, G, "ali", MEMBERS, 2)).rejects.toThrow(/قرأت هذا النصيب/);
    expect((await view("hasan")).portions!.slice(0, 4)).toEqual(["free", "free", "free", "blocked"]);
    await claimPortion(db, G, "hasan", MEMBERS, 1);
  });

  it("the lock lasts for the number of khatmas the leader chose, then opens again", async () => {
    await saveSettings(db, G, "leader", MEMBERS, { ...S, noRepeat: 1, division: "hizb" });
    await claimPortion(db, G, "ali", MEMBERS, 7);
    await markPortion(db, G, "ali", MEMBERS, 7, "done");
    for (const end of ["2026-10-22T18:00:01Z", "2026-10-29T18:00:01Z"]) {
      vi.setSystemTime(new Date(end));
      await nextKhatma(db, G, MEMBERS); // past its night: the leader closes it and the next starts
    }
    // khatma 2 (the one right after) locked hizb 7; khatma 3 is two khatmas on, with a count of 1 it is free again
    const v = await view("ali");
    expect(v.khatma!.number).toBe(3);
    expect(v.portions![6]).toBe("free");
    expect(v.history!.map((h) => h.status)).toEqual(["closed", "closed"]);
  });

  it("past its night and unfinished: it waits for the leader, who extends it or closes it", async () => {
    await saveSettings(db, G, "leader", MEMBERS, S);
    await claimPortion(db, G, "ali", MEMBERS, 1);
    await expect(nextKhatma(db, G, MEMBERS)).rejects.toThrow(/في وقتها/);
    vi.setSystemTime(new Date("2026-10-23T08:00:00Z"));
    let v = await view("ali");
    expect(v.khatma).toMatchObject({ number: 1, status: "open", overdue: true });
    // readers may still go on
    await markPortion(db, G, "ali", MEMBERS, 1, "done");
    await extendKhatma(db, G, MEMBERS, 2);
    v = await view("ali");
    expect(v.khatma).toMatchObject({ overdue: false, endsAt: "2026-10-25T08:00:00.000Z" });
    vi.setSystemTime(new Date("2026-10-26T08:00:00Z"));
    await nextKhatma(db, G, MEMBERS);
    v = await view("ali");
    // the next one keeps the weekly night
    expect(v.khatma).toMatchObject({ number: 2, status: "open", endsAt: "2026-10-29T18:00:00.000Z" });
    expect(v.history![0]).toMatchObject({ number: 1, status: "closed", done: 1, total: 30 });
  });

  it("a new cut applies now only while nobody took a portion; stopping closes it until set up again", async () => {
    await saveSettings(db, G, "leader", MEMBERS, S);
    await saveSettings(db, G, "leader", MEMBERS, { ...S, division: "quarter" });
    expect((await view("ali")).khatma).toMatchObject({ division: "quarter", total: 240 });
    await claimPortion(db, G, "ali", MEMBERS, 240);
    await saveSettings(db, G, "leader", MEMBERS, { ...S, division: "hizb" });
    expect((await view("ali")).khatma).toMatchObject({ division: "quarter", total: 240 });
    expect(tables.mahdi_khatma_settings[0].division).toBe("hizb");
    await stopKhatma(db, G);
    let v = await view("ali");
    expect(v.settings!.active).toBe(false);
    expect(v.khatma!.status).toBe("closed");
    await expect(claimPortion(db, G, "ali", MEMBERS, 1)).rejects.toThrow();
    await saveSettings(db, G, "leader", MEMBERS, { ...S, division: "hizb" });
    v = await view("ali");
    expect(v.khatma).toMatchObject({ number: 2, status: "open", division: "hizb", total: 60 });
  });
});
