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
const deleted = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/content/files", () => ({
  // ids starting «img-» are the person's pictures
  attachmentsOf: vi.fn(async (_u: string, ids: unknown) => ({ list: (Array.isArray(ids) ? ids : []).filter((id: string) => String(id).startsWith("img-")).map((id: string) => ({ id, kind: "image", name: `${id}.jpg` })), rows: [] })),
  uploadLinks: vi.fn(async () => new Map()),
  deleteProduced: vi.fn(async (_u: string, id: string) => { deleted.push(id); }),
  producedRow: vi.fn(async (_u: string, id: string) => ({ id, path: "x", name: "slide-01", meta: { refs: ["img-old"] } })),
}));
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

describe("a failed slide tried again", () => {
  it("keeps its painted, approved picture: no second painting and no second approval", () => {
    const produce = readFileSync("src/lib/content/produce.ts", "utf8");
    expect(produce).toContain('if (it && /^(picture|element)-/.test(it.name) && block.failed.some((f) => f.n === sl.n)) arts[String(sl.n)] = it.fileId;');
    expect(produce).toContain("...(keptArts && slides.every((sl) => arts[String(sl.n)]) ? { picturesOk: true } : {}),");
  });
});

describe("«حوّله ريل»", () => {
  it("reads the slides' videos fresh from storage (the player's cached copy is refused to a script)", () => {
    const reel = readFileSync("src/components/jawad/content/slides-reel.ts", "utf8");
    expect(reel).toContain("new UrlSource(s.video, { maxCacheSize: Infinity, requestInit: NO_CACHE })");
    expect(reel).toContain("fetch(url, NO_CACHE)");
  });
});

describe("the content maker's own default model", () => {
  it("is «الرشيق» while the person has chosen none, on the page, in the picker and on the server", async () => {
    const { CONTENT_CLAUDE_MODEL, findClaudeModel } = await import("@config/claude-models");
    expect(findClaudeModel(CONTENT_CLAUDE_MODEL)?.name).toBe("الرشيق");
    const page = readFileSync("src/components/jawad/content/ContentChat.tsx", "utf8");
    expect(page).toContain("useClaudeModel(CONTENT_CLAUDE_MODEL)");
    expect(page).toContain("fallback={CONTENT_CLAUDE_MODEL}");
    expect(readFileSync("src/app/api/content/chat/route.ts", "utf8")).toContain("findClaudeModel(b.model) ? b.model : CONTENT_CLAUDE_MODEL");
    // a model the person picked stays theirs: the section's default only fills an empty choice
    expect(readFileSync("src/components/robots/claude-model.ts", "utf8")).toContain('useSyncExternalStore(subscribe, read, () => "") || fallback');
  });
});

describe("a slide over the person's own sound", () => {
  it("is never silent: its part is read fresh and tried again, and a slide whose sound can't be read fails instead", () => {
    const draw = readFileSync("src/components/claude-code/draw.ts", "utf8");
    expect(draw).toContain('const r = await fetch(url, { cache: "no-store" });');
    // only the slide's own part is read first (a phone could not decode a whole .mov per slide: «Decoding failed»)
    expect(draw).toContain("new AudioBufferSink(track).buffers(from, to)");
    expect(draw).toContain("const run = decodeLine.then(whole, whole);");
    expect(draw).toContain("ما قدرت أجيب صوت الشريحة");
    expect(draw).not.toContain("soundPart(m.voice.url, m.voice.from, m.voice.to).catch(() => null)");
  });
  it("drawn again gets its own part of the sound (its place in the whole carousel) and keeps the picture it was drawn over", () => {
    const produce = readFileSync("src/lib/content/produce.ts", "utf8");
    expect(produce).toContain('const at = p.mode === "fix" ? s.n - 1 : p.slides.findIndex((x) => x.n === s.n);');
    expect(produce).toContain("await slidePicture(userId, chat.id, n, batch)");
  });
});

describe("the slide's tools", () => {
  it("the download link stands beside «🔁», not on top of it", () => {
    expect(readFileSync("src/app/jawad-ai/content/content.css", "utf8")).toContain(".ct-slide .tools a { position: static; }");
  });
});

describe("a slide made over its picture", () => {
  it("never deletes the picture that stood in its place (a later redraw keeps it)", () => {
    const produce = readFileSync("src/lib/content/produce.ts", "utf8");
    expect(produce).toContain('const isArt = !!old && (/^(picture|element)-/.test(old.name) || Object.values(p.arts ?? {}).includes(old.fileId));');
    expect(produce).toContain('if (old && p.mode === "fix" && !isArt) {');
  });
});

describe("the pictures stage, asked in words", () => {
  it("«غيّر الصورة الثانية» draws only that picture again, in the same carousel (it only turned before)", async () => {
    const slides = [1, 2, 3].map((n) => ({ n, text: `ن${n}`, prompt: `p${n}`, picture: `pic${n}` }));
    const pending = { id: "pp", aspect: "2:3", slides, at: 1, styleId: "", templateId: "", mode: "all", maker: "code", motion: { styleId: "kinetic-word", route: "picture", seconds: 5 }, made: [], failed: [], carry: [], arts: { "1": "a1", "2": "a2", "3": "a3" } };
    db.chat = { id: "chat-1", title: "t", record: "", usd: 0, spentHalalas: 0, updatedAt: "", pending, messages: [{ role: "user", text: START }, { role: "assistant", text: "بدأ التصنيع", slides: { aspect: "2:3", items: [], todo: [1, 2, 3], failed: [], running: true, phase: "approve" } }] } as never;
    answer({ reply: "أعدت رسم صورة الشريحة ٢", produce: { ...empty, on: true, mode: "fix", slides: [{ n: 2, text: "ن2", prompt: "p2", picture: "a boy in a white t-shirt" }] } });
    deleted.length = 0;
    const r = await say("u", "chat-1", "غيّر الصورة الثانية: خله بتيشيرت أبيض", []);
    // he is told how to do it
    expect(claude.calls.at(-1)!.turnNote).toContain("مرحلة اعتماد الصور");
    // only picture 2 goes; the carousel stays the same and the page draws the missing picture
    expect(deleted).toEqual(["a2"]);
    const p = chat().pending as unknown as typeof pending;
    expect(p.id).toBe("pp");
    expect(Object.keys(p.arts)).toEqual(["1", "3"]);
    expect(p.slides.find((x) => x.n === 2)!.picture).toBe("a boy in a white t-shirt");
    expect(r.pending).toMatchObject({ todo: [1, 2, 3] });
  });
});

describe("«أعد صورة» on a phone", () => {
  it("asks what to change in a field on the page, not a browser popup (the phone apps' browsers drop those)", () => {
    const page = readFileSync("src/components/jawad/content/ContentChat.tsx", "utf8");
    expect(page).not.toContain("window.prompt(`وش تبي يتغير في صورة الشريحة");
    expect(page).toContain("ارسم صورة {redoN} من جديد");
  });
});

describe("slides drawn again with the person's reference", () => {
  it("a new picture attached with «أعد الشريحة ٣ و٤» goes with those slides, before the carousel's own reference (they went with none)", async () => {
    const made = [1, 2, 3, 4].map((n) => ({ n, fileId: `f${n}`, name: `slide-0${n}`, text: `ن${n}` }));
    db.chat = { id: "chat-1", title: "t", record: "", usd: 0, spentHalalas: 0, updatedAt: "", pending: null, messages: [
      { role: "user", text: START, files: [{ id: "img-old", kind: "image", name: "old.jpg" }] },
      { role: "assistant", text: "تم", slides: { aspect: "2:3", items: made, todo: [], failed: [], running: false, total: 4, maker: "code", motion: { styleId: "kinetic-word", route: "picture", seconds: 5 } } },
    ] } as never;
    answer({ produce: { ...empty, on: true, mode: "fix", refs: [], slides: [3, 4].map((n) => ({ n, text: `ن${n}`, prompt: `p${n}`, picture: `pic${n}` })) } });
    await say("u", "chat-1", "هذي صورتي، أعد الشريحة ٣ و٤ بنفس الشخصية", ["img-new"]);
    const p = chat().pending as unknown as { refs?: string[]; mode: string; slides: { n: number }[] };
    expect(p.mode).toBe("fix");
    expect(p.slides.map((x) => x.n)).toEqual([3, 4]);
    // the newest picture is THE reference: not mixed with the carousel's old one
    expect(p.refs).toEqual(["img-new"]);
  });

  it("the picture sent in an earlier message (after the carousel) still wins over the old one; with none sent since, the old one stays", async () => {
    const made = [1, 2, 3, 4].map((n) => ({ n, fileId: `f${n}`, name: `slide-0${n}`, text: `ن${n}` }));
    const base = [
      { role: "user", text: START, files: [{ id: "img-old", kind: "image", name: "old.jpg" }] },
      { role: "assistant", text: "تم", slides: { aspect: "2:3", items: made, todo: [], failed: [], running: false, total: 4, maker: "code", motion: { styleId: "kinetic-word", route: "picture", seconds: 5 } } },
    ];
    const fix = { ...empty, on: true, mode: "fix", refs: [], slides: [3].map((n) => ({ n, text: `ن${n}`, prompt: `p${n}`, picture: `pic${n}` })) };
    db.chat = { id: "chat-1", title: "t", record: "", usd: 0, spentHalalas: 0, updatedAt: "", pending: null, messages: [...base, { role: "user", text: "هذي صورتي", files: [{ id: "img-a", kind: "image", name: "a.jpg" }, { id: "img-b", kind: "image", name: "b.jpg" }] }, { role: "assistant", text: "وصلت" }] } as never;
    // she points at one of them
    answer({ produce: { ...fix, refs: ["img-b"] } });
    await say("u", "chat-1", "استخدم الصورة الثانية وأعد الشريحة ٣", []);
    expect((chat().pending as unknown as { refs: string[] }).refs).toEqual(["img-b"]);
    // she does not: the latest message's pictures
    db.chat = { id: "chat-1", title: "t", record: "", usd: 0, spentHalalas: 0, updatedAt: "", pending: null, messages: [...base, { role: "user", text: "هذي صورتي", files: [{ id: "img-a", kind: "image", name: "a.jpg" }] }, { role: "assistant", text: "وصلت" }] } as never;
    answer({ produce: fix });
    await say("u", "chat-1", "أعد الشريحة ٣", []);
    expect((chat().pending as unknown as { refs: string[] }).refs).toEqual(["img-a"]);
    // nothing new: the carousel's own
    db.chat = { id: "chat-1", title: "t", record: "", usd: 0, spentHalalas: 0, updatedAt: "", pending: null, messages: base } as never;
    answer({ produce: fix });
    await say("u", "chat-1", "أعد الشريحة ٣", []);
    expect((chat().pending as unknown as { refs: string[] }).refs).toEqual(["img-old"]);
  });
});

describe("a change asked while the carousel is still being made (إيمان, 18 Nov 2026)", () => {
  it("keeps the slides not made yet, and every slide keeps its approved picture: nothing painted or approved again", async () => {
    const items = [
      { n: 1, fileId: "pic1", name: "picture-01", text: "ن1" },
      { n: 2, fileId: "pic2", name: "picture-02", text: "ن2" },
      { n: 3, fileId: "pic3", name: "picture-03", text: "ن3" },
    ];
    const unfinished = { id: "old", aspect: "9:16", at: 1, mode: "all", styleId: "", templateId: "", maker: "code", motion: { styleId: "kinetic-word", route: "picture", seconds: 5 }, picturesOk: true, arts: { "1": "pic1", "2": "pic2", "3": "pic3" }, slides: [1, 2, 3].map((n) => ({ n, text: `ن${n}`, prompt: `p${n}`, picture: `pic${n}` })), made: [], failed: [], carry: [] };
    db.chat = { id: "chat-1", title: "t", record: "", usd: 0, spentHalalas: 0, updatedAt: "", pending: unfinished, messages: [
      { role: "user", text: START },
      { role: "assistant", text: "تم", slides: { aspect: "9:16", items, todo: [1, 2, 3], failed: [], running: true, total: 3, maker: "code", motion: { styleId: "kinetic-word", route: "picture", seconds: 5 } } },
    ] } as never;
    // he answers the change for slide 3 only, with an empty picture (the same one)
    answer({ produce: { ...empty, on: true, mode: "fix", refs: [], slides: [{ n: 3, text: "ن3", prompt: "p3 changed", picture: "" }] } });
    await say("u", "chat-1", "في الشريحة 3 خل الكتابة فوق", []);
    const p = chat().pending as unknown as { slides: { n: number; prompt: string }[]; arts: Record<string, string>; picturesOk?: boolean };
    expect(p.slides.map((x) => x.n)).toEqual([1, 2, 3]);
    expect(p.slides.find((x) => x.n === 3)!.prompt).toBe("p3 changed");
    expect(p.arts).toEqual({ "1": "pic1", "2": "pic2", "3": "pic3" });
    expect(p.picturesOk).toBe(true);
  });
});

describe("«كمّل الموشن لبقية السلايدات» on a carousel not finished", () => {
  it("goes on with that carousel (its style and pictures) even when he answers it as a new one: no style table again", async () => {
    const items = [1, 2, 3].map((n) => ({ n, fileId: `pic${n}`, name: `picture-0${n}`, text: `ن${n}` }));
    db.chat = { id: "chat-1", title: "t", record: "", usd: 0, spentHalalas: 0, updatedAt: "", pending: null, messages: [
      { role: "user", text: START },
      { role: "assistant", text: "تم", slides: { aspect: "9:16", items, todo: [], failed: [], running: false, total: 3, maker: "code", carouselId: "modern-pixar", paletteId: "ch-f0e5cff7f6f2c8c6c64b6587", motion: { styleId: "kinetic-word", route: "picture", seconds: 5 } } },
    ] } as never;
    answer({ produce: { ...empty, on: true, mode: "all", refs: [], slides: [1, 2, 3].map((n) => ({ n, text: `ن${n}`, prompt: `p${n}`, picture: "" })) } });
    const r = await say("u", "chat-1", "كمل الموشن لبقية السلايدات", []);
    const p = chat().pending as unknown as { mode: string; carouselId?: string; paletteId?: string; slides: { n: number }[]; arts: Record<string, string>; picturesOk?: boolean; motion?: unknown };
    expect(p.mode).toBe("fix");
    expect(p.carouselId).toBe("modern-pixar");
    expect(p.paletteId).toBe("ch-f0e5cff7f6f2c8c6c64b6587");
    expect(p.motion).toBeTruthy();
    expect(p.slides.map((x) => x.n)).toEqual([1, 2, 3]);
    expect(p.arts).toEqual({ "1": "pic1", "2": "pic2", "3": "pic3" });
    expect(p.picturesOk).toBe(true);
    expect(r.text).not.toContain("اختر ستايل");
  });
});

describe("the basic choices are never forgotten", () => {
  const done = () => ({ id: "chat-1", title: "t", record: "", usd: 0, spentHalalas: 0, updatedAt: "", pending: null, messages: [
    { role: "user", text: START },
    { role: "assistant", text: "تم", slides: { aspect: "9:16", items: [1, 2].map((n) => ({ n, fileId: `s${n}`, name: `slide-0${n}`, text: `ن${n}`, video: `v${n}` })), todo: [], failed: [], running: false, total: 2, maker: "code", carouselId: "modern-pixar", paletteId: "ch-f0e5cff7f6f2c8c6c64b6587", fontId: "baloo-bhaijaan-2", motion: { styleId: "kinetic-word", route: "picture", seconds: 5 } } },
  ] });
  it("a new carousel in the same chat keeps the style, colours, font and motion: no table asked again", async () => {
    db.chat = done() as never;
    answer({ produce: { ...empty, on: true, mode: "all", refs: [], slides: [1, 2].map((n) => ({ n, text: `ج${n}`, prompt: `q${n}`, picture: `pic${n}` })) } });
    const r = await say("u", "chat-1", "سو كاروسيل جديد عن الصلاة", []);
    const p = chat().pending as unknown as { mode: string; carouselId?: string; paletteId?: string; fontId?: string; motion?: unknown };
    expect(p.mode).toBe("all");
    expect([p.carouselId, p.paletteId, p.fontId]).toEqual(["modern-pixar", "ch-f0e5cff7f6f2c8c6c64b6587", "baloo-bhaijaan-2"]);
    expect(p.motion).toBeTruthy();
    expect(r.text).not.toContain("اختر ستايل");
  });
  it("asked to change the style, the table is asked", async () => {
    db.chat = done() as never;
    answer({ produce: { ...empty, on: true, mode: "all", refs: [], slides: [1, 2].map((n) => ({ n, text: `ج${n}`, prompt: `q${n}`, picture: `pic${n}` })) } });
    const r = await say("u", "chat-1", "ابي كاروسيل جديد بس غير الستايل", []);
    expect(chat().pending).toBeNull();
    expect(r.questions?.length).toBeGreaterThan(0);
  });
});

describe("the colours the person chose", () => {
  it("replace the style's own: its colour codes and colour words leave the picture's and the slide's prompts (the red came back over her blue)", async () => {
    const { findCarouselStyle, withoutColours, carouselStyleBlock, carouselStyleForCode } = await import("@config/content-carousel-styles");
    const s = findCarouselStyle("modern-pixar")!;
    const clean = withoutColours(s.look);
    for (const x of ["#3A0D1A", "#7A1E33", "#FFC43D", "maroon", "burgundy"]) expect(clean).not.toContain(x);
    // the rest of the look stays
    for (const x of ["Pixar-like", "floating glossy 3D props", "The top 45% stays calm"]) expect(clean).toContain(x);
    expect(carouselStyleBlock(s, true)).not.toContain("#7A1E33");
    expect(carouselStyleForCode(s, true)).not.toContain("#7A1E33");
    // without a palette, the style is told as it is
    expect(carouselStyleBlock(s)).toContain("#7A1E33");
    const produce = readFileSync("src/lib/content/produce.ts", "utf8");
    expect(produce).toContain("withoutColours(car.look)} ${COLOURS_ARE_THE_CLIENTS}");
    expect(produce).toContain("carouselStyleBlock(car, !!pal, !!font)");
    expect(produce).toContain("carouselStyleForCode(car, !!pal, !!font)");
  });
});

describe("the client's choices come first", () => {
  it("wherever the style and the client differ: the style's font gives way to theirs, and every prompt says so", async () => {
    const { findCarouselStyle, carouselStyleBlock, carouselStyleForCode, CLIENT_FIRST } = await import("@config/content-carousel-styles");
    const s = findCarouselStyle("modern-pixar")!;
    expect(carouselStyleBlock(s, false, true)).toContain("the CLIENT'S FONT");
    expect(carouselStyleBlock(s, false, true)).not.toContain(s.type);
    expect(carouselStyleForCode(s, false, true)).not.toContain(s.type);
    const produce = readFileSync("src/lib/content/produce.ts", "utf8");
    expect(produce.match(/CLIENT_FIRST : ""/g)?.length).toBe(3);
    expect(CLIENT_FIRST).toContain("reference picture");
    const { chosenBlock, chosenIds } = await import("@/lib/content/persona");
    expect(chosenBlock(chosenIds([`${STYLE}\n${FONT}`]))).toContain("خيارات العميل مقدَّمة دائمًا");
  });
});
