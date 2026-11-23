import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import QuickReplies from "@/components/jawad/QuickReplies";
import { Answer, Gallery, Questions, SlidesBox, splitAnswer, stagesOf } from "@/components/jawad/content/ContentChat";
import { libraryOf } from "@/components/jawad/content/ContentLibrary";
import CarouselTable from "@/components/jawad/content/CarouselTable";

// What the page draws, server-rendered (no browser here): the buttons, the swatches, the galleries, the carousel while
// it is being drawn and after.
const noop = () => {};
const items = [
  { id: "scrapbook", group: "لمسة يدوية", name: "دفتر قصاصات", description: "d", bestFor: "b", image: "/x/scrapbook.png", palettes: [{ name: "ورق", bg: "#F1E4CC", text: "#3B2A20", primary: "#C0563B", accent: "#4F7C6D" }] },
  { id: "bold-type", group: "نظيف وراقٍ", name: "خط عريض", description: "d", bestFor: "b", image: null, palettes: [{ name: "أسود", bg: "#111111", text: "#FFFFFF", primary: "#FFD60A", accent: "#FF3B30" }] },
];

describe("clickable answers", () => {
  it("draw each option, colours as swatches, and always the way to write one's own", () => {
    const html = renderToStaticMarkup(h(QuickReplies, { cls: "ct", options: ["انستغرام", "كحلي وذهبي — #0B1F3A #D4AF37"], onPick: noop, onWrite: noop }));
    expect(html).toContain("انستغرام");
    expect(html).toContain("background:#0B1F3A");
    expect(html).toContain("background:#D4AF37");
    expect(html).toContain("اكتب إجابة مختلفة");
    expect(renderToStaticMarkup(h(QuickReplies, { cls: "ct", options: [], onPick: noop, onWrite: noop }))).toBe("");
  });
});

describe("his questions", () => {
  const gal = { templates: items, styles: [], motion: items, moods: items };
  it("a single plain question sends on a press, with the way to write", () => {
    const html = renderToStaticMarkup(h(Questions, { questions: [{ label: "التالي", kind: "choice", options: ["أنتج الآن", "أريد تعديلًا"], multi: false }], gal, disabled: false, onSend: noop, onWrite: noop }));
    expect(html).toContain("أنتج الآن");
    expect(html).toContain("اكتب إجابة مختلفة");
    expect(html).not.toContain("أرسل الإجابات");
  });
  it("a batch shows every question with its answers, the galleries, and the send and delegate buttons", () => {
    const html = renderToStaticMarkup(
      h(Questions, {
        questions: [
          { label: "المنصة", kind: "choice", options: ["انستغرام", "لينكدإن"], multi: false },
          { label: "الألوان", kind: "choice", options: ["كحلي وذهبي — #0B1F3A #D4AF37 #FFFFFF"], multi: true },
          { label: "القالب", kind: "templates", options: [], multi: false },
          { label: "الستايل", kind: "styles", options: [], multi: false },
          { label: "مهارة الموشن", kind: "motion", options: [], multi: false },
          { label: "مزاج الموشن", kind: "moods", options: [], multi: false },
        ],
        gal,
        disabled: false,
        onSend: noop,
        onWrite: noop,
      }),
    );
    for (const t of ["1) المنصة", "2) الألوان", "(يجوز أكثر من خيار)", "3) القالب", "4) الستايل", "افتح معرض القوالب", "افتح معرض الستايلات الكرتونية", "افتح معرض مهارات الموشن", "افتح معرض مشاعر الموشن", "5) مهارة الموشن", "6) مزاج الموشن", "أرسل الإجابات", "اختر أنت لكل ما لم أحدده", "غير ذلك", "background:#0B1F3A"]) expect(html).toContain(t);
  });
});

describe("the galleries", () => {
  it("show every item small, grouped, with «اختر», a way out, and a way to write", () => {
    const html = renderToStaticMarkup(h(Gallery, { kind: "templates", items, onPick: noop, onNone: noop, onWrite: noop }));
    for (const t of ["لمسة يدوية", "نظيف وراقٍ", "دفتر قصاصات", "خط عريض", "/x/scrapbook.png", "بدون قالب", "أكتب وصفي الخاص", "كبّر دفتر قصاصات"]) expect(html).toContain(t);
    // a template with no picture yet shows its palette
    expect(html).toContain("background:#111111");
    expect(renderToStaticMarkup(h(Gallery, { kind: "styles", items, onPick: noop, onNone: noop, onWrite: noop }))).toContain("بدون ستايل كرتوني");
  });
});

describe("the table of carousel styles", () => {
  const rows = [
    { id: "notebook", n: 1, niche: "تعليمي وشرح", name: "الدفتر", description: "صفحة دفتر", bestFor: "الشرح", winner: true, realistic: true, cover: "/c/01-cover.webp", slide: "/c/01-slide.webp" },
    { id: "white-text", n: 2, niche: "تعليمي وشرح", name: "الشريحة البيضاء", description: "أبيض", bestFor: "الأفكار", winner: false, realistic: false, cover: "/c/02-cover.webp", slide: "/c/02-slide.webp" },
    { id: "editorial", n: 7, niche: "تسويق وبزنس", name: "الإديتوريال", description: "مجلة", bestFor: "التسويق", winner: true, realistic: true, cover: "/c/07-cover.webp", slide: "/c/07-slide.webp" },
  ];
  const niches = ["تعليمي وشرح", "تسويق وبزنس"];
  const props = { items: rows, niches, onPick: noop, onHelp: noop, onOwn: noop };
  it("shows every style by niche with its two slides, what it is, and the ways out", () => {
    const html = renderToStaticMarkup(h(CarouselTable, props));
    for (const t of ["تعليمي وشرح", "تسويق وبزنس", "1. الدفتر", "2. الشريحة البيضاء", "7. الإديتوريال", "/c/01-cover.webp", "/c/01-slide.webp", "صفحة دفتر", "يناسب: الشرح", "الأقوى في مجاله", "فيه صور واقعية", "اختر", "ما أعرف أختار، ساعدني", "أبي شيئًا غير الموجود"]) expect(html).toContain(t);
    expect(html).not.toContain("ترشيحات محمد باقر");
  });
  it("shows his recommendations first when he made some", () => {
    const html = renderToStaticMarkup(h(CarouselTable, { ...props, recommended: ["editorial", "nope"] }));
    expect(html).toContain("ترشيحات محمد باقر لك");
    expect(html.indexOf("7. الإديتوريال")).toBeLessThan(html.indexOf("1. الدفتر"));
  });
  it("opens by itself when it is asked, in place of a button to find", () => {
    const gal = { templates: [], styles: [], carousels: rows, niches };
    const html = renderToStaticMarkup(h(Questions, { questions: [{ label: "اختر ستايل الكاروسيل", kind: "carousels", options: [], multi: false }], gal, disabled: false, onSend: noop, onWrite: noop }));
    expect(html).toContain("1. الدفتر");
    expect(html).toContain("أغلق جدول الستايلات");
  });
});

describe("the carousel", () => {
  const slide = (n: number, o: Record<string, unknown> = {}) => ({ n, fileId: `f${n}`, name: `slide-0${n}`, text: "t", url: `/s/${n}.png`, download: `/d/${n}.png`, ...o });
  const base = { aspect: "2:3", items: [], todo: [], failed: [], running: false, total: 0 };
  const props = { busy: false, owner: false, onRetry: noop, onDownloadAll: noop };

  it("while it is drawn: progress, a moving placeholder for each slide to come, the made ones with their picture", () => {
    const html = renderToStaticMarkup(h(SlidesBox, { ...props, s: { ...base, items: [slide(1)], todo: [2, 3], running: true, total: 3 } }));
    expect(html).toContain("جواد يولّد الشرائح بـ GPT Image 2… (1 من 3)");
    expect(html).toContain("لا تقفل الصفحة");
    expect(html).toContain("الشريحة 2 قيد الرسم");
    expect(html).toContain("الشريحة 3 قيد الرسم");
    expect(html).toContain("/s/1.png");
    expect(html).toContain("aspect-ratio:2 / 3");
    expect(html).not.toContain("حمّل كل الشرائح");
  });
  it("names who is making it in the third way", () => {
    const html = renderToStaticMarkup(h(SlidesBox, { ...props, s: { ...base, todo: [1], running: true, total: 1, maker: "code", mix: true } }));
    expect(html).toContain("GPT Image 2 يرسم الصور وحيدرا ماكس يكتب عليها");
  });
  it("after it: the check badges, the flagged slides, the failed ones with their reason and a retry, the report", () => {
    const html = renderToStaticMarkup(
      h(SlidesBox, {
        ...props,
        s: { ...base, items: [slide(1), slide(2, { fixed: true }), slide(3, { flag: "حرف مقطوع" })], failed: [{ n: 4, reason: "المزوّد مشغول حاليًا", text: "t", detail: "429 busy" }, { n: 5, reason: "رفض", text: "t" }], total: 5, report: "🔎 فحص ما بعد الرسم" },
      }),
    );
    for (const t of ["حمّل كل الشرائح (3)", "سليمة في الفحص الآلي", "أُعيد رسمها بعد أن وُجد فيها خطأ", "الشريحة 3: حرف مقطوع", "لم تُصنع 2 شرائح", "الشريحة 4: المزوّد مشغول حاليًا", "أعد المحاولة", "أعد محاولة كل الفاشلة", "🔎 فحص ما بعد الرسم", "أعد رسم هذه الشريحة"]) expect(html).toContain(t);
    // the technical reason is for the owner only
    expect(html).not.toContain("429 busy");
    expect(renderToStaticMarkup(h(SlidesBox, { ...props, owner: true, s: { ...base, failed: [{ n: 4, reason: "r", text: "t", detail: "429 busy" }] } }))).toContain("429 busy");
  });
});

describe("the project's stages, its answers and its library (the film maker's layout, 23 Nov 2026)", () => {
  const sl = (n: number, o: Record<string, unknown> = {}) => ({ n, fileId: `f${n}`, name: `slide-0${n}`, text: "t", url: `/s/${n}.png`, download: `/d/${n}.png`, ...o });
  const block = (o: Record<string, unknown> = {}) => ({ aspect: "4:5", items: [sl(1), sl(2)], todo: [], failed: [], running: false, total: 2, ...o });
  const ask = [{ label: "كم شريحة؟", kind: "choice" as const, options: ["٥"], multi: false }];
  const states = (r: ReturnType<typeof stagesOf>) => r.map((x) => `${x.key}:${x.state}${x.ask ? "!" : ""}`);

  it("a new carousel: the idea is open and waits for the answers, the rest locked", () => {
    expect(states(stagesOf([{ role: "assistant", text: "o", questions: ask, local: true }], "carousel"))).toEqual(["idea:open!", "design:locked", "delivery:locked"]);
  });
  it("one chat made: everything done", () => {
    expect(states(stagesOf([{ role: "user", text: "u" }, { role: "assistant", text: "a", slides: block() }], "carousel"))).toEqual(["idea:done", "design:done", "delivery:done"]);
  });
  it("two chats: pictures to approve pulse, then the writing and motion, then the delivery", () => {
    const waiting = stagesOf([{ role: "assistant", text: "a", slides: block({ phase: "approve" }) }, { role: "assistant", text: "b", thread: "design", handoff: true }], "motion-carousel");
    expect(states(waiting)).toEqual(["idea:done", "pictures:open!", "design:open", "delivery:locked"]);
    const made = stagesOf([{ role: "assistant", text: "a", slides: block({ approved: true }) }, { role: "assistant", text: "b", thread: "design", slides: block() }], "motion-carousel");
    expect(states(made)).toEqual(["idea:done", "pictures:done", "design:done", "delivery:done"]);
    expect(made.map((x) => x.label)).toEqual(["الفكرة والنصوص", "🖼️ الصور", "✍️ الكتابة والموشن", "🎬 التسليم"]);
  });
  it("motion graphics: the idea, then the edit room", () => {
    expect(states(stagesOf([{ role: "assistant", text: "a" }], "motion-graphics"))).toEqual(["idea:open", "editor:locked"]);
    expect(states(stagesOf([{ role: "assistant", text: "a", editor: { id: "e", title: "t" } }], "reel-graphics"))).toEqual(["idea:done", "editor:done"]);
  });
  it("a long answer opens one section at a time; a short one is shown whole", () => {
    const long = ["مقدمة", ...[1, 2, 3].map((i) => `## القسم ${i}\n${"كلام ".repeat(80)}`)].join("\n");
    expect(splitAnswer(long).sections.map((x) => x.title)).toEqual(["القسم 1", "القسم 2", "القسم 3"]);
    const html = renderToStaticMarkup(h(Answer, { text: long }));
    expect(html).toContain("افتح كل الأقسام");
    expect(html.match(/<details/g)?.length).toBe(3);
    expect(html.match(/<details[^>]* open/g)?.length).toBe(1);
    expect(renderToStaticMarkup(h(Answer, { text: "## عنوان\nكلام قصير" }))).not.toContain("<details");
  });
  it("the library holds the pictures, the made slides and the media, once each", () => {
    const lib = libraryOf([
      { slides: { items: [sl(1), sl(2)], approved: true } },
      { thread: "design", slides: { items: [sl(1, { fileId: "v1", videoUrl: "/v/1.mp4", videoDownload: "/dv/1.mp4" })] } },
      { media: { items: [{ id: "m", kind: "image", name: "صورة", state: "done", url: "/m.png", download: "/dm.png" }, { id: "x", kind: "video", name: "ف", state: "running" }] } },
      { error: true, slides: { items: [sl(9)] } },
    ]);
    expect(lib.map((x) => `${x.group}:${x.title}`)).toEqual(["pictures:الشريحة 1", "pictures:الشريحة 2", "design:الشريحة 1", "media:صورة"]);
    expect(lib[2]).toMatchObject({ video: "/v/1.mp4", download: "/dv/1.mp4", file: "slide-01.mp4" });
  });
});
