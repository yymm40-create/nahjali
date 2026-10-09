import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat, Turn } from "@/lib/content/chats";

// One message to «محمد باقر» end to end, with Claude, the database and the editor replaced by stand-ins: what he is
// given (the catalogues, what the person picked, the state of an earlier carousel) and what the site does with his
// answer (the buttons, the carousel to draw, the woman rule, drawing slides again, the hand-over to حيدرة).
const claude = vi.hoisted(() => ({ answer: null as unknown, calls: [] as { system: string; turns: { role: string; content: unknown }[] }[] }));
const db = vi.hoisted(() => ({ chat: null as unknown, editorProjects: [] as unknown[], editorChats: [] as unknown[], assets: [] as unknown[] }));

vi.mock("@/lib/film/anthropic", async (orig) => ({
  ...(await orig<typeof import("@/lib/film/anthropic")>()),
  callClaudeJson: vi.fn(async (o: { system: string; turns: { role: string; content: unknown }[] }) => {
    claude.calls.push({ system: o.system, turns: o.turns });
    return { data: claude.answer, raw: "", usage: { input_tokens: 1000, output_tokens: 500 } };
  }),
}));
vi.mock("@/lib/content/chats", async (orig) => {
  const real = await orig<typeof import("@/lib/content/chats")>();
  return {
    ...real,
    getChat: vi.fn(async () => (db.chat ? structuredClone(db.chat) : null)),
    saveChat: vi.fn(async (_u: string, id: string | null, patch: { messages: Turn[]; record?: string; pending?: unknown; addUsd?: number }) => {
      const c = (db.chat as Chat | null) ?? ({ id: "chat-1", title: "t", record: "", pending: null, usd: 0, updatedAt: "", messages: [] } as Chat);
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
import { WOMAN_WORDING } from "@config/content";
import { findStyle } from "@config/film-styles";
import { styleLine, templateLine } from "@/lib/content/marks";

const empty = { on: false, mode: "all", aspect: "1:1", template_id: "", style_id: "", slides: [] };
const noHandoff = { on: false, title: "", shape: "9:16", package: "" };
const answer = (o: Record<string, unknown>) => {
  claude.answer = { reply: "ردّي", questions: [], record: "", produce: empty, handoff: noHandoff, ...o };
};
const slides = (prompt = "clean design") => [{ n: 1, text: "العنوان", prompt: `${prompt} "العنوان"` }, { n: 2, text: "الخطوة", prompt: `${prompt} "الخطوة"` }];
const chat = () => db.chat as Chat;

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
      id: "chat-1", title: "t", record: "REC", pending: null, usd: 0, updatedAt: "",
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
  });
});

describe("his answer", () => {
  it("the questions become buttons, kept with the answer", async () => {
    answer({ questions: [{ label: "المنصة؟", kind: "choice", options: ["انستغرام", "لينكدإن"], multi: false }, { label: "القالب؟", kind: "templates", options: [], multi: false }, { label: "فارغ", kind: "choice", options: [], multi: false }] });
    const r = await say("u", null, "أبي كاروسيل", []);
    expect(r.questions).toEqual([{ label: "المنصة؟", kind: "choice", options: ["انستغرام", "لينكدإن"], multi: false }, { label: "القالب؟", kind: "templates", options: [], multi: false }]);
    expect(r.pending).toBeNull();
    expect(chat().messages[1].questions).toHaveLength(2);
  });

  it("a carousel ordered: it waits to be drawn with the valid template and style, and its slides appear as placeholders", async () => {
    answer({ produce: { on: true, mode: "all", aspect: "2:3", template_id: "scrapbook", style_id: "ghibli", slides: slides() } });
    const r = await say("u", null, "أنتج", []);
    expect(r.pending).toEqual({ total: 2, mode: "all", todo: [1, 2] });
    expect(chat().pending).toMatchObject({ aspect: "2:3", templateId: "scrapbook", styleId: "ghibli", mode: "all", at: 1 });
    expect(chat().messages[1].slides).toMatchObject({ todo: [1, 2], running: true, total: 2 });
    // an id the site doesn't know is dropped, not trusted
    answer({ produce: { on: true, mode: "all", aspect: "9:99", template_id: "nope", style_id: "nope", slides: slides() } });
    db.chat = null;
    await say("u", null, "أنتج", []);
    expect(chat().pending).toMatchObject({ aspect: "1:1", templateId: "", styleId: "" });
    expect(findStyle("ghibli")).toBeDefined();
  });

  it("the woman rule: a prompt that draws a woman any other way is not ordered; the allowed wording is", async () => {
    answer({ produce: { on: true, mode: "all", aspect: "1:1", template_id: "", style_id: "", slides: [{ n: 1, text: "أ", prompt: "a woman holding a cup \"أ\"" }] } });
    const bad = await say("u", null, "أنتج", []);
    expect(bad.pending).toBeNull();
    expect(chat().pending).toBeNull();
    expect(bad.text).toContain("لم يُنتج الكاروسيل");
    expect(bad.text).toContain("عباية سوداء");

    db.chat = null;
    answer({ produce: { on: true, mode: "all", aspect: "1:1", template_id: "", style_id: "", slides: [{ n: 1, text: "أ", prompt: `a woman holding a cup. ${WOMAN_WORDING} "أ"` }] } });
    const ok = await say("u", null, "أنتج", []);
    expect(ok.pending).toMatchObject({ total: 1 });
  });

  it("slides drawn again: only those slides, in the carousel that exists, with its style kept", async () => {
    db.chat = {
      id: "chat-1", title: "t", record: "", pending: null, usd: 0, updatedAt: "",
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
});
