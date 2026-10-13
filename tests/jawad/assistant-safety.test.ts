import { describe, expect, it } from "vitest";
import { ASSISTANT_SCHEMA, assistantSystem, checkAnswer, type AssistantDraft } from "@config/jawad/assistant";
import { CHAT_GUIDANCE } from "@config/jawad/chat-guidance";
import { GENERATORS } from "@config/jawad/generators";

const audio = GENERATORS.filter((generator) => generator.output === "audio");
const draft: AssistantDraft = {
  generatorId: audio[0].id,
  prompt: "",
  instructions: "",
  settings: {},
  refStyle: "none",
  refs: [],
};

describe("Jawad conversation safety", () => {
  it("guides a beginner without guessing or skipping review", () => {
    expect(CHAT_GUIDANCE).toContain("Ask ONE blocking question at a time");
    expect(CHAT_GUIDANCE).toContain("Never guess exact wording");
    expect(CHAT_GUIDANCE).toContain("Before a generation or destructive change");
  });

  it("knows audio generation and can add an uploaded audio reference", () => {
    const system = assistantSystem("audio", audio);
    expect(system).toContain("Sound effects");
    expect(system).toContain("Music");
    const answer = checkAnswer(
      { reply: "جهزت المرجع", addRefs: [{ source: "attachment", id: "1", name: "music_ref", role: "reference" }] },
      { defs: audio, draft, attachments: 1 },
    );
    expect(answer.set.addRefs).toEqual([{ attachment: 1, name: "music_ref", role: "reference" }]);
  });

  it("keeps the structured answer fields required", () => {
    expect(ASSISTANT_SCHEMA.required).toContain("reply");
    expect(ASSISTANT_SCHEMA.required).toContain("addRefs");
    expect(ASSISTANT_SCHEMA.required).toContain("quick");
  });
});
