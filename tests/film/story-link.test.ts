import { describe, expect, it } from "vitest";
import { isYoutubeLink, storyFromLink, storyLink, STORY_LINK_HEAD } from "@/lib/film/story-link";

describe("«🔗 رابط يوتيوب» story", () => {
  it("accepts YouTube video links only", () => {
    expect(isYoutubeLink("https://www.youtube.com/watch?v=OditLH30a64")).toBe(true);
    expect(isYoutubeLink("https://youtu.be/OditLH30a64?si=x")).toBe(true);
    expect(isYoutubeLink("https://youtube.com/shorts/OditLH30a64")).toBe(true);
    expect(isYoutubeLink("https://www.instagram.com/reel/DfCmSAYhNvd/")).toBe(false);
    expect(isYoutubeLink("https://www.youtube.com/@channel")).toBe(false);
  });

  it("round-trips the link and the note through the story text", () => {
    const story = storyFromLink(" https://youtu.be/OditLH30a64 ", " نفس القصة بستايل كرتوني\nوبدون كلام ");
    expect(story.startsWith(STORY_LINK_HEAD)).toBe(true);
    expect(storyLink(story)).toEqual({ url: "https://youtu.be/OditLH30a64", note: "نفس القصة بستايل كرتوني\nوبدون كلام" });
    expect(storyLink(storyFromLink("", ""))).toEqual({ url: "", note: "" });
    expect(storyLink("قصتي عن ولد وأبوه")).toBeNull();
  });
});
