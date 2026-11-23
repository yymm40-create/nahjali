import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat, Turn } from "@/lib/content/chats";

// «صانع المحتوى» · every conversation is a project (the owner, 23 Nov 2026): a carousel «حيدرا ماكس» takes part in is
// made in TWO chats — its pictures first (painted by GPT Image 2, or drawn by him in code with no writing), approved,
// then handed with a delivery message to the second chat where he writes (and moves) the slides; a picture changed
// later in the first chat is handed on again. «خزان المراجع والثوابت» goes with every slide.
const db = vi.hoisted(() => ({ chat: null as unknown, files: new Map<string, { path: string; name: string; meta: Record<string, unknown> }>(), next: 0, store: null as unknown }));
const gen = vi.hoisted(() => ({ calls: [] as { prompt: string }[] }));

vi.mock("@/lib/content/jawad", async (orig) => {
  const real = await orig<typeof import("@/lib/content/jawad")>();
  return {
    ...real,
    deskReference: vi.fn(async () => "11111111-1111-1111-1111-111111111111"),
    deskImage: vi.fn(async (_who: unknown, o: { prompt: string }) => {
      gen.calls.push({ prompt: o.prompt });
      const n = gen.calls.length;
      return {
        out: { jobId: `job-${n}`, outputId: `out-${n}`, path: `jawad/out-${n}.png`, mime: "image/png", kind: "image", width: 1024, height: 1024, durationMs: null },
        bytes: Buffer.from(`png-${n}`),
        receipt: { generatorId: "openai-gpt-image-2", generator: "GPT Image 2", settings: {}, coins: 0, free: true, jobId: `job-${n}` },
      };
    }),
  };
});
vi.mock("@/lib/content/verify", async (orig) => {
  const real = await orig<typeof import("@/lib/content/verify")>();
  return { ...real, showsRealWoman: vi.fn(async () => ({ woman: false, usd: 0 })) };
});
vi.mock("@/lib/content/chats", async (orig) => {
  const real = await orig<typeof import("@/lib/content/chats")>();
  return {
    ...real,
    getChat: vi.fn(async () => (db.chat ? structuredClone(db.chat) : null)),
    saveChat: vi.fn(async (_u: string, _id: string, patch: { messages: Turn[]; pending?: unknown; addUsd?: number }) => {
      const c = db.chat as Chat;
      c.messages = structuredClone(patch.messages);
      if (patch.pending !== undefined) c.pending = structuredClone(patch.pending) as Chat["pending"];
      return c.id;
    }),
  };
});
const addFile = (name: string, meta: Record<string, unknown>) => {
  const id = `file-${++db.next}`;
  db.files.set(id, { path: `p/${id}`, name, meta });
  return { id, path: `p/${id}`, name, bytes: 10 };
};
vi.mock("@/lib/content/files", () => ({
  addProducedFromOutput: vi.fn(async (o: { name: string; meta: Record<string, unknown> }) => addFile(o.name, o.meta)),
  addProduced: vi.fn(async (o: { name: string; meta: Record<string, unknown> }) => addFile(o.name, o.meta)),
  attachmentsOf: vi.fn(async () => ({ list: [], rows: [] })),
  producedBytes: vi.fn(async (_u: string, id: string) => Buffer.from(`bytes-${id}`)),
  producedRow: vi.fn(async (_u: string, id: string) => (db.files.has(id) ? { id, ...db.files.get(id)! } : null)),
  producedLinks: vi.fn(async () => new Map([...db.files.keys()].map((id) => [id, `https://x/${id}`]))),
  uploadLinks: vi.fn(async (_u: string, ids: string[]) => new Map(ids.map((id) => [id, `https://up/${id}`]))),
  slidePicture: vi.fn(async (_u: string, _c: string, n: number) => [...db.files.entries()].reverse().find(([, f]) => f.name === `picture-${String(n).padStart(2, "0")}`)?.[0] ?? null),
  deleteProduced: vi.fn(async (_u: string, id: string) => void db.files.delete(id)),
}));
vi.mock("@/lib/content/project", async (orig) => {
  const real = await orig<typeof import("@/lib/content/project")>();
  return { ...real, getStore: vi.fn(async () => db.store ?? real.EMPTY_STORE) };
});
vi.mock("@/lib/jawad/server/uploads", () => ({ drawnPng: vi.fn(async (_u: string, b: { png?: string }) => (b.png ? Buffer.from(b.png, "base64") : null)) }));

import { produce, produceFromCode, planPictureRedo } from "@/lib/content/produce";
import { addToStore, handOff, lookLines, readStore, storeBrief, storeNote, threadTurns, EMPTY_STORE } from "@/lib/content/project";

let PNG = "";
const slide = (n: number) => ({ n, text: `نص ${n}`, prompt: `slide ${n} prompt "نص ${n}"` });
const start = (n: number, o: Record<string, unknown> = {}) => {
  db.chat = {
    id: "chat-1", title: "كاروسيل العادات", record: "كاروسيل عن العادات", usd: 0, updatedAt: "", spentHalalas: 0,
    messages: [{ role: "user", text: "أنتج" }, { role: "assistant", text: "تمام", slides: { aspect: "1:1", items: [], todo: Array.from({ length: n }, (_, i) => i + 1), failed: [], running: true, total: n, styleId: "", templateId: "", maker: "code", split: true } }],
    pending: { id: "batch-1", aspect: "1:1", slides: Array.from({ length: n }, (_, i) => slide(i + 1)), at: 1, styleId: "", templateId: "", mode: "all", maker: "code", split: true, made: [], failed: [], carry: [], ...o },
  };
};
const state = () => db.chat as Chat;

beforeEach(async () => {
  process.env.OPENAI_API_KEY = "test";
  db.chat = null;
  db.files.clear();
  db.next = 0;
  db.store = null;
  gen.calls.length = 0;
  if (!PNG) {
    const sharp = (await import("sharp")).default;
    PNG = (await sharp({ create: { width: 8, height: 8, channels: 3, background: "#123456" } }).png().toBuffer()).toString("base64");
  }
});

describe("«حيدرا ماكس» alone: two chats", () => {
  it("draws every slide's PICTURE first in code, with no writing, then waits for the approval", async () => {
    start(2);
    const a = await produce("u", "chat-1");
    expect(gen.calls).toHaveLength(0);
    expect(a.phase).toBe("pictures");
    expect(a.code?.n).toBe(1);
    expect(a.code?.stage).toBe("picture");
    expect(a.code?.prompt).toContain("Write NO text at all");
    // the text guard is not asked for a picture with no writing
    expect(a.code?.text).toBeUndefined();

    const b = await produceFromCode("u", "chat-1", { n: 1, png: PNG, stage: "picture" });
    expect(b.phase).toBe("pictures");
    expect(state().pending!.arts?.["1"]).toBeTruthy();
    expect(db.files.get(state().pending!.arts!["1"])!.name).toBe("picture-01");
    const c = await produce("u", "chat-1");
    expect(c.code?.n).toBe(2);
    expect(c.code?.stage).toBe("picture");
    const d = await produceFromCode("u", "chat-1", { n: 2, png: PNG, stage: "picture" });
    expect(d.phase).toBe("approve");
    expect(d.running).toBe(false);
    expect(state().pending!.made).toHaveLength(0);
  });

  it("approving hands the pictures to the second chat with a delivery message, and the slides are written there", async () => {
    start(2);
    await produce("u", "chat-1");
    await produceFromCode("u", "chat-1", { n: 1, png: PNG, stage: "picture" });
    await produce("u", "chat-1");
    await produceFromCode("u", "chat-1", { n: 2, png: PNG, stage: "picture" });

    const r = await produce("u", "chat-1", { approvePictures: true });
    expect(r.reopen).toBe(true);
    const m = state().messages;
    expect(m).toHaveLength(3);
    expect(m[1].slides!.approved).toBe(true);
    expect(m[2].thread).toBe("design");
    expect(m[2].handoff).toBe(true);
    expect(m[2].text).toContain("رسالة التسليم");
    expect(m[2].text).toContain("نص 1");
    expect(state().pending!.at).toBe(2);
    expect(state().pending!.picturesOk).toBe(true);

    // in the second chat: he writes slide 1 over the picture he drew and the person approved
    const w = await produce("u", "chat-1");
    expect(w.code?.n).toBe(1);
    expect(w.code?.stage).toBeUndefined();
    expect(w.code?.photos).toHaveLength(1);
    expect(w.code?.prompt).toContain("you drew in code in stage 1");
    expect(w.code?.text).toBe("نص 1");
    const made = await produceFromCode("u", "chat-1", { n: 1, png: PNG });
    expect(made.at).toBe(2);
    expect(state().messages[2].slides!.items.find((x) => x.n === 1)!.name).toBe("slide-01");
    // the first chat's pictures stay as they were approved
    expect(state().messages[1].slides!.items.every((x) => x.name.startsWith("picture-"))).toBe(true);
  });

  it("a picture changed in the first chat after the handoff is drawn again, approved, and handed on as an update", async () => {
    start(1);
    await produce("u", "chat-1");
    await produceFromCode("u", "chat-1", { n: 1, png: PNG, stage: "picture" });
    await produce("u", "chat-1", { approvePictures: true });
    await produce("u", "chat-1");
    await produceFromCode("u", "chat-1", { n: 1, png: PNG });
    expect(state().pending).toBeNull();

    const r = await produce("u", "chat-1", { redoApproved: [{ n: 1, note: "خل الخلفية ليل" }] });
    expect(r.reopen).toBe(true);
    expect(state().pending!.at).toBe(1);
    expect(state().messages[1].slides!.approved).toBeUndefined();
    const p = await produce("u", "chat-1");
    expect(p.code?.stage).toBe("picture");
    expect(p.code?.prompt).toContain("خل الخلفية ليل");
    const q = await produceFromCode("u", "chat-1", { n: 1, png: PNG, stage: "picture" });
    expect(q.phase).toBe("approve");
    const h = await produce("u", "chat-1", { approvePictures: true });
    expect(h.reopen).toBe(true);
    const m = state().messages;
    expect(m[m.length - 1].thread).toBe("design");
    expect(m[m.length - 1].text).toContain("تحديث من محادثة الصور");
    expect(m[1].slides!.approved).toBe(true);
    const w = await produce("u", "chat-1");
    expect(w.code?.n).toBe(1);
    expect(w.code?.photos).toHaveLength(1);
  });
});

describe("GPT Image 2's pictures + «حيدرا ماكس»'s writing: two chats", () => {
  it("paints the pictures, then hands them on when approved", async () => {
    start(2, { mix: true });
    const a = await produce("u", "chat-1");
    expect(gen.calls).toHaveLength(1);
    expect(a.code).toBeUndefined();
    await produce("u", "chat-1");
    const b = await produce("u", "chat-1");
    expect(b.phase).toBe("approve");
    const r = await produce("u", "chat-1", { approvePictures: true });
    expect(r.reopen).toBe(true);
    expect(state().messages[2].handoff).toBe(true);
    const w = await produce("u", "chat-1");
    expect(w.code?.mix).toBe(true);
    expect(w.code?.prompt).toContain("painted by GPT Image 2");
  });

  it("the store's rules go with every picture and every slide", async () => {
    db.store = { approved: ["الشخصية بثوب أزرق دائمًا"], removed: ["خلفيات سوداء"], notes: ["كتابة كبيرة"], refs: [] };
    start(1, { mix: true });
    await produce("u", "chat-1");
    expect(gen.calls[0].prompt).toContain("الشخصية بثوب أزرق دائمًا");
    expect(gen.calls[0].prompt).toContain("never use any of it): خلفيات سوداء");
    await produce("u", "chat-1", { approvePictures: true });
    const w = await produce("u", "chat-1");
    expect(w.code?.prompt).toContain("كتابة كبيرة");
  });
});

describe("one chat stays one chat", () => {
  it("a carousel made the old way (no split) is designed straight after its pictures are approved", async () => {
    start(1, { mix: true, split: undefined });
    await produce("u", "chat-1");
    const r = await produce("u", "chat-1", { approvePictures: true });
    expect(r.reopen).toBeUndefined();
    expect(r.code?.n).toBe(1);
    expect(state().messages).toHaveLength(2);
  });
});

describe("the project's pieces", () => {
  it("each chat gives «محمد باقر» only its own talk; the second starts from the delivery message", () => {
    const h: Turn[] = [
      { role: "user", text: "سو كاروسيل" },
      { role: "assistant", text: "هذي الصور" },
      { role: "assistant", text: "📨 رسالة التسليم…", thread: "design", handoff: true },
      { role: "user", text: "كبّر الخط", thread: "design" },
      { role: "assistant", text: "تمام", thread: "design" },
      { role: "user", text: "غيّر صورة ٢" },
    ];
    const first = threadTurns(h, "pictures");
    expect(first.map((t) => t.text)).toEqual(["سو كاروسيل", "هذي الصور", "غيّر صورة ٢"]);
    const second = threadTurns(h, "design");
    expect(second[0].role).toBe("user");
    expect(second[0].text).toContain("رسالة التسليم");
    expect(second[0].text).toContain("كبّر الخط");
    expect(second.map((t) => t.role)).toEqual(["user", "assistant"]);
    // a project of one chat is untouched
    const one: Turn[] = [{ role: "user", text: "a" }, { role: "assistant", text: "b" }];
    expect(threadTurns(one, "pictures")).toEqual(one);
  });

  it("the store is checked, lines added in words land in their list, and a removed thing is no longer fixed", () => {
    const s = readStore({ approved: ["  أزرق  ", "أزرق", 5], removed: [], notes: ["x".repeat(900)], refs: [{ id: "bad" }, { id: "11111111-1111-1111-1111-111111111111", name: "مرجع" }] });
    expect(s.approved).toEqual(["أزرق"]);
    expect(s.notes[0]).toHaveLength(400);
    expect(s.refs).toHaveLength(1);
    const a = addToStore(s, [{ kind: "removed", text: "أزرق" }, { kind: "note", text: "بدون إيموجي" }, { kind: "other", text: "x" }]);
    expect(a.changed).toBe(true);
    expect(a.store.approved).toEqual([]);
    expect(a.store.removed).toEqual(["أزرق"]);
    expect(a.store.notes).toContain("بدون إيموجي");
    expect(addToStore(a.store, []).changed).toBe(false);
  });

  it("«محمد باقر» and «حيدرا ماكس» are told the store; an empty one says nothing", () => {
    expect(storeNote(EMPTY_STORE, [])).toBe("");
    expect(storeBrief(EMPTY_STORE)).toBe("");
    const note = storeNote({ approved: ["ثوب أزرق"], removed: ["أسود"], notes: [], refs: [{ id: "x", name: "مرجع", note: "الإضاءة" }] }, ["الخط: ثمانية"]);
    expect(note).toContain("خزان المراجع والثوابت");
    expect(note).toContain("ثوب أزرق");
    expect(note).toContain("لا يُستخدم أبدًا");
    expect(note).toContain("مرجع: الإضاءة");
    expect(note).toContain("الخط: ثمانية");
  });

  it("the look fixed by the choices reads in plain words", () => {
    expect(lookLines(null)).toEqual([]);
    expect(lookLines({ maker: "code", mix: true })).toContain("التصميم: GPT Image 2 للصور + حيدرا ماكس للكتابة");
  });

  it("a new carousel ordered in the first chat gets its own delivery message (not an update of the old one)", () => {
    const msgs: Turn[] = [
      { role: "assistant", text: "a", slides: { aspect: "1:1", items: [], todo: [], failed: [], running: false, total: 1, styleId: "", templateId: "", approved: true } },
      { role: "assistant", text: "📨", thread: "design", handoff: true, slides: { aspect: "1:1", items: [], todo: [], failed: [], running: false, total: 1, styleId: "", templateId: "" } },
      { role: "assistant", text: "new pictures", slides: { aspect: "1:1", items: [], todo: [1], failed: [], running: false, total: 1, styleId: "", templateId: "" } },
    ];
    const p = { id: "b2", aspect: "1:1" as const, slides: [slide(1)], at: 2, styleId: "", templateId: "", mode: "all" as const, maker: "code" as const, split: true, made: [], failed: [], carry: [] };
    const out = handOff({ title: "ب", record: "" }, msgs, p, EMPTY_STORE);
    expect(out[3].text).toContain("رسالة التسليم");
    expect(p.at).toBe(3);
  });

  it("a picture can only be changed once nothing is being made", async () => {
    start(1);
    await expect(planPictureRedo("u", state(), [{ n: 1 }])).rejects.toThrow("استنى");
  });
});
