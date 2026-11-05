import { describe, expect, it } from "vitest";
import { readChoice } from "@/lib/film/director";

// Every request from the generation page also carries «model» = the chosen Claude. It used to overwrite the video model
// picked on the page, so Wan 3.0 and «Seedance وجه واقعي» were made with Seedance 2.5.
describe("the video model picked on the generation page is the one used", () => {
  const base = { resolution: "480p" as const };

  it("Wan 3.0 and «Seedance وجه واقعي» survive the Claude model riding along", () => {
    expect(readChoice({ ...base, videoModel: "wan-3.0", model: "claude-opus-5-5" }).model).toBe("wan-3.0");
    expect(readChoice({ ...base, videoModel: "seedance-real-face", model: "claude-sonnet-5-5" }).model).toBe("seedance-real-face");
    expect(readChoice({ ...base, videoModel: "seedance-2.0", model: "claude-opus-5-5" }).model).toBe("seedance-2.0");
  });

  it("a Claude model name is never taken for a video model (no choice: the director's plan)", () => {
    expect(readChoice({ ...base, model: "claude-opus-5-5" }).model).toBeUndefined();
  });

  it("an older page that sends the video model as «model» still works", () => {
    expect(readChoice({ ...base, model: "wan-3.0" }).model).toBe("wan-3.0");
  });
});
