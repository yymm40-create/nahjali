import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeskError } from "@/lib/content/jawad";
import type { Chat, Turn } from "@/lib/content/chats";

// The produce step end to end, with the image generator, the check, the storage and the database replaced by
// stand-ins: the order the slides are drawn in, the reference, a refusal for a moment, the redraw after the check
// finds a mistake, the dress rule, what is kept when a slide fails, and a slide drawn again in a carousel that exists.
const db = vi.hoisted(() => ({ chat: null as unknown, files: new Map<string, { path: string; name: string; meta: Record<string, unknown> }>(), deleted: [] as string[], next: 0 }));
const gen = vi.hoisted(() => ({ calls: [] as { prompt: string; refs: number; key: string; kind: string }[], script: [] as (Error | "ok")[] }));
const chk = vi.hoisted(() => ({ script: [] as ("ok" | "bad" | "woman" | "unchecked")[], calls: [] as string[] }));

vi.mock("@/lib/content/jawad", async (orig) => {
  const real = await orig<typeof import("@/lib/content/jawad")>();
  return {
    ...real,
    deskReference: vi.fn(async () => "11111111-1111-1111-1111-111111111111"),
    deskImage: vi.fn(async (_who: unknown, o: { prompt: string; refs?: unknown[]; key: string; kind: string }) => {
      gen.calls.push({ prompt: o.prompt, refs: o.refs?.length ?? 0, key: o.key, kind: o.kind });
      const step = gen.script.shift() ?? "ok";
      if (step !== "ok") throw step;
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
  return {
    ...real,
    checkSlide: vi.fn(async (_png: Buffer, expected: string) => {
      chk.calls.push(expected);
      const step = chk.script.shift() ?? "ok";
      if (step === "ok") return { ok: true, checked: true, problems: [], woman: "none", read: "", usd: 0.01 };
      if (step === "unchecked") return { ok: true, checked: false, problems: [], woman: "none", read: "", usd: 0 };
      if (step === "woman") return { ok: false, checked: true, problems: ["امرأة بلباس غير مسموح"], woman: "violation", read: "", usd: 0.01 };
      return { ok: false, checked: true, problems: ["حرف مقطوع في الكلمة الثانية"], woman: "none", read: "", usd: 0.01 };
    }),
  };
});
vi.mock("@/lib/content/chats", () => ({
  getChat: vi.fn(async () => (db.chat ? structuredClone(db.chat) : null)),
  saveChat: vi.fn(async (_u: string, _id: string, patch: { messages: Turn[]; pending?: unknown; addUsd?: number }) => {
    const c = db.chat as Chat;
    c.messages = structuredClone(patch.messages);
    if (patch.pending !== undefined) c.pending = structuredClone(patch.pending) as Chat["pending"];
    c.usd += patch.addUsd ?? 0;
    return c.id;
  }),
}));
vi.mock("@/lib/content/files", () => ({
  addProducedFromOutput: vi.fn(async (o: { name: string; meta: Record<string, unknown> }) => {
    const id = `file-${++db.next}`;
    db.files.set(id, { path: `p/${id}`, name: o.name, meta: o.meta });
    return { id, path: `p/${id}`, name: o.name, bytes: 10 };
  }),
  producedBytes: vi.fn(async (_u: string, id: string) => Buffer.from(`bytes-${id}`)),
  producedRow: vi.fn(async (_u: string, id: string) => (db.files.has(id) ? { id, ...db.files.get(id)! } : null)),
  deleteProduced: vi.fn(async (_u: string, id: string) => {
    db.deleted.push(id);
    db.files.delete(id);
  }),
}));

import { produce, tuning, UNCHECKED } from "@/lib/content/produce";

const slide = (n: number) => ({ n, text: `نص ${n}`, prompt: `slide ${n} prompt "نص ${n}"` });
const pending = (n: number, o: Record<string, unknown> = {}) => ({
  id: "batch-1", aspect: "1:1", slides: Array.from({ length: n }, (_, i) => slide(i + 1)), at: 1, styleId: "", templateId: "", mode: "all", made: [], failed: [], carry: [], ...o,
});
const start = (n: number, o: Record<string, unknown> = {}) => {
  db.chat = {
    id: "chat-1", title: "t", record: "", usd: 0, updatedAt: "",
    messages: [{ role: "user", text: "أنتج" }, { role: "assistant", text: "تمام", slides: { aspect: "1:1", items: [], todo: Array.from({ length: n }, (_, i) => i + 1), failed: [], running: true, total: n, styleId: "", templateId: "" } }],
    pending: pending(n, o),
  };
};
const state = () => db.chat as Chat;
const block = () => state().messages[1].slides!;

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test";
  db.chat = null;
  db.files.clear();
  db.deleted.length = 0;
  db.next = 0;
  gen.calls.length = 0;
  gen.script.length = 0;
  chk.script.length = 0;
  chk.calls.length = 0;
  tuning.pauseMs = 1;
});

describe("drawing a carousel", () => {
  it("draws slide 1 alone, then the rest with it as their reference, then reports", async () => {
    start(4);
    const a = await produce("u", "chat-1");
    expect(gen.calls).toHaveLength(1);
    expect(gen.calls[0].refs).toBe(0);
    expect(a.running).toBe(true);
    expect(a.todo).toEqual([2, 3, 4]);
    expect(a.slides.map((s) => s.n)).toEqual([1]);
    expect(state().pending).not.toBeNull();
    expect(block().running).toBe(true);

    const b = await produce("u", "chat-1");
    expect(gen.calls).toHaveLength(3);
    expect(gen.calls.slice(1).every((c) => c.refs === 1)).toBe(true);
    expect(gen.calls[1].prompt).toContain("slide 1");
    expect(b.running).toBe(true);
    const b2 = await produce("u", "chat-1");
    expect(gen.calls).toHaveLength(4);
    expect(b2.running).toBe(false);
    expect(b2.slides.map((s) => s.n)).toEqual([1, 2, 3, 4]);
    expect(state().pending).toBeNull();
    expect(b2.report).toContain("سليمة: 4 من 4");
    expect(block().report).toBe(b2.report);
    expect(block().running).toBe(false);
    expect(state().usd).toBeCloseTo(4 * 0.01, 5);
  });

  it("hands each slide to جواد as its own request with a key of its own", async () => {
    start(3);
    await produce("u", "chat-1");
    await produce("u", "chat-1");
    expect(gen.calls.every((c) => c.kind === "image")).toBe(true);
    expect(new Set(gen.calls.map((c) => c.key)).size).toBe(gen.calls.length);
    expect(gen.calls.every((c) => /^[A-Za-z0-9_-]{8,80}$/.test(c.key))).toBe(true);
    expect([...db.files.values()].every((f) => (f.meta.desk as { generatorId: string }).generatorId === "openai-gpt-image-2")).toBe(true);
  });

  it("draws at most two at a time after the first", async () => {
    start(6);
    await produce("u", "chat-1");
    const b = await produce("u", "chat-1");
    expect(b.running).toBe(true);
    expect(b.slides.map((s) => s.n)).toEqual([1, 2, 3]);
    const c = await produce("u", "chat-1");
    expect(c.slides.map((s) => s.n)).toEqual([1, 2, 3, 4, 5]);
    const d = await produce("u", "chat-1");
    expect(d.running).toBe(false);
    expect(d.slides).toHaveLength(6);
  });

  it("tries again after a moment's refusal, and does not for a policy refusal", async () => {
    start(2);
    gen.script.push(new DeskError("المزوّد مشغول حاليًا. جرّب بعد قليل.", "429 rate_limit", true));
    const a = await produce("u", "chat-1");
    expect(gen.calls).toHaveLength(2);
    expect(a.slides.map((s) => s.n)).toEqual([1]);
    expect(a.failed).toEqual([]);

    start(2);
    gen.calls.length = 0;
    gen.script.push(new DeskError("رفض المزوّد الطلب لأنه قد يخالف سياسة المحتوى.", "400 content_policy_violation"));
    const b = await produce("u", "chat-1");
    expect(gen.calls).toHaveLength(1);
    expect(b.failed).toHaveLength(1);
    expect(b.failed[0]).toMatchObject({ n: 1, reason: "رفض المزوّد الطلب لأنه قد يخالف سياسة المحتوى." });
    expect(b.failed[0].detail).toBeUndefined();
    // slide 1 failed for good: the next call draws slide 2 (no reference to give), and the report says what failed
    const c = await produce("u", "chat-1");
    expect(c.running).toBe(false);
    expect(c.report).toContain("❌ لم تُصنع: الشريحة 1");
  });

  it("gives the owner the technical reason too", async () => {
    start(1);
    gen.script.push(new DeskError("رفض", "400 invalid_request: size"));
    const r = await produce("u", "chat-1", { owner: true });
    expect(r.failed[0].detail).toContain("invalid_request");
  });

  it("draws a slide again once when the check finds a mistake, with the problem in the prompt, and says so", async () => {
    start(1);
    chk.script.push("bad", "ok");
    const r = await produce("u", "chat-1");
    expect(gen.calls).toHaveLength(2);
    expect(gen.calls[1].prompt).toContain("حرف مقطوع في الكلمة الثانية");
    expect(gen.calls[1].prompt).toContain('"نص 1"');
    expect(r.slides[0].fixed).toBe(true);
    expect(r.slides[0].flag).toBeUndefined();
    expect(r.report).toContain("أُعيد رسم 1 شريحة تلقائيًا");
  });

  it("keeps a slide that is still wrong after the tries, flagged, and reports it plainly", async () => {
    start(1);
    chk.script.push("bad", "bad", "bad");
    const r = await produce("u", "chat-1");
    expect(gen.calls.length).toBeGreaterThanOrEqual(2);
    expect(r.slides).toHaveLength(1);
    expect(r.slides[0].flag).toContain("حرف مقطوع");
    expect(r.report).toContain("فيها ملاحظة بعد المحاولات: الشريحة 1");
  });

  it("never keeps a woman in a wrong dress", async () => {
    start(1);
    chk.script.push("woman", "woman", "woman");
    const r = await produce("u", "chat-1");
    expect(r.slides).toHaveLength(0);
    expect(r.failed[0].reason).toContain("قاعدة اللباس");
    expect([...db.files.values()]).toHaveLength(0);
  });

  it("keeps a slide whose check could not run and says it is unchecked", async () => {
    start(1);
    chk.script.push("unchecked");
    const r = await produce("u", "chat-1");
    expect(r.slides[0].flag).toBe(UNCHECKED);
    expect(r.report).toContain("تعذّر الفحص الآلي لـ 1 شريحة");
    expect(r.report).not.toContain("فيها ملاحظة");
  });

  it("puts the chosen cartoon style into every slide, verbatim", async () => {
    start(2, { styleId: "ghibli" });
    await produce("u", "chat-1");
    expect(gen.calls[0].prompt).toContain("ILLUSTRATION STYLE");
  });
});

describe("drawing slides again in a carousel that exists", () => {
  const exists = () => {
    db.files.set("old-1", { path: "p/old-1", name: "slide-01", meta: { prompt: "slide 1 prompt", text: "نص 1" } });
    db.files.set("old-2", { path: "p/old-2", name: "slide-02", meta: { prompt: "slide 2 prompt", text: "نص 2" } });
    db.chat = {
      id: "chat-1", title: "t", record: "", usd: 0, updatedAt: "", pending: null,
      messages: [
        { role: "user", text: "أنتج" },
        {
          role: "assistant", text: "تمام",
          slides: {
            aspect: "1:1", todo: [], running: false, total: 3, styleId: "", templateId: "", report: "قديم",
            items: [{ n: 1, fileId: "old-1", name: "slide-01", text: "نص 1" }, { n: 2, fileId: "old-2", name: "slide-02", text: "نص 2", flag: "حرف مقطوع" }],
            failed: [{ n: 3, reason: "مشغول", text: "نص 3", prompt: "slide 3 prompt" }],
          },
        },
      ],
    };
  };

  it("draws one made slide again with slide 1 as its reference, replaces it, and keeps the others and the failure", async () => {
    exists();
    const r = await produce("u", "chat-1", { retry: [2] });
    expect(gen.calls).toHaveLength(1);
    expect(gen.calls[0].refs).toBe(1);
    expect(gen.calls[0].prompt).toContain("slide 2 prompt");
    expect(r.running).toBe(false);
    expect(r.slides.map((s) => s.n)).toEqual([1, 2]);
    const two = r.slides.find((s) => s.n === 2)!;
    expect(two.fileId).not.toBe("old-2");
    expect(two.flag).toBeUndefined();
    expect(r.slides.find((s) => s.n === 1)!.fileId).toBe("old-1");
    expect(db.deleted).toEqual(["old-2"]);
    expect(r.failed.map((f) => f.n)).toEqual([3]);
    expect(state().pending).toBeNull();
  });

  it("draws the failed ones again with their kept prompts", async () => {
    exists();
    const r = await produce("u", "chat-1", { retry: "failed" });
    expect(gen.calls[0].prompt).toContain("slide 3 prompt");
    expect(r.slides.map((s) => s.n)).toEqual([1, 2, 3]);
    expect(r.failed).toEqual([]);
    expect(db.deleted).toEqual([]);
  });

  it("says plainly when there is nothing to draw again", async () => {
    exists();
    await expect(produce("u", "chat-1", { retry: [9] })).rejects.toThrow("ما لقينا شرائح");
    db.chat = { id: "chat-1", title: "", record: "", usd: 0, updatedAt: "", pending: null, messages: [] };
    await expect(produce("u", "chat-1")).rejects.toThrow("ما فيه كاروسيل ينتظر");
  });
});
