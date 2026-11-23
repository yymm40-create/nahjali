import { describe, expect, it } from "vitest";
import { isYoutubeLink, storyFromLink, storyFromPdf, storyFromUpload, storyLink, storyPdf, storyUpload, STORY_LINK_HEAD, STORY_PDF_HEAD } from "@/lib/film/story-link";

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

describe("«📤 ارفع فيديو» story", () => {
  const video = { name: "مقطعي.mp4", videoId: "11111111-2222-3333-4444-555555555555", sheetId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" };
  it("round-trips the uploaded video, its frame sheet and the note", () => {
    const story = storyFromUpload(video, "خذ الفكرة وغيّر المكان");
    expect(storyUpload(story)).toEqual({ video, note: "خذ الفكرة وغيّر المكان" });
    expect(storyLink(story)).toBeNull();
  });
  it("keeps the way chosen before the video is up, and works without a sheet", () => {
    expect(storyUpload(storyFromUpload(null, ""))).toEqual({ video: null, note: "" });
    expect(storyUpload(storyFromUpload({ ...video, sheetId: null }, ""))?.video).toEqual({ ...video, sheetId: null });
    expect(storyUpload("قصتي")).toBeNull();
  });
});

describe("«📄 ملف PDF» story (the lesson path)", () => {
  const pdf = { name: "درس القلب.pdf", fileId: "0b8c1f7e-1234-4abc-9def-0123456789ab" };
  it("keeps the file and the teacher's note in the story text", () => {
    const story = storyFromPdf(pdf, "  للصف الرابع، ركّز على الصمامات ");
    expect(story.startsWith(STORY_PDF_HEAD)).toBe(true);
    expect(storyPdf(story)).toEqual({ pdf, note: "للصف الرابع، ركّز على الصمامات" });
  });
  it("a chosen way with no file yet stays a PDF story, and other stories are not", () => {
    expect(storyPdf(storyFromPdf(null, ""))).toEqual({ pdf: null, note: "" });
    expect(storyPdf(storyFromPdf({ ...pdf, name: "a[b]\nc" }, ""))?.pdf?.fileId).toBe(pdf.fileId);
    expect(storyPdf("درس عن القلب")).toBeNull();
    expect(storyPdf(storyFromUpload(null, ""))).toBeNull();
  });
});
