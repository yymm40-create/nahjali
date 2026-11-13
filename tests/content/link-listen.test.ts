import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { keyOf, videoLinks } from "@/lib/link-listen";

// The owner, 5 Nov 2026: «لو حطيت له رابط يوتيوب يقدر يستخرج اللي فيه» — a video link in a message to «محمد باقر»
// or «حيدرا ماكس» is heard by ElevenLabs before the answer.

describe("video links", () => {
  it("finds YouTube and TikTok links, the same video once", () => {
    const t = "شف هذا https://www.youtube.com/watch?v=OditLH30a64&t=12s، وهذا https://youtu.be/OditLH30a64 وهذا https://youtube.com/shorts/abcDEF12345 و https://www.tiktok.com/@x/video/7312345678901234567.";
    expect(videoLinks(t)).toEqual([
      "https://www.youtube.com/watch?v=OditLH30a64&t=12s",
      "https://youtube.com/shorts/abcDEF12345",
      "https://www.tiktok.com/@x/video/7312345678901234567",
    ]);
  });

  it("names a video by its own id", () => {
    expect(keyOf("https://m.youtube.com/watch?v=OditLH30a64")).toBe("yt:OditLH30a64");
    expect(keyOf("https://www.youtube.com/live/OditLH30a64?si=x")).toBe("yt:OditLH30a64");
    expect(keyOf("https://www.instagram.com/p/De-A4PMEZRg/")).toBeNull();
    expect(keyOf("https://aljawadai.app/jawad-ai")).toBeNull();
  });

  it("rides with both robots' turns", () => {
    expect(readFileSync("src/lib/content/chat.ts", "utf8")).toContain("listenToLinks(said");
    expect(readFileSync("src/lib/editor/assistant.ts", "utf8")).toContain("listenToLinks(message");
  });
});
