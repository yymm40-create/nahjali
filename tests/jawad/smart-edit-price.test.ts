import { describe, expect, it } from "vitest";
import { generatorById, EDIT_CLAUDE_KEY, EDIT_FEE_KEY, coinsOf } from "@config/jawad/generators";
import type { RefMeta } from "@config/jawad/types";
import { evaluate, priceTable } from "@/lib/jawad/engine";
import { continuityRanges, cutRange } from "@/lib/jawad/smart-edit";
import { priceAgreed, trustedContinuity } from "@/lib/jawad/server/smart-edit";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PriceAsk, PriceAsks } from "@/components/jawad/editor/SmartFix";

const def = generatorById("byteplus-seedance-2-5")!;
const settings = { resolution: "480p", duration: 13, ratio: "16:9", audio: true };
const priceOf = (refs: RefMeta[]) => {
  const e = evaluate(def, { settings, prompt: "x", instructions: "", refStyle: "references", refs, strict: true }, priceTable(def, undefined));
  expect(e.issues).toEqual([]);
  if (!e.price.ok) throw new Error(e.price.reason);
  return { coins: coinsOf(e.price.lines.reduce((s, l) => s + l.centi, 0)), lines: e.price.lines };
};
const video = (ms: number): RefMeta => ({ id: "v", kind: "video", role: "reference", mime: "video/mp4", bytes: 1, width: 854, height: 480, durationMs: ms, fps: 24, status: "ready" });

describe("«التعديل الذكي»: the price of an edit is the same at the quote, at the click and when the job is made", () => {
  // the case from the field: a piece lifted at 17.7–30 s, the only continuity the 3 s before the cut
  const cut = cutRange(17.719, 30, 30, 4, 15);
  const cont = continuityRanges(cut!, 30);

  it("the cut the browser makes may run a few frames long: the price still reads the length asked", () => {
    expect(cont.length).toBeGreaterThan(0);
    const asked = cont.map((r) => Math.round((r.to - r.from) * 1000));
    const quoted = priceOf(asked.map(video));
    // the page's cut landed on a key frame: 3.04 s instead of 3 s (this used to price 4 s of reference instead of 3)
    const uploaded = asked.map((ms) => ({ ...video(ms + 40), id: "up" }));
    expect(priceOf(uploaded).coins).toBeGreaterThan(quoted.coins);
    const trusted = trustedContinuity(uploaded, cont, { width: 854, height: 480 });
    expect(priceOf(trusted).coins).toBe(quoted.coins);
    expect(priceOf(trusted).lines).toEqual(quoted.lines);
    expect(trusted.every((m) => m.fps === 24 && m.width === 854)).toBe(true);
  });

  it("is the same for a hundred random cuts, and never depends on how long the upload came out", () => {
    for (let i = 0; i < 100; i++) {
      const from = 4 + (i % 9) + (i % 7) / 10;
      const c = cutRange(from, from + 4 + (i % 8), 30, 4, 15);
      if (!c) continue;
      const k = continuityRanges(c, 30);
      const asked = k.map((r) => Math.round((r.to - r.from) * 1000));
      const real = asked.map((ms, j) => ({ ...video(ms + ((i * 37 + j * 11) % 140)), id: `u${j}` }));
      expect(priceOf(trustedContinuity(real, k, { width: 854, height: 480 })).coins).toBe(priceOf(asked.map(video)).coins);
    }
  });

  it("those who make for free have no price to confirm; everyone else must have agreed to exactly the price charged", () => {
    expect(priceAgreed(true, 1, 94)).toBe(true);
    expect(priceAgreed(true, undefined, 94)).toBe(true);
    expect(priceAgreed(false, 94, 94)).toBe(true);
    expect(priceAgreed(false, "94", 94)).toBe(true);
    expect(priceAgreed(false, 90, 94)).toBe(false);
    expect(priceAgreed(false, undefined, 94)).toBe(false);
  });

  it("the edit's own lines are in the price table the quote reads (Claude's prompt and the fee)", () => {
    expect(EDIT_CLAUDE_KEY).toBeTruthy();
    expect(EDIT_FEE_KEY).toBeTruthy();
  });
});

describe("the page: a higher price is asked about, never silently taken", () => {
  it("carries the new total and the lines, and sends the same edit again only when told the agreed amount", async () => {
    const seen: number[] = [];
    const ask = new PriceAsk(9400, [{ label: "التعديل الذكي", centi: 3000 }], async (agreed) => {
      seen.push(agreed);
      return { job: "j1", from: 17719 };
    });
    expect(ask).toBeInstanceOf(Error);
    expect(ask.coins).toBe(9400);
    expect(ask.message).toContain("¤94");
    expect(seen).toEqual([]);
    expect(await ask.confirm(ask.coins)).toEqual({ job: "j1", from: 17719 });
    expect(seen).toEqual([9400]);
  });

  it("is shown: the new total, each line, «أكّد» with the amount, and a way out", () => {
    const ask = new PriceAsk(9400, [{ label: "13 ث · 480p", centi: 41990 }, { label: "التعديل الذكي", centi: 30000 }], async () => ({ job: "j", from: 0 }));
    const html = renderToStaticMarkup(h(PriceAsks, { asks: [{ id: "c1", start: 17719, note: "x", ask }], onConfirm: () => {}, onCancel: () => {} }));
    for (const part of ["تغيّر سعر الجزء", "0:17.7", "94", "13 ث · 480p", "التعديل الذكي", "أكّد", "إلغاء", "ما ينخصم شي قبل ما تأكّد"]) expect(html, part).toContain(part);
    // the coin's logo stands for the currency: never the word
    expect(html).toContain("<svg");
    expect(html).not.toContain("ر.س");
    expect(renderToStaticMarkup(h(PriceAsks, { asks: [], onConfirm: () => {}, onCancel: () => {} }))).toBe("");
  });
});
