import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat, MediaItem } from "@/lib/content/chats";

// 100 tests of the bridge between «محمد باقر» and جواد, with the job system, the storage and the database replaced:
// what Baqir asks for reaches جواد's desk with the right settings, جواد makes it, the answer comes back to the chat.
const st = vi.hoisted(() => ({
  chat: null as unknown,
  img: [] as Record<string, unknown>[],
  vid: [] as Record<string, unknown>[],
  imgScript: [] as unknown[],
  vidScript: [] as unknown[],
  checkScript: [] as string[],
  states: new Map<string, unknown[]>(),
  files: [] as Record<string, unknown>[],
  deleted: [] as string[],
  n: 0,
}));

vi.mock("@/lib/content/chats", async (orig) => {
  const real = await orig<typeof import("@/lib/content/chats")>();
  return {
    ...real,
    getChat: vi.fn(async () => (st.chat ? structuredClone(st.chat) : null)),
    saveChat: vi.fn(async (_u: string, _id: string, p: { messages: unknown[] }) => {
      (st.chat as Chat).messages = structuredClone(p.messages) as Chat["messages"];
      return "c";
    }),
  };
});
vi.mock("@/lib/content/files", () => ({
  addProducedFromOutput: vi.fn(async (o: Record<string, unknown>) => {
    st.files.push(o);
    return { id: `f${++st.n}`, path: "p", name: String(o.name), bytes: 0 };
  }),
  deleteProduced: vi.fn(async (_u: string, id: string) => void st.deleted.push(id)),
  attachmentsOf: vi.fn(async (_u: string, ids: string[]) => ({ list: ids.map((id) => ({ id, kind: id.startsWith("vid") ? "video" : "image", name: id, durationMs: null })), rows: [] })),
}));
vi.mock("@/lib/content/verify", () => ({
  checkSlide: vi.fn(async () => ({ ok: true, checked: true, problems: [], woman: st.checkScript.shift() ?? "none", read: "", usd: 0.01 })),
}));
vi.mock("@/lib/content/jawad", async (orig) => {
  const real = await orig<typeof import("@/lib/content/jawad")>();
  const receipt = (jobId: string) => ({ generatorId: "g", generator: "GPT Image 2", settings: {}, coins: 0, free: true, jobId });
  return {
    ...real,
    deskImage: vi.fn(async (_w: unknown, r: Record<string, unknown>) => {
      st.img.push(r);
      const s = st.imgScript.shift();
      if (s instanceof Error) throw s;
      const id = `ij${st.img.length}`;
      return { out: { jobId: id, outputId: `o${id}`, path: "x.png", mime: "image/png", kind: "image", width: 1, height: 1, durationMs: null }, bytes: Buffer.from("x"), receipt: receipt(id) };
    }),
    deskVideo: vi.fn(async (_w: unknown, r: Record<string, unknown>) => {
      st.vid.push(r);
      const s = st.vidScript.shift();
      if (s instanceof Error) throw s;
      return receipt(`vj${st.vid.length}`);
    }),
    deskCheck: vi.fn(async (_u: string, jobId: string) => {
      const q = st.states.get(jobId) ?? [{ state: "done" }];
      const s = (q.length > 1 ? q.shift() : q[0]) as { state: string; error?: unknown };
      return s.state === "done" ? { state: "done", out: { jobId, outputId: `o${jobId}`, path: "v.mp4", mime: "video/mp4", kind: "video", width: 1, height: 1, durationMs: 5000 } } : s;
    }),
  };
});

import { DeskError, deskSettings, DESK_GENERATOR } from "@/lib/content/jawad";
import { stepMedia } from "@/lib/content/media";
import { generatorById } from "@config/jawad/generators";
import { womanCheck } from "@config/content";

const item = (o: Partial<MediaItem> = {}): MediaItem => ({ id: "m1", kind: "image", name: "غلاف", prompt: "a cover", aspect: "1:1", refs: [], state: "todo", ...o });
const start = (items: MediaItem[]) => {
  st.chat = { id: "c", title: "t", record: "", usd: 0, updatedAt: "", pending: null, messages: [{ role: "user", text: "ولّد" }, { role: "assistant", text: "تمام", media: { items } }] };
};
const got = () => (st.chat as Chat).messages[1].media!.items;
const step = (o: Parameters<typeof stepMedia>[2] = {}) => stepMedia("u", "c", { origin: "https://x.test", ...o });

beforeEach(() => {
  st.chat = null;
  st.img.length = st.vid.length = st.imgScript.length = st.vidScript.length = st.checkScript.length = st.files.length = st.deleted.length = 0;
  st.states.clear();
  st.n = 0;
});

describe("pictures: what Baqir asks reaches جواد as asked (30)", () => {
  const cases = ["1:1", "16:9", "9:16", "3:2", "2:3"].flatMap((aspect) => ["low", "medium", "high"].flatMap((quality) => ["std", "hi"].map((resolution) => ({ aspect, quality, resolution }))));
  it.each(cases)("%o", async (c) => {
    start([item({ ...c, prompt: `p ${c.aspect}` })]);
    const r = await step();
    expect(st.img).toHaveLength(1);
    expect(st.img[0]).toMatchObject({ kind: "image", prompt: `p ${c.aspect}`, aspect: c.aspect, quality: c.quality, resolution: c.resolution });
    expect(r.items[0].state).toBe("done");
    expect(got()[0].fileId).toBeTruthy();
    expect(r.running).toBe(false);
  });
});

describe("videos: started at جواد, followed until ready (20)", () => {
  const cases = ["16:9", "9:16", "1:1", "4:3"].flatMap((aspect) => ["480p", "720p", "1080p"].map((resolution) => ({ aspect, resolution })));
  it.each(cases)("%o", async (c) => {
    start([item({ kind: "video", ...c, seconds: 6, withSound: true })]);
    st.states.set("vj1", [{ state: "running" }, { state: "done" }]);
    const a = await step();
    expect(st.vid[0]).toMatchObject({ kind: "video", aspect: c.aspect, resolution: c.resolution, seconds: 6, withSound: true });
    expect(a.items[0].state).toBe("running");
    expect(a.running).toBe(true);
    expect(st.img).toHaveLength(0);
    expect((await step()).items[0].state).toBe("running");
    const b = await step();
    expect(b.items[0].state).toBe("done");
    expect(b.running).toBe(false);
    expect(st.vid).toHaveLength(1);
  });
  it("a video still running stays running and is not started twice", async () => {
    start([item({ kind: "video" })]);
    st.states.set("vj1", [{ state: "running" }]);
    await step();
    await step();
    await step();
    expect(st.vid).toHaveLength(1);
    expect(got()[0].state).toBe("running");
  });
  it("a video that failed at جواد is told with his reason", async () => {
    start([item({ kind: "video" })]);
    st.states.set("vj1", [{ state: "failed", error: new DeskError("رفض المزوّد", "400 policy") }]);
    await step();
    const r = await step({ owner: true });
    expect(r.items[0]).toMatchObject({ state: "failed", error: "رفض المزوّد", detail: "400 policy" });
  });
  it("the receipt of the desk is kept on the item (generator, price)", async () => {
    start([item({ kind: "video" })]);
    const r = await step();
    expect(r.items[0].desk).toMatchObject({ generator: "GPT Image 2", free: true });
    expect(r.items[0].jobId).toBe("vj1");
  });
});

describe("refusals (15)", () => {
  it.each([1, 2])("a busy desk is tried again by itself (%i refusals) and then made", async (n) => {
    start([item()]);
    for (let i = 0; i < n; i++) st.imgScript.push(new DeskError("مشغول", "429", true));
    for (let i = 0; i < n; i++) {
      const r = await step();
      expect(r.items[0].state).toBe("failed");
      expect(r.running).toBe(true);
    }
    const done = await step();
    expect(done.items[0].state).toBe("done");
    expect(st.img).toHaveLength(n + 1);
  });
  it("gives up after three busy tries", async () => {
    start([item()]);
    for (let i = 0; i < 5; i++) st.imgScript.push(new DeskError("مشغول", "429", true));
    for (let i = 0; i < 3; i++) await step();
    const r = await step();
    expect(r.running).toBe(false);
    expect(st.img).toHaveLength(3);
  });
  it.each(["400 content_policy", "invalid size", "no key", "bad request", "refused"])("a policy-type refusal (%s) is not retried", async (detail) => {
    start([item()]);
    st.imgScript.push(new DeskError("رفض", detail, false));
    const r = await step();
    expect(r.items[0]).toMatchObject({ state: "failed", error: "رفض" });
    expect(r.running).toBe(false);
    expect(st.img).toHaveLength(1);
  });
  it("only the owner sees the technical detail", async () => {
    start([item()]);
    st.imgScript.push(new DeskError("رفض", "400 secret detail"));
    expect((await step()).items[0].detail).toBeUndefined();
    start([item()]);
    st.imgScript.push(new DeskError("رفض", "400 secret detail"));
    expect((await step({ owner: true })).items[0].detail).toBe("400 secret detail");
  });
  it("an unexpected error is told plainly, not as [object Object]", async () => {
    start([item()]);
    st.imgScript.push(new Error("boom"));
    const r = await step();
    expect(r.items[0].error).toBe("صار خطأ غير متوقع.");
  });
  it("a refusal of one picture does not stop the other", async () => {
    start([item({ id: "a" }), item({ id: "b" })]);
    st.imgScript.push(new DeskError("رفض", "400"));
    const r = await step();
    expect(r.items.map((x) => x.state).sort()).toEqual(["done", "failed"]);
  });
});

describe("the dress rule in what جواد returns (10)", () => {
  it.each(["violation", "violation", "violation"])("a woman in a wrong dress is never kept (%s)", async (v) => {
    start([item()]);
    st.checkScript.push(v);
    const r = await step();
    expect(r.items[0]).toMatchObject({ state: "failed", error: "الصورة خالفت قاعدة اللباس فاستُبعدت" });
    expect(st.files).toHaveLength(0);
  });
  it("is tried again and kept once she is dressed right", async () => {
    start([item()]);
    st.checkScript.push("violation", "covered_ok");
    await step();
    const r = await step();
    expect(r.items[0].state).toBe("done");
    expect(st.files).toHaveLength(1);
  });
  it.each(["none", "covered_ok"])("%s passes", async (v) => {
    start([item()]);
    st.checkScript.push(v);
    expect((await step()).items[0].state).toBe("done");
  });
  it.each([
    ["a woman with long hair", "violation"],
    ["a woman in a plain fully black abaya, only face and hands visible", "ok"],
    ["a man reading", "none"],
  ])("the prompt rule: %s → %s", (p, v) => expect(womanCheck(p)).toBe(v));
  it("a wrong-dress check is never charged to a video's start (videos are checked by prompt only)", async () => {
    start([item({ kind: "video" })]);
    st.checkScript.push("violation");
    expect((await step()).items[0].state).toBe("running");
  });
});

describe("references (10)", () => {
  it.each([[["img1"]], [["img1", "img2"]], [["img1", "img2", "img3"]], [["img1", "vid1"]], [["vid1"]], [[]]])("refs %o", async (refs) => {
    start([item({ refs })]);
    await step();
    const images = refs.filter((r) => !r.startsWith("vid"));
    expect((st.img[0].refs as unknown[]).length).toBe(images.length);
    (st.img[0].refs as { uploadId: string; name: string }[]).forEach((r, i) => expect(r.name).toBe(`ref${i + 1}`));
  });
  it.each([[["img1"]], [["img1", "img2"]]])("a video gets its references too %o", async (refs) => {
    start([item({ kind: "video", refs })]);
    await step();
    expect((st.vid[0].refs as unknown[]).length).toBe(refs.length);
  });
  it("every request has a key of its own", async () => {
    start([item({ id: "a" }), item({ id: "b" })]);
    await step();
    const keys = st.img.map((x) => x.key as string);
    expect(new Set(keys).size).toBe(2);
    keys.forEach((k) => expect(k).toMatch(/^[A-Za-z0-9_-]{8,80}$/));
  });
});

describe("several at once (10)", () => {
  it.each([1, 2, 3, 4, 5, 6])("%i pictures: two at a time, all in the end", async (n) => {
    start(Array.from({ length: n }, (_, i) => item({ id: `p${i}` })));
    const first = await step();
    expect(st.img).toHaveLength(Math.min(2, n));
    let r = first;
    for (let g = 0; g < 5 && r.running; g++) r = await step();
    expect(r.items.every((x) => x.state === "done")).toBe(true);
    expect(st.img).toHaveLength(n);
  });
  it("videos start together with the pictures", async () => {
    start([item({ id: "a" }), item({ id: "b" }), item({ id: "v1", kind: "video" }), item({ id: "v2", kind: "video" })]);
    await step();
    expect(st.vid).toHaveLength(2);
    expect(st.img).toHaveLength(2);
  });
  it("a finished request is not made again", async () => {
    start([item()]);
    await step();
    await step();
    expect(st.img).toHaveLength(1);
  });
  it("nothing waiting in the chat says so plainly", async () => {
    st.chat = { id: "c", title: "t", record: "", usd: 0, updatedAt: "", pending: null, messages: [{ role: "user", text: "هلا" }] };
    await expect(step()).rejects.toThrow("ما فيه صور");
  });
});

describe("retry (6)", () => {
  it("puts one failed item back and makes it, deleting its old file", async () => {
    start([item({ state: "failed", error: "x", fileId: "old" })]);
    const r = await step({ retry: ["m1"] });
    expect(r.items[0].state).toBe("done");
    expect(st.deleted).toEqual(["old"]);
  });
  it("retry of 'failed' takes only the failed ones", async () => {
    start([item({ id: "a", state: "failed" }), item({ id: "b", state: "done", fileId: "keep" })]);
    await step({ retry: "failed" });
    expect(st.img).toHaveLength(1);
    expect(st.deleted).toEqual([]);
  });
  it("retry resets the tries so a refused one can be asked again", async () => {
    start([item({ state: "failed", transient: true, tries: 3 })]);
    const r = await step({ retry: ["m1"] });
    expect(r.items[0].state).toBe("done");
    expect(r.items[0].tries).toBe(1);
  });
  it("a name that is not there changes nothing", async () => {
    start([item({ state: "failed", error: "x" })]);
    const r = await step({ retry: ["nope"] });
    expect(r.items[0].state).toBe("failed");
    expect(st.img).toHaveLength(0);
  });
  it("a video retried is started again as a new request", async () => {
    start([item({ kind: "video", state: "failed", jobId: "old" })]);
    const r = await step({ retry: ["m1"] });
    expect(st.vid).toHaveLength(1);
    expect(r.items[0].jobId).toBe("vj1");
  });
  it("the desk's price info is not lost on a retry of a neighbour", async () => {
    start([item({ id: "a", state: "done", fileId: "f", desk: { generator: "G", coins: 3, free: false, settings: {} } }), item({ id: "b", state: "failed" })]);
    await step({ retry: ["b"] });
    expect(got()[0].desk).toMatchObject({ coins: 3 });
  });
});

it("a finished video is recorded in the chat as a video file", async () => {
  start([item({ kind: "video" })]);
  await step();
  await step();
  expect(st.files[0]).toMatchObject({ name: "غلاف" });
  expect((st.files[0].out as { kind: string }).kind).toBe("video");
});

describe("the settings جواد keeps to his registry (9)", () => {
  const img = generatorById(DESK_GENERATOR.image)!;
  const vid = generatorById(DESK_GENERATOR.video)!;
  const base = { key: "k-12345678", prompt: "p", aspect: "1:1" };
  it.each([[0, 5], [1, 4], [4, 4], [10, 10], [15, 15], [16, 15], [99, 15], [-3, 4]])("a video of %i seconds is set to %i", (s, want) => {
    const set = deskSettings(vid, { ...base, kind: "video", seconds: s });
    expect(set.duration).toBe(want);
  });
  it("a picture's count is always one", () => expect(deskSettings(img, { ...base, kind: "image" }).count).toBe(1));
});
