import { describe, expect, it } from "vitest";
import { managedJson } from "@/lib/managed-agent";

describe("managedJson", () => {
  it("reads a plain JSON object", () => {
    expect(managedJson<{ ok: boolean }>('{"ok":true}')).toEqual({ ok: true });
  });

  it("reads JSON fenced in Markdown", () => {
    expect(managedJson<{ reply: string }>('تم\n```json\n{"reply":"واضح"}\n```')).toEqual({ reply: "واضح" });
  });
});
