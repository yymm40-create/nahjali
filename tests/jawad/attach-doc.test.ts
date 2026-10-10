import { describe, expect, it } from "vitest";
import { sniff, UPLOAD_EXT, UPLOAD_MIMES } from "@/lib/jawad/media";
import { isUploadKind } from "@config/jawad/types";
import { DOC_BYTES, fitDocs } from "@/lib/claude-images";

// «واحد يقدر يرسل PDF لصانع المحتوى أو غيره»: a PDF is a kind of upload the robots READ — recognised from its own
// bytes, kept out of the generators' references, and sent inside the request instead of as a link.
const pdf = (extra = "") => new TextEncoder().encode(`%PDF-1.7\n%âãÏÓ\n${extra}`);

describe("a PDF attached to a conversation", () => {
  it("is recognised from its first bytes, never from its name", () => {
    expect(sniff(pdf())).toEqual({ kind: "doc", mime: "application/pdf" });
    // a file merely CALLED a pdf is not one
    expect(sniff(new TextEncoder().encode("this is just text, named report.pdf"))).toBeNull();
  });

  it("is an upload kind the tables know", () => {
    expect(isUploadKind("doc")).toBe(true);
    expect(isUploadKind("sheet")).toBe(false);
    expect(UPLOAD_MIMES["application/pdf"]).toBe("doc");
    expect(UPLOAD_EXT["application/pdf"]).toBe("pdf");
  });

  it("goes INSIDE the request (base64), so the robot reads its pages", async () => {
    const body = new Uint8Array(1200);
    body.set(pdf("x".repeat(1100)));
    const fetchMock = async () => new Response(body, { status: 200 });
    const old = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      const msgs = [{ role: "user", content: [{ type: "text", text: "اقرأ المحاضرة" }, { type: "document", source: { type: "url", url: "https://x/y.pdf" }, title: "محاضرة" }] }];
      const out = await fitDocs(msgs);
      const block = (out[0].content as Record<string, unknown>[])[1];
      expect(block.type).toBe("document");
      expect((block.source as { type: string; media_type: string }).type).toBe("base64");
      expect((block.source as { media_type: string }).media_type).toBe("application/pdf");
      expect(block.title).toBe("محاضرة");
    } finally {
      globalThis.fetch = old;
    }
  });

  it("says so plainly when the file is too big or cannot be read, instead of failing the message", async () => {
    const old = globalThis.fetch;
    globalThis.fetch = (async () => new Response(new Uint8Array(DOC_BYTES + 10), { status: 200 })) as typeof fetch;
    try {
      const out = await fitDocs([{ role: "user", content: [{ type: "document", source: { type: "url", url: "https://x/big.pdf" }, title: "كبير" }] }]);
      const block = (out[0].content as Record<string, unknown>[])[0];
      expect(block.type).toBe("text");
      expect(String(block.text)).toContain("كبير");
    } finally {
      globalThis.fetch = old;
    }
    globalThis.fetch = (async () => new Response("no", { status: 404 })) as typeof fetch;
    try {
      const out = await fitDocs([{ role: "user", content: [{ type: "document", source: { type: "url", url: "https://x/gone.pdf" }, title: "مفقود" }] }]);
      expect((out[0].content as Record<string, unknown>[])[0].type).toBe("text");
    } finally {
      globalThis.fetch = old;
    }
  });

  it("leaves a document already sent as base64 exactly as it is", async () => {
    const block = { type: "document", source: { type: "base64", media_type: "application/pdf", data: "AAA" } };
    const out = await fitDocs([{ role: "user", content: [block] }]);
    expect((out[0].content as unknown[])[0]).toBe(block);
  });
});
