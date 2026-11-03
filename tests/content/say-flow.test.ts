import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat, Turn } from "@/lib/content/chats";
import { CAROUSEL_LABEL, FONT_LABEL, MAKER_CODE, MAKER_GPT, MAKER_LABEL, MAKER_MIX, PHOTOS_LABEL, PHOTOS_MAKE, PHOTOS_MINE } from "@/lib/content/maker";

// One message to «محمد باقر» end to end, with Claude, the database and the editor replaced by stand-ins: what he is
// given (the catalogues, what the person picked, the state of an earlier carousel) and what the site does with his
// answer (the buttons, the carousel to draw, drawing slides again, the hand-over to حيدرا ماكس).
// `system` here is what he reads in all: the fixed system and this turn's note (examples, picks, the record)
const claude = vi.hoisted(() => ({ answer: null as unknown, calls: [] as { system: string; fixed: string; turns: { role: string; content: unknown }[] }[] }));
const db = vi.hoisted(() => ({ chat: null as unknown, editorProjects: [] as unknown[], editorChats: [] as unknown[], assets: [] as unknown[] }));

vi.mock("@/lib/film/anthropic", async (orig) => ({
  ...(await orig<typeof import("@/lib/film/anthropic")>()),
  callClaudeJson: vi.fn(async (o: { system: string; turnNote?: string; turns: { role: string; content: unknown }[] }) => {
    claude.calls.push({ system: `${o.system}\n\n${o.turnNote ?? ""}`, fixed: o.system, turns: o.turns });
    return { data: claude.answer, raw: "", usage: { input_tokens: 1000, output_tokens: 500 } };
  }),
}));
vi.mock("@/lib/content/chats", async (orig) => {
  const real = await orig<typeof import("@/lib/content/chats")>();
  return {
    ...real,
    getChat: vi.fn(async () => (db.chat ? structuredClone(db.chat) : null)),
    saveChat: vi.fn(async (_u: string, id: string | null, patch: { messages: Turn[]; record?: string; pending?: unknown; addUsd?: number }) => {
      const c = (db.chat as Chat | null) ?? ({ id: "chat-1", title: "t", record: "", pending: null, usd: 0, spentHalalas: 0, updatedAt: "", messages: [] } as Chat);
      c.messages = structuredClone(patch.messages);
      if (patch.record !== undefined) c.record = patch.record;
      if (patch.pending !== undefined) c.pending = structuredClone(patch.pending) as Chat["pending"];
      c.usd += patch.addUsd ?? 0;
      db.chat = c;
      return id ?? c.id;
    }),
  };
});
vi.mock("@/lib/content/files", () => ({
  attachmentsOf: vi.fn(async (_u: string, ids: unknown) => ({ list: (Array.isArray(ids) ? ids : []).map((id: string) => ({ id, kind: "video", name: `${id}.mp4`, durationMs: 4000 })), rows: [] })),
  uploadLinks: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/content/persona", async (orig) => ({ ...(await orig<typeof import("@/lib/content/persona")>()), getPersona: vi.fn(async () => ({ text: "PERSONA", edited: false })) }));
vi.mock("@/lib/editor/server", () => ({
  createEditorProject: vi.fn(async (_u: string, b: { title: string; kind: string }) => {
    db.editorProjects.push(b);
    return "room-1";
  }),
  requireEditorProject: vi.fn(async (id: string) => ({ id, user_id: "u" })),
}));
vi.mock("@/lib/editor/chat", () => ({ appendChat: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => ({
      upsert: async (row: unknown) => {
        if (t === "editor_chats") db.editorChats.push(row);
        return { error: null };
      },
      select: () => ({ in: () => ({ eq: () => ({ eq: async () => ({ data: [{ id: "vid-1", kind: "video", storage_path: "u/refs/a.mp4", file_name: "a.mp4", mime: "video/mp4", bytes: 9, width: 1080, height: 1920, duration_ms: 4000 }] }) }) }) }),
      insert: async (rows: unknown) => {
        if (t === "editor_assets") db.assets.push(...(rows as unknown[]));
        return { error: null };
      },
    }),
  }),
}));

import { say } from "@/lib/content/chat";
import { findStyle } from "@config/film-styles";
import { answerLine, CAROUSEL_HELP_LINE, carouselLine, carouselOwnLine, FONT_AUTO_LINE, fontLine, styleLine, templateLine } from "@/lib/content/marks";

const empty = { on: false, mode: "all", aspect: "1:1", template_id: "", style_id: "", slides: [] };
const noHandoff = { on: false, title: "", shape: "9:16", package: "" };
const answer = (o: Record<string, unknown>) => {
  claude.answer = { reply: "ردّي", questions: [], record: "", produce: empty, handoff: noHandoff, ...o };
};
const slides = (prompt = "clean design") => [{ n: 1, text: "العنوان", prompt: `${prompt} "العنوان"` }, { n: 2, text: "الخطوة", prompt: `${prompt} "الخطوة"` }];
const chat = () => db.chat as Chat;
// a look with no realistic pictures, so the only step left is who makes it
const FONT = fontLine({ id: "cairo", name: "القاهرة" });
// a style and its font, as pressed before who makes it
const FLAT = `${carouselLine({ id: "white-text", name: "الشريحة البيضاء" })}\n${FONT}`;
const picked = (maker: string) => `${FLAT}\n${answerLine(MAKER_LABEL, [maker])}`;

beforeEach(() => {
  claude.answer = null;
  claude.calls.length = 0;
  db.chat = null;
  db.editorProjects.length = 0;
  db.editorChats.length = 0;
  db.assets.length = 0;
});

describe("what he is given", () => {
  it("the rules, the tools, both catalogues, the closest examples, and — once the person picked — the details of the pick", async () => {
    answer({});
    await say("u", null, `${templateLine({ id: "scrapbook", name: "دفتر قصاصات" })}\n${styleLine({ id: "ghibli", name: "جيبلي" })}`, []);
    const sys = claude.calls[0].system;
    for (const t of ["PERSONA", "قواعد المنصة", "أدوات المنصة المتاحة لك", "- scrapbook — دفتر قصاصات", "- ghibli — جيبلي", "القالب الذي اختاره العميل: دفتر قصاصات", "DESIGN SYSTEM", "الستايل الكرتوني الذي اختاره العميل", "أمثلة كاروسيل مكتملة"]) expect(sys).toContain(t);
  });

  it("an earlier answer reaches him with the buttons he offered and the state of its carousel", async () => {
    db.chat = {
      id: "chat-1", title: "t", record: "REC", pending: null, usd: 0, spentHalalas: 0, updatedAt: "",
      messages: [
        { role: "user", text: "أبي كاروسيل" },
        {
          role: "assistant", text: "تمام",
          questions: [{ label: "المنصة؟", kind: "choice", options: ["انستغرام", "لينكدإن"], multi: false }, { label: "القالب؟", kind: "templates", options: [], multi: false }],
          slides: { aspect: "1:1", items: [{ n: 1, fileId: "f1", name: "slide-01", text: "t" }], todo: [], failed: [{ n: 2, reason: "المزوّد مشغول", text: "t", prompt: "p" }], running: false, total: 2, styleId: "", templateId: "", report: "🔎 تقرير الفحص" },
        },
      ],
    };
    answer({});
    await say("u", "chat-1", "عدّل الشريحة ٢", []);
    const earlier = claude.calls[0].turns[1].content as string;
    expect(earlier).toContain("المنصة؟: انستغرام | لينكدإن");
    expect(earlier).toContain("القالب؟ (معرض القوالب)");
    expect(earlier).toContain("شرائح مصنوعة 1");
    expect(earlier).toContain("لم تُصنع 2 (المزوّد مشغول)");
    expect(earlier).toContain("🔎 تقرير الفحص");
    expect(claude.calls[0].system).toContain("REC");
    // the record rides with the turn: the system itself is the same on every message (so it and the history are cached)
    expect(claude.calls[0].fixed).not.toContain("REC");
  });
});

describe("his answer", () => {
  it("the questions become buttons, kept with the answer", async () => {
    answer({ questions: [{ label: "المنصة؟", kind: "choice", options: ["انستغرام", "لينكدإن"], multi: false }, { label: "القالب؟", kind: "templates", options: [], multi: false }, { label: "فارغ", kind: "choice", options: [], multi: false }] });
    const r = await say("u", null, "أبي سكربت ريل", []);
    expect(r.questions).toEqual([{ label: "المنصة؟", kind: "choice", options: ["انستغرام", "لينكدإن"], multi: false }, { label: "القالب؟", kind: "templates", options: [], multi: false }]);
    expect(r.pending).toBeNull();
    expect(chat().messages[1].questions).toHaveLength(2);
  });

  it("a carousel ordered: it waits to be drawn with the valid template and style, and its slides appear as placeholders", async () => {
    answer({ produce: { on: true, mode: "all", aspect: "2:3", template_id: "scrapbook", style_id: "ghibli", slides: slides() } });
    const r = await say("u", null, picked(MAKER_GPT), []);
    expect(r.pending).toEqual({ total: 2, mode: "all", todo: [1, 2] });
    expect(chat().pending).toMatchObject({ aspect: "2:3", templateId: "scrapbook", styleId: "ghibli", mode: "all", at: 1 });
    expect(chat().messages[1].slides).toMatchObject({ todo: [1, 2], running: true, total: 2 });
    // an id the site doesn't know is dropped, not trusted
    answer({ produce: { on: true, mode: "all", aspect: "9:99", template_id: "nope", style_id: "nope", slides: slides() } });
    db.chat = null;
    await say("u", null, picked(MAKER_GPT), []);
    expect(chat().pending).toMatchObject({ aspect: "1:1", templateId: "", styleId: "" });
    expect(findStyle("ghibli")).toBeDefined();
  });

  it("the person picks who designs the slides as the last step: nothing is made until a button is pressed, and the pick is the one pressed", async () => {
    answer({});
    await say("u", null, "أبي كاروسيل", []);
    expect(claude.calls[0].system).toContain("آخر خطوة قبل تصنيع أي كاروسيل جديد");
    expect(claude.calls[0].system).toContain("GPT Image 2 (رسم كامل بالذكاء الاصطناعي)");
    // the model sends the slides without a pick (or claims one): nothing is made, the question goes out
    for (const maker of [undefined, "code", "gpt", "mix"]) {
      answer({ produce: { on: true, mode: "all", ...(maker ? { maker } : {}), aspect: "1:1", template_id: "", style_id: "", slides: slides() } });
      db.chat = null;
      const r = await say("u", null, FLAT, []);
      expect(r.pending).toBeNull();
      expect(chat().pending).toBeNull();
      expect(r.questions!.at(-1)).toMatchObject({ label: MAKER_LABEL, kind: "choice", options: [MAKER_CODE, MAKER_GPT, MAKER_MIX] });
    }
    // a pick typed in words is not the pressed answer
    answer({ produce: { on: true, mode: "all", maker: "gpt", aspect: "1:1", template_id: "", style_id: "", slides: slides() } });
    db.chat = null;
    expect((await say("u", null, `${FLAT}\nسو بحيدرا ماكس`, [])).pending).toBeNull();
    // the pressed answer decides, whatever the model puts in "maker": alone, or as a line of a batch
    const chosen = async (pressed: string, maker: string) => {
      answer({});
      db.chat = null;
      await say("u", null, FLAT, []);
      answer({ produce: { on: true, mode: "all", maker, aspect: "1:1", template_id: "", style_id: "", slides: slides() } });
      await say("u", "chat-1", pressed, []);
    };
    await chosen(MAKER_GPT, "code");
    expect(chat().pending).not.toBeNull();
    expect(chat().pending!.maker).toBeUndefined();
    await chosen(MAKER_CODE, "gpt");
    expect(chat().pending!.maker).toBe("code");
    expect(chat().pending!.mix).toBeUndefined();
    await chosen(answerLine(MAKER_LABEL, [MAKER_CODE]), "gpt");
    expect(chat().pending!.maker).toBe("code");
    // the third way: GPT Image 2's pictures with «حيدرا ماكس»'s writing
    await chosen(MAKER_MIX, "gpt");
    expect(chat().pending).toMatchObject({ maker: "code", mix: true, carouselId: "white-text", fontId: "cairo" });
    expect(chat().messages.at(-1)!.slides).toMatchObject({ maker: "code", mix: true, carouselId: "white-text", fontId: "cairo" });
  });

  it("a carousel opens the table of styles, and nothing is made until a style is picked", async () => {
    answer({ questions: [{ label: "المنصة؟", kind: "choice", options: ["انستغرام", "لينكدإن"], multi: false }, { label: "الألوان؟", kind: "palettes", options: [], multi: false }, { label: "القالب؟", kind: "templates", options: [], multi: false }] });
    const first = await say("u", null, "أبي كاروسيل", []);
    // the table stands in for the colours and the templates he might still offer
    expect(first.questions).toEqual([{ label: "المنصة؟", kind: "choice", options: ["انستغرام", "لينكدإن"], multi: false }, { label: CAROUSEL_LABEL, kind: "carousels", options: [], multi: false }]);
    for (const t of ["جدول ستايلات الكاروسيل", "- notebook — 1) الدفتر", "- choose-path — 50) اختر مسارك", "كيف تكتب توجيه GPT Image 2", "لا تسأل العميل عن الألوان ولا الهوامش", "امرأة بالغة واقعية"]) expect(claude.calls[0].system).toContain(t);
    // slides without a pick: the table again, not a carousel
    answer({ produce: { on: true, mode: "all", aspect: "1:1", template_id: "", style_id: "", slides: slides() } });
    const second = await say("u", "chat-1", `أنتج\n${answerLine(MAKER_LABEL, [MAKER_GPT])}`, []);
    expect(second.pending).toBeNull();
    expect(second.questions!.at(-1)).toMatchObject({ label: CAROUSEL_LABEL, kind: "carousels" });
  });

  it("after the style comes the font: the list goes out, the style's ready font is named, and the pick is kept with the carousel", async () => {
    answer({ produce: { on: true, mode: "all", aspect: "1:1", template_id: "", style_id: "", slides: slides() } });
    const r = await say("u", null, carouselLine({ id: "soft-3d", name: "ثري دي ناعم" }), []);
    expect(r.pending).toBeNull();
    expect(r.questions!.at(-1)).toMatchObject({ label: FONT_LABEL, kind: "fonts" });
    expect(r.text).toContain("بالو بهايجان");
    expect(claude.calls[0].system).toContain('kind="fonts"');
    // the font is left to him: the one he names in "font_id" is kept
    answer({ produce: { on: true, mode: "all", font_id: "lemonada", aspect: "1:1", template_id: "", style_id: "", slides: slides() } });
    await say("u", "chat-1", `${FONT_AUTO_LINE}\n${answerLine(MAKER_LABEL, [MAKER_GPT])}`, []);
    expect(chat().pending).toMatchObject({ carouselId: "soft-3d", fontId: "lemonada" });
  });

  it("help me choose is not a pick: he helps, and his recommendations are shown first in the table", async () => {
    answer({ questions: [{ label: "اختر من ترشيحاتي", kind: "carousels", options: ["notebook", "nope", "tweet-dark"], multi: false }], produce: { on: true, mode: "all", aspect: "1:1", template_id: "", style_id: "", slides: slides() } });
    const r = await say("u", null, CAROUSEL_HELP_LINE, []);
    expect(claude.calls[0].system).toContain("رشّح له ٣ ستايلات");
    expect(r.pending).toBeNull();
    expect(r.questions).toEqual([{ label: "اختر من ترشيحاتي", kind: "carousels", options: ["notebook", "tweet-dark"], multi: false }]);
    // his own recommendations are kept when he only offers them; an id the site doesn't know is dropped
    answer({ questions: [{ label: "اختر من ترشيحاتي", kind: "carousels", options: ["notebook", "nope", "tweet-dark"], multi: false }] });
    expect((await say("u", "chat-1", "الهدف توعية", [])).questions).toEqual([{ label: "اختر من ترشيحاتي", kind: "carousels", options: ["notebook", "tweet-dark"], multi: false }]);
  });

  it("something not in the table is a pick in the person's own words", async () => {
    answer({ produce: { on: true, mode: "all", aspect: "1:1", template_id: "", style_id: "", slides: slides() } });
    const r = await say("u", null, `${carouselOwnLine("ستايل خشب محروق")}\n${FONT_AUTO_LINE}\n${answerLine(MAKER_LABEL, [MAKER_GPT])}`, []);
    expect(claude.calls[0].system).toContain("يريد شكلًا غير الموجود");
    expect(r.pending).toEqual({ total: 2, mode: "all", todo: [1, 2] });
    expect(chat().pending!.carouselId).toBeUndefined();
  });

  it("a realistic style asks: their own pictures, or made from zero, with the idea of what to add", async () => {
    const NOTEBOOK = carouselLine({ id: "notebook", name: "الدفتر" });
    const order = () => answer({ produce: { on: true, mode: "all", refs: [], aspect: "1:1", template_id: "", style_id: "", slides: slides() } });
    order();
    const asked = await say("u", null, NOTEBOOK, []);
    expect(claude.calls[0].system).toContain("أضيف صوري");
    expect(asked.pending).toBeNull();
    expect(asked.questions!.at(-1)).toMatchObject({ label: PHOTOS_LABEL, options: [PHOTOS_MINE, PHOTOS_MAKE] });
    expect(asked.text).toContain("صوّر صفحة من دفترك");
    // made from zero: on to who makes it, then made
    db.chat = null;
    order();
    const zero = await say("u", null, `${NOTEBOOK}\n${FONT}\n${answerLine(PHOTOS_LABEL, [PHOTOS_MAKE])}`, []);
    expect(zero.questions!.at(-1)).toMatchObject({ label: MAKER_LABEL });
    order();
    expect((await say("u", "chat-1", MAKER_MIX, [])).pending).toEqual({ total: 2, mode: "all", todo: [1, 2] });
    expect(chat().pending).toMatchObject({ carouselId: "notebook", mix: true });
    // their own pictures: nothing is made until they arrive
    db.chat = null;
    order();
    const mine = await say("u", null, `${NOTEBOOK}\n${FONT}\n${answerLine(PHOTOS_LABEL, [PHOTOS_MINE])}\n${answerLine(MAKER_LABEL, [MAKER_GPT])}`, []);
    expect(mine.pending).toBeNull();
    expect(mine.text).toContain("أرفقها بزر 📎");
  });

  it("a second carousel asks again; the pick of the first does not carry over", async () => {
    const turns = (maker?: "code") => ({
      id: "chat-1", title: "t", record: "", pending: null, usd: 0, spentHalalas: 0, updatedAt: "",
      messages: [
        { role: "user", text: MAKER_CODE },
        { role: "assistant", text: "تمام", slides: { aspect: "1:1", items: [{ n: 1, fileId: "f1", name: "slide-01", text: "t" }], todo: [], failed: [], running: false, total: 1, styleId: "", templateId: "", ...(maker ? { maker } : {}) } },
      ],
    });
    answer({ produce: { on: true, mode: "all", maker: "code", aspect: "1:1", template_id: "", style_id: "", slides: slides() } });
    db.chat = turns("code");
    expect((await say("u", "chat-1", "كاروسيل ثاني", [])).pending).toBeNull();
  });

  it("slides drawn again go back to the way the carousel was made, whatever the answer says", async () => {
    const made = (maker?: "code") => ({
      id: "chat-1", title: "t", record: "", pending: null, usd: 0, spentHalalas: 0, updatedAt: "",
      messages: [
        { role: "user", text: "أبي كاروسيل" },
        { role: "assistant", text: "تمام", slides: { aspect: "1:1", items: [{ n: 1, fileId: "f1", name: "slide-01", text: "t" }], todo: [], failed: [], running: false, total: 1, styleId: "", templateId: "", ...(maker ? { maker } : {}) } },
      ],
    });
    answer({ produce: { on: true, mode: "fix", maker: "code", aspect: "1:1", template_id: "", style_id: "", slides: [{ n: 1, text: "ت", prompt: 'p "ت"' }] } });
    db.chat = made();
    await say("u", "chat-1", "أعد الشريحة 1", []);
    expect(chat().pending!.maker).toBeUndefined();
    answer({ produce: { on: true, mode: "fix", maker: "gpt", aspect: "1:1", template_id: "", style_id: "", slides: [{ n: 1, text: "ت", prompt: 'p "ت"' }] } });
    db.chat = made("code");
    await say("u", "chat-1", "أعد الشريحة 1", []);
    expect(chat().pending!.maker).toBe("code");
  });

  it("slides drawn again: only those slides, in the carousel that exists, with its style kept", async () => {
    db.chat = {
      id: "chat-1", title: "t", record: "", pending: null, usd: 0, spentHalalas: 0, updatedAt: "",
      messages: [
        { role: "user", text: "أبي كاروسيل" },
        { role: "assistant", text: "تمام", slides: { aspect: "9:16", items: [{ n: 1, fileId: "f1", name: "slide-01", text: "t" }, { n: 2, fileId: "f2", name: "slide-02", text: "t", flag: "حرف مقطوع" }], todo: [], failed: [{ n: 3, reason: "r", text: "t", prompt: "p" }], running: false, total: 3, styleId: "ghibli", templateId: "scrapbook", report: "قديم" } },
      ],
    };
    answer({ produce: { on: true, mode: "fix", aspect: "1:1", template_id: "", style_id: "", slides: [{ n: 2, text: "الخطوة", prompt: 'fixed "الخطوة"' }] } });
    const r = await say("u", "chat-1", "أعد رسم الشريحة 2", []);
    expect(r.pending).toEqual({ total: 1, mode: "fix", todo: [2] });
    expect(chat().pending).toMatchObject({ mode: "fix", at: 1, aspect: "9:16", styleId: "ghibli", templateId: "scrapbook" });
    expect(chat().pending!.carry.map((f) => f.n)).toEqual([3]);
    const block = chat().messages[1].slides!;
    expect(block.todo).toEqual([2]);
    expect(block.running).toBe(true);
    expect(block.items.map((i) => i.n)).toEqual([1, 2]);
    // the new reply itself carries no carousel of its own
    expect(chat().messages[3].slides).toBeUndefined();
  });

  it("a produced reel: the edit room opens in حيدرة كت with the package and the person's files, and he is told so", async () => {
    answer({ handoff: { on: true, title: "ريل القهوة", shape: "9:16", package: "الحزمة الكاملة للريل" } });
    const r = await say("u", null, "ابدأ الإنتاج", ["vid-1"]);
    expect(r.editor).toEqual({ id: "room-1", title: "ريل القهوة" });
    expect(db.editorProjects).toEqual([{ title: "ريل القهوة", kind: "reel" }]);
    expect(db.editorChats[0]).toMatchObject({ project_id: "room-1", handoff: expect.stringContaining("الحزمة الكاملة للريل") });
    expect(db.assets[0]).toMatchObject({ project_id: "room-1", kind: "video", bucket: "jawad", path: "u/refs/a.mp4" });
    expect(r.text).toContain("فتحت غرفة مونتاج باسم «ريل القهوة»");
    expect(chat().messages[1].editor).toEqual({ id: "room-1", title: "ريل القهوة" });
  });

  it("a motion piece: the storyboard he wrote is checked, kept in the handoff with the chosen skill and mood, and a broken one is left out", async () => {
    const sb = JSON.stringify({ style: "reel", mood: "joy", beats: [{ kind: "kinetic", words: ["مبروك", "عليك", "الفرحة"], hot: 1 }, { kind: "outro", title: "شكرًا", handle: "@nahjali" }] });
    answer({ handoff: { on: true, title: "تهنئة", shape: "9:16", package: "حزمة الموشن", storyboard: sb } });
    await say("u", null, "ابدأ الإنتاج", []);
    const handoff = String((db.editorChats[0] as { handoff: string }).handoff);
    expect(handoff).toContain("لوحة القصة (storyboard)");
    expect(handoff).toContain("الريل السريع");
    expect(handoff).toContain("الفرح");
    expect(handoff).toContain("مبروك");
    expect(handoff).toContain("لا تطلب خلفية من GPT Image 2");
    // unreadable: the package alone
    db.editorChats.length = 0;
    answer({ handoff: { on: true, title: "تهنئة", shape: "9:16", package: "حزمة الموشن", storyboard: "{not json" } });
    await say("u", null, "ابدأ الإنتاج", []);
    expect(String((db.editorChats[0] as { handoff: string }).handoff)).not.toContain("لوحة القصة");
  });
});
