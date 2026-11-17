import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat, Turn } from "@/lib/content/chats";

// «قلل الصرف مع حصول نفس النتيجة» (the owner, 17 Nov 2026): the site's own steps cost nothing, «محمد باقر» reads the
// long tables only while they can be needed, what stays the same in a talk is read once, and he writes the slides once.
const claude = vi.hoisted(() => ({ answer: null as unknown, calls: [] as { system: string; systemExtra: string; stableNote: string; turnNote: string; cacheTail?: boolean; systemTtl?: string }[] }));
const db = vi.hoisted(() => ({ chat: null as unknown }));

vi.mock("@/lib/film/anthropic", async (orig) => ({
  ...(await orig<typeof import("@/lib/film/anthropic")>()),
  callClaudeJson: vi.fn(async (o: { system: string; systemExtra?: string; stableNote?: string; turnNote?: string; cacheTail?: boolean; systemTtl?: string }) => {
    claude.calls.push({ system: o.system, systemExtra: o.systemExtra ?? "", stableNote: o.stableNote ?? "", turnNote: o.turnNote ?? "", cacheTail: o.cacheTail, systemTtl: o.systemTtl });
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
vi.mock("@/lib/content/files", () => ({ attachmentsOf: vi.fn(async () => ({ list: [], rows: [] })), uploadLinks: vi.fn(async () => new Map()) }));
vi.mock("@/lib/content/persona", async (orig) => ({ ...(await orig<typeof import("@/lib/content/persona")>()), getPersona: vi.fn(async () => ({ text: "PERSONA", edited: false })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ upsert: async () => ({ error: null }), insert: async () => ({ error: null }), select: () => ({ in: () => ({ eq: () => ({ eq: async () => ({ data: [] }) }) }) }) }) }) }));

import { say } from "@/lib/content/chat";
import { askedSlides, FONT_LABEL, MOTION_CAROUSEL_LABEL, pureGatePick, ROUTE_LABEL, siteStep } from "@/lib/content/maker";
import { answerLine, CAROUSEL_HELP_LINE, carouselLine, carouselOwnLine, FONT_AUTO_LINE, fontLine, MOTION_CAROUSEL_HELP_LINE, motionCarouselLine, PALETTE_LABEL, PALETTE_STYLE_LINE, pathLine } from "@/lib/content/marks";
import { needsCatalog, chosenIds } from "@/lib/content/persona";
import { MOTION_CAROUSEL_GUIDE, MOTION_ROUTES } from "@config/content-motion-carousel";
import { CAROUSEL_STYLES } from "@config/content-carousel-styles";
import { readFileSync } from "node:fs";

const empty = { on: false, mode: "all", aspect: "2:3", template_id: "", style_id: "", slides: [] as unknown[] };
const answer = (o: Record<string, unknown> = {}) => {
  claude.answer = { reply: "ردّي", questions: [], record: "", produce: empty, handoff: { on: false, title: "", shape: "9:16", package: "" }, ...o };
};
const chat = () => db.chat as Chat;
const STYLE = carouselLine({ id: "white-text", name: "الشريحة البيضاء" });
const FONT = fontLine({ id: "cairo", name: "القاهرة" });
const MOVE = motionCarouselLine({ id: "kinetic-word", name: "الكلمة المتحركة" });
const START = pathLine("motion-carousel", "أبي موشن كاروسيل ٥ شرائح عن الصبر");
const TABLE = { label: "اختر ستايل الكاروسيل", kind: "carousels", options: [], multi: false };

beforeEach(() => {
  claude.answer = null;
  claude.calls.length = 0;
  db.chat = null;
});

describe("the site's own steps cost nothing", () => {
  it("a press alone is a step of the site; words beside it, «ساعدني» or the person's own look are not", () => {
    for (const t of [STYLE, PALETTE_STYLE_LINE, FONT, FONT_AUTO_LINE, MOVE, MOTION_ROUTES[1].label, answerLine(ROUTE_LABEL, [MOTION_ROUTES[0].label]), `${PALETTE_STYLE_LINE}\n${FONT}`]) expect(pureGatePick(t), t).toBe(true);
    for (const t of ["", `${STYLE}\nوخل العنوان أكبر`, CAROUSEL_HELP_LINE, MOTION_CAROUSEL_HELP_LINE, carouselOwnLine("خشب محروق"), "أبي الخط الثاني", "• كم شريحة؟: 5", "• ستايل الكاروسيل: «شي» [كاروسيل:not-a-style]"]) expect(pureGatePick(t), t).toBe(false);
  });

  it("after the style, the colours, the font, the motion style and the way of making it are asked by the site: «محمد باقر» is called once for all of them", async () => {
    answer({ questions: [TABLE] });
    await say("u", null, START, []);
    expect(claude.calls).toHaveLength(1);
    const colours = await say("u", "chat-1", STYLE, []);
    expect(colours.questions).toEqual([{ label: PALETTE_LABEL, kind: "palettes", options: [], multi: false }]);
    expect(colours.usd).toBe(0);
    expect((await say("u", "chat-1", PALETTE_STYLE_LINE, [])).questions![0]).toMatchObject({ label: FONT_LABEL, kind: "fonts" });
    expect((await say("u", "chat-1", FONT, [])).questions![0]).toMatchObject({ label: MOTION_CAROUSEL_LABEL, kind: "motioncarousels" });
    const route = await say("u", "chat-1", MOVE, []);
    expect(route.questions![0]).toMatchObject({ label: ROUTE_LABEL });
    // the price note knows how many slides they asked for
    expect(route.text).toContain("لـ 5 شرائح");
    // four presses, not one answer of his
    expect(claude.calls).toHaveLength(1);
    expect(chat().usd).toBeCloseTo(claude.calls.length * (1000 * 4 + 500 * 20) / 1e6, 6);
    // the last press goes to him, told that every step is answered and what comes next
    answer();
    await say("u", "chat-1", MOTION_ROUTES[1].label, []);
    expect(claude.calls).toHaveLength(2);
    expect(claude.calls[1].turnNote).toContain("اكتملت خطوات الشكل كلها");
    // the talk reads in order: his answer, then the site's four questions
    expect(chat().messages.filter((m) => m.role === "assistant").map((m) => m.questions?.[0]?.label)).toEqual([TABLE.label, PALETTE_LABEL, FONT_LABEL, MOTION_CAROUSEL_LABEL, ROUTE_LABEL, undefined]);
  });

  it("a press with words beside it, or with nothing left to ask, goes to him", async () => {
    answer({ questions: [TABLE] });
    await say("u", null, START, []);
    const mixed = await say("u", "chat-1", `${STYLE}\nبس خل الغلاف أغمق`, []);
    expect(claude.calls).toHaveLength(2);
    // and the site shows that step under his answer, so the presses that follow are the site's
    expect(mixed.questions!.at(-1)).toMatchObject({ label: PALETTE_LABEL, kind: "palettes" });
    // a step of the look still waits: he is told the site asks it, and to write no slide before
    expect(claude.calls[1].turnNote).toContain("خطوات الشكل الباقية يسألها الموقع بنفسه");
    expect(claude.calls[1].turnNote).toContain(PALETTE_LABEL);
  });

  it("not in another path, not before a style is picked, not after an answer that showed no step of the site", () => {
    const u = (text: string): Turn => ({ role: "user", text });
    const a = (questions?: Turn["questions"]): Turn => ({ role: "assistant", text: "رد", ...(questions ? { questions } : {}) });
    const pal = [{ label: PALETTE_LABEL, kind: "palettes" as const, options: [], multi: false }];
    expect(siteStep([u(START), a([TABLE as never]), u(STYLE)])).toMatchObject({ question: { kind: "palettes" } });
    expect(siteStep([u(pathLine("motion-graphics", "أبي موشن")), a(pal), u(PALETTE_STYLE_LINE)])).toBeNull();
    expect(siteStep([u("أبي بوست"), a(pal), u(PALETTE_STYLE_LINE)])).toBeNull();
    expect(siteStep([u(START), a(), u(STYLE)])).toBeNull();
    expect(siteStep([u(START), a([TABLE as never]), u(CAROUSEL_HELP_LINE)])).toBeNull();
  });

  it("how many slides they asked for is read from their words", () => {
    const u = (text: string): Turn => ({ role: "user", text });
    expect(askedSlides([u("أبي موشن كاروسيل ٥ شرائح")])).toBe(5);
    expect(askedSlides([u("• كم شريحة؟: 7")])).toBe(7);
    expect(askedSlides([u("أبي كاروسيل")])).toBe(0);
  });

  it("time to make it with a step missing: he writes no slide, and the site shows the step", async () => {
    answer({ questions: [TABLE] });
    await say("u", null, START, []);
    answer({ produce: { ...empty, on: true } });
    const r = await say("u", "chat-1", `${STYLE}\nالنص معتمد، أنتج`, []);
    expect(r.pending).toBeNull();
    expect(r.questions!.at(-1)).toMatchObject({ label: PALETTE_LABEL });
  });
});

describe("what he reads", () => {
  it("the long tables are read only while a look or a font can still be picked, or when the message speaks of one", () => {
    const ids = (t: string) => chosenIds([t]);
    expect(needsCatalog(ids("أبي كاروسيل"), "أبي كاروسيل")).toBe(true);
    expect(needsCatalog(ids(STYLE), "")).toBe(true);
    expect(needsCatalog(ids(`${STYLE}\n${FONT_AUTO_LINE}`), "")).toBe(true);
    expect(needsCatalog(ids(`${STYLE}\n${FONT}`), "أنتج الآن")).toBe(false);
    expect(needsCatalog(ids(`${STYLE}\n${FONT}`), "غيّر الخط")).toBe(true);
    expect(needsCatalog(ids(`${STYLE}\n${FONT}`), "أبي ستايل ثاني")).toBe(true);
    // «الخطوة» and «خطأ» are not «الخط»
    expect(needsCatalog(ids(`${STYLE}\n${FONT}`), "في خطأ في الخطوة الثالثة")).toBe(false);
    expect(needsCatalog(ids(pathLine("motion-graphics", "أبي موشن")), "أبي موشن عن الصبر")).toBe(false);
  });

  it("the tables ride in their own block, the fixed system never carries them, and what stays the same in a talk is read once", async () => {
    answer({ questions: [TABLE] });
    await say("u", null, START, []);
    const first = claude.calls[0];
    expect(first.system).not.toContain(`- ${CAROUSEL_STYLES[0].id} — `);
    expect(first.systemExtra).toContain(`- ${CAROUSEL_STYLES[0].id} — `);
    expect(first.stableNote).toContain(MOTION_CAROUSEL_GUIDE);
    expect(first.turnNote).not.toContain(MOTION_CAROUSEL_GUIDE);
    // the system lives an hour; the latest turn (never sent again as it is) gets no cache mark
    expect(first).toMatchObject({ systemTtl: "1h", cacheTail: false });
    // the look and the font picked: the tables go, the fixed system and the talk's own block stay word for word
    await say("u", "chat-1", `${STYLE}\n${PALETTE_STYLE_LINE}\n${FONT}\n${MOVE}\nوخل العنوان واضح`, []);
    const later = claude.calls[1];
    expect(later.systemExtra).toBe("");
    expect(later.system).toBe(first.system);
    expect(later.stableNote).toBe(first.stableNote);
  });
});

describe("«حيدرا ماكس» writes a slide once", () => {
  const src = readFileSync("src/lib/claude-code/picture.ts", "utf8");
  it("a moving slide's fix is a patch, and a slide over its approved picture is written with medium thought", () => {
    expect(src).toContain("patchFix ? EDIT_SCHEMA : WRITE_SCHEMA");
    // only the FIRST fix is a patch; a patch that can't be applied, or a program that still throws, is written whole —
    // a patch never uses up the slide's tries
    expect(src).toContain("const patchFix = !!motion && !!previous && b.fixRound === 0;");
    expect(src).toContain("await pictureWrite(user, { ...b, fixRound: 1 })");
    expect(readFileSync("src/components/claude-code/draw.ts", "utf8")).toContain('action: "write", code, fixRound: fix, errors');
    expect(src).toContain('patchFix || overPicture || ((motion || stillFor) && (b.light === true || !!still)) ? "medium" : "high"');
  });
  it("one look for a realistic woman per picture, by the light model", () => {
    const verify = readFileSync("src/lib/content/verify.ts", "utf8");
    expect(verify).toMatch(/withClaude\(SLIDE_CHECK_MODEL, \(\) => callClaudeJson<\{ realistic_adult_woman/);
    expect(readFileSync("src/lib/content/produce.ts", "utf8")).toContain("(p.refs?.length ?? 0) > 0 ? await showsRealWoman(bytes)");
  });
});

describe("the answers button", () => {
  it("sends what the person typed in the box with the pressed answers (it was dropped, and a paid answer went on the answers alone)", () => {
    const page = readFileSync("src/components/jawad/content/ContentChat.tsx", "utf8");
    expect(page).toContain('onSend={(t) => void send([q.trim(), t].filter(Boolean).join("\\n"))}');
  });
});

describe("the price note of the last step", () => {
  it("is the price of the quality the slides are painted at", async () => {
    const { IMAGE_QUALITY, IMAGE_TIER } = await import("@/lib/content/produce");
    expect(readFileSync("src/lib/content/maker.ts", "utf8")).toContain(`k.key === "out:${IMAGE_QUALITY}:${IMAGE_TIER}")`);
  });
});
