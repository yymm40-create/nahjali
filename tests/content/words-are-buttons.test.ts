import { describe, expect, it } from "vitest";
import { readRetryAsk } from "@/lib/content/chat";
import { pageAction } from "@/components/jawad/content/ContentChat";

describe("every slide button can be written instead of pressed", () => {
  it("«أعد المحاولة» and «أعد الشريحة ٤» are the retry buttons", () => {
    expect(readRetryAsk("أعد المحاولة")).toBe("failed");
    expect(readRetryAsk("اعد محاولة الفاشلة")).toBe("failed");
    expect(readRetryAsk("أعد الشريحة ٤")).toEqual([4]);
    expect(readRetryAsk("عيد الشريحة 2 و 3")).toEqual([2, 3]);
    expect(readRetryAsk("اعد رسم الشريحة 5 من جديد")).toEqual([5]);
  });
  it("a retry that asks a change goes to him", () => {
    expect(readRetryAsk("عيد الشريحة 3 الصور صايرة فوق")).toBeNull();
    expect(readRetryAsk("أعد الشريحة 2 بلون أزرق")).toBeNull();
  });
  it("«حوّله ريل» and «حمّل الشرائح» are the page's buttons", () => {
    expect(pageAction("حوّله ريل")).toBe("reel");
    expect(pageAction("سوها ريل")).toBe("reel");
    expect(pageAction("ريل")).toBe("reel");
    expect(pageAction("حمل كل الشرائح")).toBe("download");
    expect(pageAction("نزل الشرائح")).toBe("download");
    expect(pageAction("ابي ريل بس غير الشريحة 2")).toBeNull();
    expect(pageAction("وش أفضل وقت أنزل فيه الريلز؟")).toBeNull();
  });
});

describe("talk about a reel is not the button", () => {
  it("leaves comments alone", () => {
    expect(pageAction("الريل حلو")).toBeNull();
    expect(pageAction("نزلها على انستا")).toBeNull();
  });
});
