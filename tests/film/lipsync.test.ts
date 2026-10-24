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
  it("was removed from the film maker (the owner's order): no button, the action refused, takes hidden; old jobs still closed", () => {
    const dir = read("src/lib/film/director.ts");
    expect(dir).toContain('case "lipsync"');
    expect(dir).toContain("مطابقة الشفايف انشالت");
    expect(dir).not.toContain("startLipsync(");
    // a lip-sync already running is still finished or given up
    expect(dir).toContain("checkLipsyncs(project)");
    expect(read("src/app/film/[id]/videos/VideosWorkspace.tsx")).not.toContain("طابق الشفايف");
    expect(read("src/app/film/_views/Videos.tsx")).toContain("!v.meta?.lipsync");
    expect(read("config/jawad/knowledge.ts")).not.toContain("طابق الشفايف على الصوت");
  });
});

describe("the film maker's voices are ElevenLabs only", () => {
  it("no MiniMax or «صوت الجواد» voice is offered, cast or spoken", () => {
    const v = read("src/lib/film/voices.ts");
    expect(v).not.toMatch(/minimaxSpeech|jawadSpeak|MINIMAX_READY_VOICES/);
    expect(v).toContain('ok.provider !== "elevenlabs"');
    expect(v).toContain('resolved.provider !== "elevenlabs"');
    expect(read("src/app/film/VoiceDesigner.tsx")).not.toMatch(/minimax|MiniMax/);
    expect(read("src/app/film/[id]/voices/VoicesWorkspace.tsx")).not.toMatch(/MiniMax/);
    expect(read("src/app/film/[id]/videos/VideosWorkspace.tsx")).not.toMatch(/MiniMax/);
  });
});
