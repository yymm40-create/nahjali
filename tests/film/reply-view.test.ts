import { describe, expect, it } from "vitest";
import { splitReply } from "@/app/film/ReplyView";
import { arrivalOf } from "@/app/film/stage/ReplyAlert";
import type { Progress, Running } from "@/lib/film/progress-math";

describe("a reply cut into sections", () => {
  it("keeps the words before the first heading, and marks what asks the person", () => {
    const r = splitReply("مقدمة قصيرة\n\n## الشخصيات\n- علي\n\n**الأماكن:**\nالسوق\n\n## نقاط تحتاج توضيح منك\n- النهاية؟\n```\n## ليس عنوانًا\n```");
    expect(r.intro).toBe("مقدمة قصيرة");
    expect(r.sections.map((s) => s.title)).toEqual(["الشخصيات", "الأماكن:", "نقاط تحتاج توضيح منك"]);
    expect(r.sections.map((s) => s.ask)).toEqual([false, false, true]);
    expect(r.sections[2].body).toContain("## ليس عنوانًا");
  });
});

describe("«🔔 وصل رد جديد»", () => {
  const run = (key: string, kind: Running["kind"], label: string): Running => ({ key, kind, label, startedAt: "", percent: 50, etaSec: 10 });
  const next = (asking: string[]): Progress => ({ percent: 40, asking, stage: "screenwriter", steps: {}, running: [], at: "" });
  const href = (k: string) => `/film/p/${k}`;
  it("says who answered and takes the person to the step waiting for them", () => {
    expect(arrivalOf([run("a", "reply", "السيناريست")], next(["script"]), href)).toEqual({ text: "🔔 وصل رد جديد من السيناريست — ينتظر ردّك", href: "/film/p/script" });
  });
  it("a finished video says so; a picture alone does not ring", () => {
    expect(arrivalOf([run("v", "video", "فيديو GEN-01")], next([]), href)?.text).toBe("🎬 جهز فيديو GEN-01");
    expect(arrivalOf([run("i", "image", "صورة CH-01")], next([]), href)).toBeNull();
  });
});
