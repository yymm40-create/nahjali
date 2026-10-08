import { describe, expect, it } from "vitest";
import { minimaxFeeling } from "@config/jawad/feelings";

describe("a line's feeling, the MiniMax way", () => {
  it("sends one of its emotions as is", () => {
    expect(minimaxFeeling("sad", "وين رحت؟")).toEqual({ emotion: "sad", text: "وين رحت؟" });
  });
  it("writes a sound into the line", () => {
    expect(minimaxFeeling("(laughs)", "صدقت")).toEqual({ text: "(laughs) صدقت" });
  });
  it("maps ElevenLabs' words, and drops what MiniMax can't say", () => {
    expect(minimaxFeeling("excited", "يلا")).toEqual({ emotion: "happy", text: "يلا" });
    expect(minimaxFeeling("crying", "ليش")).toEqual({ emotion: "sad", text: "(sniffs) ليش" });
    expect(minimaxFeeling("whispers", "[whispers] اسكت")).toEqual({ text: "اسكت" });
  });
});
