import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { voiceTags } from "@/components/jawad/studio/PromptHelpers";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";

// «الخيارات حقت ليفل لابس [sad]… رجعهم»: the ElevenLabs tags under the spoken text in the studio.
describe("the voice's own tags in «صناعة الصوت»", () => {
  it("ElevenLabs has the full set between [ ], with the feelings and the sounds", () => {
    const t = voiceTags("elevenlabs-eleven-v4")!;
    expect([t.open, t.close]).toEqual(["[", "]"]);
    const all = t.list.flatMap((g) => g.tags.map(([v]) => v));
    for (const v of ["sad", "angry", "fearful", "cheerful", "calm", "excited", "whispers", "shouts", "laughs", "crying", "sighs"]) expect(all).toContain(v);
  });
  it("MiniMax has its sounds between ( ); engines without tags get none", () => {
    expect(voiceTags("minimax-speech-2-8")?.open).toBe("(");
    expect(voiceTags("openai-gpt-4o-mini-tts")).toBeNull();
    expect(voiceTags("elevenlabs-sfx-v2")).toBeNull();
    expect(voiceTags(undefined)).toBeNull();
  });
  it("the studio passes the generator, and Claude knows the tags", () => {
    expect(readFileSync(new URL("../../src/components/jawad/studio/Studio.tsx", import.meta.url), "utf8")).toContain("generatorId={def.id}");
    expect(JAWAD_KNOWLEDGE).toContain("حزين [sad]");
  });
});
