import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { OUTPUT_KINDS } from "@config/jawad/student";
import { chatMakeKinds, makeRules, OFFER_MAX, splitOffer, startBody } from "@/lib/jawad/student/offer";
import { canTogether, mergeParts, TOGETHER_KEY, togetherReady, type MergeItem } from "@/lib/jawad/student/merge-parts";

// «صادق يصنع من المحادثة» and «ادمج النواتج في PDF واحد»: reading his markers into an offer, what he may offer, and the
// combined file.

describe("what صادق may make from the chat", () => {
  it("is every output but the conversation itself and the sermon", () => {
    const kinds = chatMakeKinds();
    expect(kinds).not.toContain("chat");
    expect(kinds).not.toContain("sermon");
    for (const k of ["summary", "explain", "preread", "transcript", "book", "slides", "audio", "quiz", "mindmap"]) expect(kinds).toContain(k);
    expect(kinds.every((k) => OUTPUT_KINDS.some((o) => o.kind === k))).toBe(true);
  });
  it("is taught to him with the menu, what exists, and when to use the markers", () => {
    const r = makeRules([{ kind: "summary", title: "ملخص", status: "done" }, { kind: "chat", title: "محادثة مع صادق", status: "done" }]);
    expect(r).toContain("[[MAKE]]");
    expect(r).toContain("[[MERGE]]");
    expect(r).toContain("summary («ملخص», done)");
    expect(r).not.toContain("chat («");
    expect(r).toContain("quiz: اختبار");
    expect(makeRules([])).toContain("Nothing has been made yet");
  });
});

describe("his markers become an offer", () => {
  const reply = (body: string) => `تمام، أسوي لك ملخص بالأمثلة.\n${body}`;
  it("reads a make marker, keeps his words, and cuts the marker out", () => {
    const r = splitOffer(reply('[[MAKE]]{"outputs":[{"kind":"summary","note":"ركّز على الفصل الثاني"},{"kind":"quiz","note":""}]}'));
    expect(r.text).toBe("تمام، أسوي لك ملخص بالأمثلة.");
    expect(r.offer).toEqual({ items: [{ kind: "summary", note: "ركّز على الفصل الثاني" }, { kind: "quiz", note: "" }], merge: false, state: "open" });
  });
  it("reads a merge marker", () => {
    const r = splitOffer("أدمجها لك.\n[[MERGE]]");
    expect(r.text).toBe("أدمجها لك.");
    expect(r.offer).toEqual({ items: [], merge: true, state: "open" });
  });
  it("a merge next to something to make waits (it would leave the new output out)", () => {
    const r = splitOffer(reply('[[MAKE]]{"outputs":[{"kind":"summary","note":""}]}\n[[MERGE]]'));
    expect(r.offer?.merge).toBe(false);
    expect(r.offer?.items).toHaveLength(1);
  });
  it("keeps only valid kinds, once each, at most four, and short notes", () => {
    const many = ["summary", "explain", "quiz", "slides", "book", "mindmap"].map((kind) => ({ kind, note: "x".repeat(900) }));
    const r = splitOffer(reply(`[[MAKE]]${JSON.stringify({ outputs: [{ kind: "chat", note: "" }, { kind: "sermon", note: "" }, { kind: "nope", note: "" }, { kind: "summary", note: "a" }, ...many] })}`));
    expect(r.offer!.items.map((i) => i.kind)).toEqual(["summary", "explain", "quiz", "slides"].slice(0, OFFER_MAX));
    expect(r.offer!.items.length).toBe(OFFER_MAX);
    expect(r.offer!.items.every((i) => i.note.length <= 600)).toBe(true);
    expect(r.offer!.items[0].note).toBe("a");
  });
  it("a badly written marker gives no offer but his words still show", () => {
    const r = splitOffer(reply("[[MAKE]]{not json"));
    expect(r.offer).toBeNull();
    expect(r.text).toBe("تمام، أسوي لك ملخص بالأمثلة.");
    expect(splitOffer(reply('[[MAKE]]{"outputs":[{"kind":"chat","note":""}]}')).offer).toBeNull();
    expect(splitOffer("مجرد شرح بدون أي علامة.").offer).toBeNull();
    expect(splitOffer("مجرد شرح بدون أي علامة.").text).toBe("مجرد شرح بدون أي علامة.");
  });
  it("never leaves an empty message", () => {
    expect(splitOffer('[[MAKE]]{"outputs":[{"kind":"summary","note":""}]}').text).toBe("تمام.");
  });
  it("turns an offer into the request the outputs page sends on «ابدأ»", () => {
    const b = startBody({ items: [{ kind: "summary", note: "قصير" }, { kind: "quiz", note: "" }] });
    expect(b.action).toBe("start");
    expect(b.outputs).toEqual([{ kind: "summary", settings: {} }, { kind: "quiz", settings: {} }]);
    expect(b.special).toBe("ملخص: قصير");
    expect(b.design).toEqual({});
  });
});

describe("«ادمج النواتج في PDF واحد»: which outputs go in", () => {
  const o = (id: string, kind: string, ord: number, status: string, files: Record<string, string>): MergeItem => ({ id, title: `T-${id}`, kind: kind as MergeItem["kind"], ord, status, files });
  const list = [
    o("quiz", "quiz", 3, "done", { pdf: "q.pdf" }),
    o("sum", "summary", 0, "done", { pdf: "s.pdf" }),
    o("book", "book", 1, "review", { pdf: "b.pdf", pictures_pdf: "b-pics.pdf" }),
    o("aud", "audio", 2, "done", {}),
    o("chat", "chat", 4, "done", {}),
    o("run", "explain", 5, "running", { pdf: "e.pdf" }),
    o("slides", "slides", 6, "done", { pdf: "sl.pdf", pptx: "sl.pptx" }),
  ];
  it("takes finished PDFs in the outputs' order, the drawn pages first when there are, and lists what is left out", () => {
    const { parts, skipped } = mergeParts(list);
    expect(parts.map((p) => [p.id, p.file, p.path])).toEqual([["sum", "pdf", "s.pdf"], ["book", "pictures_pdf", "b-pics.pdf"], ["quiz", "pdf", "q.pdf"], ["slides", "pdf", "sl.pdf"]]);
    expect(skipped).toEqual(["T-aud", "T-run"]);
  });
  it("can be limited to the outputs the student ticked", () => {
    expect(mergeParts(list, ["quiz", "sum"]).parts.map((p) => p.id)).toEqual(["sum", "quiz"]);
  });
});

describe("«اجمعها كلها في PDF واحد»", () => {
  it("is offered from two outputs that make a PDF", () => {
    expect(canTogether(["summary", "quiz"])).toBe(true);
    expect(canTogether(["summary", "audio", "chat", "mindmap"])).toBe(false);
    expect(canTogether(["book"])).toBe(false);
  });
  it("he can offer it in the chat, and the offer keeps it only when it means something", () => {
    const two = splitOffer('تمام.\n[[MAKE]]{"outputs":[{"kind":"summary","note":""},{"kind":"quiz","note":""}],"together":true}');
    expect(two.offer?.together).toBe(true);
    expect(startBody(two.offer!)).toMatchObject({ action: "start", together: true });
    // one PDF output (or a recording with one) cannot be "together"
    const one = splitOffer('تمام.\n[[MAKE]]{"outputs":[{"kind":"summary","note":""},{"kind":"audio","note":""}],"together":true}');
    expect(one.offer?.together).toBeUndefined();
    expect("together" in startBody(one.offer!)).toBe(false);
    expect(splitOffer('تمام.\n[[MAKE]]{"outputs":[{"kind":"summary","note":""},{"kind":"quiz","note":""}]}').offer?.together).toBeUndefined();
  });
  it("is taught to him", () => {
    expect(makeRules([])).toContain('"together":true');
  });
  const tag = (id: string, status: string, batch?: string) => ({ id, kind: "summary" as const, status, settings: batch ? { [TOGETHER_KEY]: batch } : {} });
  it("waits until every output of the batch has finished", () => {
    expect(togetherReady([tag("a", "done", "b1"), tag("b", "running", "b1")])).toBeNull();
    expect(togetherReady([tag("a", "done", "b1"), tag("b", "done", "b1"), tag("c", "running")])).toEqual({ batch: "b1", ids: ["a", "b"] });
    expect(togetherReady([tag("a", "done", "b1"), tag("b", "review", "b1")])?.batch).toBe("b1");
  });
  it("puts a batch together once, and ignores outputs not made that way", () => {
    const list = [tag("a", "done", "b1"), tag("b", "done", "b1"), tag("c", "done", "b2"), tag("d", "done", "b2")];
    expect(togetherReady(list, new Set(["b1"]))?.batch).toBe("b2");
    expect(togetherReady(list, new Set(["b1", "b2"]))).toBeNull();
    expect(togetherReady([tag("a", "done"), tag("b", "done")])).toBeNull();
    // a batch of one is nothing to put together
    expect(togetherReady([tag("a", "done", "b9")])).toBeNull();
  });
});

describe("the combined file", () => {
  const pdfOf = async (pages: number) => {
    const d = await PDFDocument.create();
    for (let i = 0; i < pages; i++) d.addPage([200, 200]);
    return Buffer.from(await d.save());
  };
  const state = vi.hoisted(() => ({ files: {} as Record<string, Buffer>, list: [] as unknown[], put: null as null | { path: string; bytes: Uint8Array }, name: "" }));
  vi.mock("@/lib/jawad/student/db", () => ({
    outputs: async () => state.list,
    getFile: async (path: string) => {
      if (!state.files[path]) throw new Error("missing");
      return state.files[path];
    },
    putFile: async (path: string, bytes: Uint8Array) => void (state.put = { path, bytes }),
    signFile: async (path: string, _s: number, name: string) => {
      state.name = name;
      return `https://files/${path}`;
    },
  }));
  beforeEach(() => {
    state.put = null;
    state.name = "";
  });

  it("holds every page of every output, in order, and answers a download link", async () => {
    const { mergeOutputs } = await import("@/lib/jawad/student/merge");
    state.files = { "a.pdf": await pdfOf(2), "b.pdf": await pdfOf(3), "c.pdf": await pdfOf(1) };
    state.list = [
      { id: "1", title: "ملخص", kind: "summary", ord: 0, status: "done", files: { pdf: "a.pdf" } },
      { id: "2", title: "كتاب", kind: "book", ord: 1, status: "done", files: { pdf: "b.pdf" } },
      { id: "3", title: "اختبار", kind: "quiz", ord: 2, status: "done", files: { pdf: "c.pdf" } },
    ];
    const r = await mergeOutputs("u1", { id: "p1", title: "مادة / تجريبية" });
    expect(r.pages).toBe(6);
    expect(r.titles).toEqual(["ملخص", "كتاب", "اختبار"]);
    expect(r.url).toBe("https://files/u1/p1/merged/all.pdf");
    expect(state.name).toBe("مادة  تجريبية-كل-النواتج.pdf");
    expect((await PDFDocument.load(state.put!.bytes)).getPageCount()).toBe(6);
  });
  it("leaves out a file it cannot read and says so; refuses when nothing is ready", async () => {
    const { mergeOutputs } = await import("@/lib/jawad/student/merge");
    state.files = { "a.pdf": await pdfOf(2), "bad.pdf": Buffer.from("not a pdf") };
    state.list = [
      { id: "1", title: "ملخص", kind: "summary", ord: 0, status: "done", files: { pdf: "a.pdf" } },
      { id: "2", title: "تالف", kind: "book", ord: 1, status: "done", files: { pdf: "bad.pdf" } },
      { id: "3", title: "ناقص", kind: "quiz", ord: 2, status: "done", files: { pdf: "gone.pdf" } },
    ];
    const r = await mergeOutputs("u1", { id: "p1", title: "م" });
    expect(r.titles).toEqual(["ملخص"]);
    expect(r.failed).toEqual(["تالف", "ناقص"]);
    expect(r.pages).toBe(2);
    state.list = [{ id: "4", title: "تسجيل", kind: "audio", ord: 0, status: "done", files: {} }];
    await expect(mergeOutputs("u1", { id: "p1", title: "م" })).rejects.toMatchObject({ message: expect.stringMatching(/ما فيه ناتج جاهز/) });
  });
});
