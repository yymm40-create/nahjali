import { describe, expect, it, vi } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { coinsOf, GENERATORS, generatorById } from "@config/jawad/generators";
import type { RefMeta } from "@config/jawad/types";
import { evaluate, priceTable } from "@/lib/jawad/engine";
import { EDIT_OPTION_KEYS, readEditSettings } from "@/lib/jawad/smart-edit";
import { JAWAD_EDIT_IDENTITY, personWordsText, shotRecordText } from "@config/jawad/smart-edit-training";
import { KEPT_RULES, missingLocks, readLocks } from "@/lib/jawad/edit-locks";
import EditOptions from "@/components/jawad/studio/EditOptions";
import Coined from "@/components/Coined";
import Riyal from "@/components/Riyal";
import { coinStr } from "@config/coins";

const seedance = generatorById("byteplus-seedance-2-5")!;
const gpt = generatorById("openai-gpt-image-2")!;
const video = (ms: number): RefMeta => ({ id: "v", kind: "video", role: "reference", mime: "video/mp4", bytes: 1, width: 854, height: 480, durationMs: ms, fps: 24, status: "ready" });
const priceWith = (settings: Record<string, unknown>, refs: RefMeta[] = []) => {
  const e = evaluate(seedance, { settings: { resolution: "480p", duration: 13, ratio: "16:9", audio: true, ...settings } as never, prompt: "x", instructions: "", refStyle: refs.length ? "references" : "none", refs, strict: false }, priceTable(seedance, undefined));
  if (!e.price.ok) throw new Error(e.price.reason);
  return coinsOf(e.price.lines.reduce((s, l) => s + l.centi, 0));
};

describe("«التعديل الذكي»: the edit's options are the generation's, checked", () => {
  it("lets through only the options a smart edit offers, and only values the generator really has", () => {
    const ok = readEditSettings(seedance, { resolution: "720p", audio: false, duration: 8, ratio: "9:16", count: 3, evil: "x" }, "whole");
    expect(ok).toEqual({ resolution: "720p", audio: false, duration: 8 });
    // the ratio and everything else stay as the original made them
    expect(Object.keys(ok).every((k) => EDIT_OPTION_KEYS.video.includes(k))).toBe(true);
    // a value the generator doesn't have, a number out of its range, a wrong type: dropped, never guessed
    expect(readEditSettings(seedance, { resolution: "8k", duration: 999, audio: "yes" }, "whole")).toEqual({});
    expect(readEditSettings(seedance, { duration: 7.5 }, "whole")).toEqual({});
    expect(readEditSettings(seedance, null, "whole")).toEqual({});
    expect(readEditSettings(seedance, "resolution", "whole")).toEqual({});
  });
  it("a part's seconds are the cut's: the seconds count only for the whole clip", () => {
    expect(readEditSettings(seedance, { duration: 8, resolution: "720p" }, "parts")).toEqual({ resolution: "720p" });
    expect(readEditSettings(seedance, { duration: 8 }, "whole")).toEqual({ duration: 8 });
  });
  it("an image edit offers its resolution and quality only", () => {
    const r = readEditSettings(gpt, { resolution: "hi", quality: "high", aspect: "9:16", count: 4, duration: 5 }, "full");
    expect(r).toEqual({ resolution: "hi", quality: "high" });
  });
  it("each option moves the price the way it did at the start (seconds, resolution, the video reference)", () => {
    const base = priceWith({});
    expect(priceWith({ duration: 8 })).toBeLessThan(base);
    expect(priceWith({ duration: 15 })).toBeGreaterThan(base);
    const res = seedance.options.find((o) => o.key === "resolution");
    const values = res && res.kind === "choice" ? res.values.map((v) => v.value) : [];
    expect(values.length).toBeGreaterThan(1);
    const prices = values.map((v) => priceWith({ resolution: v }));
    expect(new Set(prices).size).toBeGreaterThan(1);
    // with a continuity video the price counts its seconds too
    expect(priceWith({}, [video(3000)])).toBeGreaterThan(base);
  });
});

describe("the options panel", () => {
  const choices = GENERATORS.filter((g) => g.output === "video" && g.id.includes("seedance"));
  const orig = { resolution: "480p", duration: 13, ratio: "16:9", audio: true };
  const render = (mode: "whole" | "parts", more: Record<string, unknown> = {}) =>
    renderToStaticMarkup(h(EditOptions, { def: seedance, choices, originalId: seedance.id, onGenerator: () => {}, original: orig, chosen: {}, onChange: () => {}, mode, cutSeconds: mode === "parts" ? 4 : null, ...more }));
  it("shows the generator to choose, the resolution, the sound and (whole clip) the seconds", () => {
    const html = render("whole");
    for (const t of ["خيارات التعديل", "المولّد", "الدقة", "صوت متزامن", "المدة", "نفس مولد الأصل", "جواد"]) expect(html, t).toContain(t);
    expect(html).not.toContain("نسبة الأبعاد");
  });
  it("for a part the seconds are the cut's, not a choice", () => {
    const html = render("parts");
    expect(html).not.toContain('type="range"');
    expect(html).toContain("طول الجزء");
    expect(html).toContain(">4<");
  });
  it("an image shows its resolution and quality", () => {
    const html = renderToStaticMarkup(h(EditOptions, { def: gpt, choices: [gpt], originalId: gpt.id, onGenerator: () => {}, original: { resolution: "std", quality: "medium", aspect: "1:1", count: 1 }, chosen: {}, onChange: () => {}, mode: "full" }));
    expect(html).toContain("الدقة");
    expect(html).toContain("مستوى الجودة");
    expect(html).not.toContain("عدد الصور");
  });
});

describe("جواد decides the final prompt", () => {
  it("receives the person's own words untouched, and the whole shot", () => {
    const words = personWordsText("في الثانية 3 تتشوّه يد البطل، أبي الحركة أهدأ", [{ from: 3, to: 5.5, note: "اليد" }]);
    expect(words).toContain("<<<\nفي الثانية 3 تتشوّه يد البطل، أبي الحركة أهدأ\n>>>");
    expect(words).toContain("- From 3.0 s to 5.5 s: اليد");
    expect(words).toContain("nobody changed, shortened, translated or improved them");
    const shot = shotRecordText({ previous: "A man in a white thobe pours tea", settings: { duration: 13 }, videoSec: 13, filmBrief: "قصة الفيلم: ..." });
    for (const t of ["PREVIOUS PROMPT", "A man in a white thobe pours tea", "13.0 s", "\"duration\":13", "سجاد", "قصة الفيلم"]) expect(shot, t).toContain(t);
    expect(shotRecordText({ previous: "p", settings: {} })).not.toContain("سجاد");
  });
  it("is told he is the one who decides, with nobody before or after him", () => {
    expect(JAWAD_EDIT_IDENTITY).toContain("«جواد»");
    expect(JAWAD_EDIT_IDENTITY).toContain("the studio's assistant");
    expect(JAWAD_EDIT_IDENTITY).toContain("STRAIGHT");
    expect(JAWAD_EDIT_IDENTITY).toContain("YOU alone decide the final prompt");
    expect(JAWAD_EDIT_IDENTITY).toContain("nobody rewrites it after you");
    expect(KEPT_RULES).toContain('"kept"');
  });
  it("declares the locks he carries over in the same answer, and the prompt is held to them", () => {
    const previous = "A man in a white thobe and a red shemagh pours tea in a majlis. He says \"Ahlan wa sahlan\".";
    const locks = readLocks({ locks: [{ kind: "wardrobe", keep: "white thobe and red shemagh", check: ["white thobe", "red shemagh"] }, { kind: "dialogue", keep: "the greeting", check: ["Ahlan wa sahlan"] }, { kind: "style", keep: "made up", check: ["pixar"] }] }, previous);
    // a check word the previous prompt never had is not a fair check: dropped
    expect(locks.find((l) => l.kind === "style")?.check).toEqual([]);
    expect(missingLocks("A man in a white thobe and a red shemagh pours tea. He says \"Ahlan wa sahlan\".", locks)).toEqual([]);
    expect(missingLocks("A man in a blue suit pours tea.", locks).map((l) => l.kind)).toEqual(["wardrobe", "dialogue"]);
  });
});

describe("جواد the studio's assistant writes the edit", () => {
  const answer = (o: Record<string, unknown>) => ({ reply: "عدّلت اليد", generatorId: "", prompt: "", instructions: "", settings: [], refStyle: "", addRefs: [], removeRefs: [], thumbnailPerson: "", thumbnailSide: "", quick: [], promptZh: "", kept: [], ...o });
  async function run(answers: Record<string, unknown>[], o: { def: typeof seedance; video?: boolean }) {
    vi.resetModules();
    const calls: { system: string; schema: { required: string[] }; turns: { role: string; content: unknown }[] }[] = [];
    vi.doMock("@/lib/film/anthropic", () => ({
      callClaudeJson: vi.fn(async (c: { system: string; schema: { required: string[] }; turns: { role: string; content: unknown }[] }) => {
        calls.push({ system: c.system, schema: c.schema, turns: c.turns });
        const data = answers[Math.min(calls.length - 1, answers.length - 1)];
        return { data, raw: JSON.stringify(data), usage: { input_tokens: 1, output_tokens: 1 } };
      }),
      claudeCost: () => 0.01,
      siteSystem: (t: string) => [{ type: "text", text: t }],
    }));
    const { jawadWritesEdit } = await import("@/lib/jawad/server/jawad-edit");
    const { missingLocks: miss, missingText } = await import("@/lib/jawad/edit-locks");
    const previous = "A man in a white thobe pours tea in a majlis";
    const draft = { generatorId: o.def.id, prompt: previous, instructions: "", settings: {}, refStyle: "none" as const, refs: [] };
    const go = () => jawadWritesEdit({ def: o.def, parts: [{ type: "text", text: "the shot" }], names: [], rules: o.video === false ? "PICTURE RULES" : "", draft, previous, extra: (p, kept) => (miss(p, kept).length ? [missingText(miss(p, kept))] : []), problems: () => [] });
    return { calls, go };
  }

  it("is the studio assistant's own system prompt plus this request type and the director's craft, and asks for the locks in the same answer", async () => {
    const good = answer({ prompt: "A man in a white thobe pours tea in a majlis, a 5-second clip.", promptZh: "一个穿白色长袍的男人在会客厅倒茶，五秒钟的片段。", kept: [{ kind: "wardrobe", keep: "white thobe", check: ["white thobe"] }] });
    const { calls, go } = await run([good], { def: seedance });
    const r = await go();
    const sys = calls[0].system;
    // his own: who he is, his knowledge, his generators — before anything else
    expect(sys.startsWith("How you work:")).toBe(true);
    expect(sys).toContain("You are «جواد», the assistant of the JAWAD AI studio");
    expect(sys).toContain("byteplus-seedance-2-5");
    // then this request type: the person's words reach him straight, and he alone decides
    expect(sys).toContain("REQUEST TYPE — «تعديل ذكي»");
    expect(sys).toContain("YOU alone decide the final prompt");
    expect(sys).toContain("THE DIRECTOR'S CRAFT");
    expect(sys).toContain('"promptZh"');
    expect(calls[0].schema.required).toEqual(expect.arrayContaining(["prompt", "promptZh", "kept", "reply"]));
    expect(r.prompt).toContain("white thobe");
    expect(r.prompt).toContain("一个穿白色长袍");
    expect(r.reply).toBe("عدّلت اليد");
    expect(r.kept.map((l) => l.kind)).toEqual(["wardrobe"]);
    vi.doUnmock("@/lib/film/anthropic");
  });

  it("sends a fault back to him (a lock he declared but dropped) and takes his second answer", async () => {
    const kept = [{ kind: "wardrobe", keep: "white thobe", check: ["white thobe"] }];
    const bad = answer({ prompt: "A man pours tea in a majlis, a 5-second clip.", promptZh: "一个男人倒茶。", kept });
    const good = answer({ prompt: "A man in a white thobe pours tea in a majlis, a 5-second clip.", promptZh: "一个穿白色长袍的男人倒茶。", kept });
    const { calls, go } = await run([bad, good], { def: seedance });
    const r = await go();
    expect(calls.length).toBe(2);
    expect(JSON.stringify(calls[1].turns)).toContain("LOCKS of the original are missing");
    expect(r.attempts).toBe(2);
    expect(r.prompt).toContain("white thobe");
    vi.doUnmock("@/lib/film/anthropic");
  });

  it("holds his prompt to the site's rule on women, like in the chat: a real woman is sent back, and never goes through", async () => {
    const woman = answer({ prompt: "A woman in a white dress pours tea in a majlis, a 5-second clip.", promptZh: "一位女士倒茶。" });
    const man = answer({ prompt: "A man in a white thobe pours tea in a majlis, a 5-second clip.", promptZh: "一个男人倒茶。" });
    const a = await run([woman, man], { def: seedance });
    const ok = await a.go();
    expect(JSON.stringify(a.calls[1].turns)).toContain("no real women or girls");
    expect(ok.prompt).toContain("A man");
    const b = await run([woman], { def: seedance });
    await expect(b.go()).rejects.toThrow();
    vi.doUnmock("@/lib/film/anthropic");
  });

  it("a picture: his own system prompt, the picture's rules, one English prompt (no Chinese twin)", async () => {
    const { calls, go } = await run([answer({ prompt: "Change the shirt colour to white; everything else exactly as in @result." })], { def: gpt as never, video: false });
    const r = await go();
    expect(calls[0].system).toContain("PICTURE RULES");
    expect(calls[0].system).toContain("REQUEST TYPE — «تعديل ذكي»");
    expect(calls[0].system).not.toContain("THE DIRECTOR'S CRAFT");
    expect(r.prompt).toBe("Change the shirt colour to white; everything else exactly as in @result.");
    vi.doUnmock("@/lib/film/anthropic");
  });
});

describe("prices show the coin's logo and never a currency word", () => {
  it("Riyal and Coined draw the logo and the amount", () => {
    const a = renderToStaticMarkup(h(Riyal, { halalas: 9400 }));
    expect(a).toContain("<svg");
    expect(a).toContain("94");
    expect(a).not.toContain("ر.س");
    const b = renderToStaticMarkup(h(Coined, { text: `رصيدك (${coinStr(250)}) لا يكفي (${coinStr(9400)}).` }));
    expect(b.match(/<svg/g)?.length).toBe(2);
    expect(b).toContain("2.50");
    expect(b).toContain("94");
    expect(b).not.toContain("¤");
    expect(renderToStaticMarkup(h(Coined, { text: "بدون أسعار" }))).toBe("بدون أسعار");
  });
  it("no page, message or API answer puts «ر.س» or «ريال» beside a price (a guard over the source)", () => {
    const bad: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name)) {
          const lines = readFileSync(p, "utf8").split("\n");
          lines.forEach((l, i) => {
            if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
            // the owner's own tools and cost notes (real riyals), the sellers' content examples and the separate booklet product keep their words
            if (/src\/app\/(admin|jawad-ai\/admin|booklet|new)\/|src\/lib\/film\/limits|config\/content-sales/.test(p) || /basis:/.test(l)) return;
            // a price (an amount or the formatter) followed by the word
            if (/(fmtSar\([^)]*\)|\}|\d)\s*(ر\.س|ريال)(?![\p{L}])/u.test(l) && !/aria-label|بالريال|placeholder/.test(l)) bad.push(`${p}:${i + 1}: ${l.trim().slice(0, 100)}`);
          });
        }
      }
    };
    walk("src");
    walk("config");
    expect(bad).toEqual([]);
  });
});
