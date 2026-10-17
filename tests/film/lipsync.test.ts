import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LIPSYNC_ENDPOINT, LIPSYNC_OP, lipsyncUsd } from "@/lib/film/lipsync";
import { OPERATION_STAGE } from "@/lib/film/team";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("«👄 طابق الشفايف على الصوت»", () => {
  it("sends the same take with its dialogue to Sync Lipsync, cut to the audio (never stretched)", () => {
    expect(LIPSYNC_ENDPOINT).toBe("fal-ai/sync-lipsync/v2");
    const src = read("src/lib/film/lipsync.ts");
    expect(src).toContain('sync_mode: "cut_off"');
    expect(src).toContain('model: pro ? "lipsync-2-pro" : "lipsync-2"');
    expect(src).toContain("lipsync: { from: take.id");
  });
  it("is priced by the second, pro about 1.67×, and belongs to the director's step", () => {
    expect(lipsyncUsd(60, false)).toBeCloseTo(3);
    expect(lipsyncUsd(60, true)).toBeCloseTo(5);
    expect(lipsyncUsd(12, false)).toBeCloseTo(0.6);
    expect(OPERATION_STAGE[LIPSYNC_OP]).toBe("director");
  });
  it("is wired: the action, the polling, the button, the migration, the knowledge", () => {
    const dir = read("src/lib/film/director.ts");
    expect(dir).toContain('case "lipsync"');
    expect(dir).toContain("checkLipsyncs(project)");
    expect(read("src/app/film/[id]/videos/VideosWorkspace.tsx")).toContain("👄 طابق الشفايف على الصوت");
    expect(read("supabase/migrations/0075_film_lipsync.sql")).toContain("'lipsync'");
    expect(read("config/jawad/knowledge.ts")).toContain("طابق الشفايف على الصوت");
  });
});
