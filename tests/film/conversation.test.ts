import { describe, expect, it } from "vitest";
import { onlyLastCopy, stubSuperseded, SUPERSEDED_STUB } from "@/lib/film/conversation";

const reply = (o: Record<string, unknown>) => ({ role: "assistant" as const, content: JSON.stringify(o) });
const ask = (content: string) => ({ role: "user" as const, content });
const long = "مشهد ".repeat(400);

describe("a film stage re-reads only the latest full version of each deliverable", () => {
  it("an older version a revision replaced reads as a stub; short fields and the latest stay", () => {
    const msgs = [ask("القصة"), reply({ stage: 5, content: long, notes: "أول" }), ask("تعديل: أقصر"), reply({ stage: 5, content: `${long}!`, notes: "ثاني" })];
    const out = stubSuperseded(msgs);
    expect(JSON.parse(out[1].content)).toEqual({ stage: 5, content: SUPERSEDED_STUB, notes: "أول" });
    expect(out[3]).toBe(msgs[3]);
    expect(out[0]).toBe(msgs[0]);
  });
  it("keeps apart deliverables of other sheets / generations, short ones, and a reply right after «اعتمد»", () => {
    const sheets = [ask("ابدأ"), reply({ stage: 6, sheet_id: "CHR-01", content: long }), ask("التالي"), reply({ stage: 6, sheet_id: "CHR-02", content: long })];
    expect(stubSuperseded(sheets)).toEqual(sheets);
    const short = [ask("س"), reply({ stage: 3, content: "سؤال؟" }), ask("ج"), reply({ stage: 3, content: "سؤال آخر؟" })];
    expect(stubSuperseded(short)).toEqual(short);
    // the next deliverable labelled with the old stage after «اعتمد» is not a revision of the approved one
    const approved = [ask("القصة"), reply({ stage: 5, content: long }), ask("اعتمد"), reply({ stage: 5, content: long })];
    expect(stubSuperseded(approved)).toEqual(approved);
    // a reply that is not the stage's JSON is left alone
    const plain = [ask("x"), { role: "assistant" as const, content: long }];
    expect(stubSuperseded(plain)).toEqual(plain);
  });
  it("a long block sent more than once (the Super Director's skill) is read in its last copy only", () => {
    const skill = "SKILL ".repeat(50);
    const msgs = [ask(`اعتمد\n${skill}`), reply({ stage: 2, content: "x" }), ask(`فعّلت\n${skill}`)];
    const out = onlyLastCopy(msgs, skill, "(المهارة لاحقًا)");
    expect(out[0].content).toBe("اعتمد\n(المهارة لاحقًا)");
    expect(out[2]).toBe(msgs[2]);
  });
});
