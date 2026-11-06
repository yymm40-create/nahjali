import { describe, expect, it } from "vitest";
import { isContinue, madePictures } from "@/lib/content/chat";
import type { Turn } from "@/lib/content/chats";

describe("«كمّل» and the pictures already made", () => {
  it("reads «كمّل» alone as going on, and nothing longer", () => {
    for (const t of ["كمل", "كمّل", "يلا كمل", "كمّل الرسم", "أكمل!", "استمر", "continue"]) expect(isContinue(t), t).toBe(true);
    for (const t of ["كمل بس غيّر اللون", "كملت؟", "ابي كاروسيل جديد", ""]) expect(isContinue(t), t).toBe(false);
  });
  it("the pictures جواد made are references for the next picture of the same character", () => {
    const turns = [
      { role: "assistant", text: "x", media: { items: [{ id: "a", kind: "image", name: "بطل", prompt: "p", aspect: "1:1", refs: [], state: "done", fileId: "11111111-1111-1111-1111-111111111111" }, { id: "b", kind: "image", name: "x", prompt: "p", aspect: "1:1", refs: [], state: "failed" }] } },
    ] as unknown as Turn[];
    expect(madePictures(turns)).toEqual(["11111111-1111-1111-1111-111111111111"]);
  });
});
