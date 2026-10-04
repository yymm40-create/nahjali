// JAWAD AI: checks the central registry and the shared request rules (no keys, no network).
// Run: npx tsx scripts/test-jawad-engine.mts
import assert from "node:assert/strict";
import { GENERATORS, generatorById, gptImage2OutputTokens, defaultSettings, GPT_IMAGE_2_SIZES, centiFor, coinsOf } from "../config/jawad/generators";
import { evaluate, priceTable, priceVersion } from "../src/lib/jawad/engine";
import type { RefMeta } from "../config/jawad/types";

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("✓", name);
};

const g = (id: string) => generatorById(id)!;
const img = (over: Partial<RefMeta> = {}): RefMeta => ({ id: crypto.randomUUID(), kind: "image", role: "reference", mime: "image/png", bytes: 500_000, width: 1280, height: 720, status: "ready", ...over });
const aud = (ms: number): RefMeta => ({ id: crypto.randomUUID(), kind: "audio", role: "reference", mime: "audio/mpeg", bytes: 200_000, durationMs: ms, status: "ready" });
const vid = (ms: number): RefMeta => ({ id: crypto.randomUUID(), kind: "video", role: "reference", mime: "video/mp4", bytes: 5_000_000, width: 1280, height: 720, durationMs: ms, fps: 24, status: "ready" });

test("gpt-image-2 token formula reproduces OpenAI's published per-image prices", () => {
  const usd = (w: number, h: number, q: "low" | "medium" | "high") => Math.round(((gptImage2OutputTokens(w, h, q) * 30) / 1e6) * 1000) / 1000;
  assert.equal(usd(1024, 1024, "low"), 0.006);
  assert.equal(usd(1024, 1024, "medium"), 0.053);
  assert.equal(usd(1024, 1024, "high"), 0.211);
  assert.equal(usd(1536, 1024, "low"), 0.005);
  assert.equal(usd(1536, 1024, "medium"), 0.041);
  assert.equal(usd(1024, 1536, "high"), 0.165);
});

test("every gpt-image-2 size meets the documented constraints (and stays ≤ 2560×1440)", () => {
  for (const tier of Object.values(GPT_IMAGE_2_SIZES))
    for (const [w, h] of Object.values(tier)) {
      assert.equal(w % 16, 0);
      assert.equal(h % 16, 0);
      assert.ok(Math.max(w, h) / Math.min(w, h) <= 3);
      assert.ok(w * h >= 655_360 && w * h <= 2560 * 1440, `${w}x${h}`);
      assert.ok(Math.max(w, h) <= 2560);
    }
});

test("coins: centi rounding and totals", () => {
  assert.equal(coinsOf(101), 2);
  assert.equal(coinsOf(100), 1);
  assert.ok(centiFor(0.0333) >= 99 && centiFor(0.0333) <= 100);
});

test("text-to-image is priced from verified defaults", () => {
  const d = g("openai-gpt-image-2");
  const e = evaluate(d, { settings: defaultSettings(d), prompt: "قطة على سطح القمر", instructions: "", refStyle: "references", refs: [] }, priceTable(d, {}));
  assert.equal(e.mode.id, "text_to_image");
  assert.ok(e.price.ok);
  assert.deepEqual(e.issues, []);
  if (e.price.ok) assert.ok(e.price.coins >= 2 && e.price.coins <= 4, `coins ${e.price.coins}`);
});

test("price changes with count and quality", () => {
  const d = g("openai-gpt-image-2");
  const base = { prompt: "x", instructions: "", refStyle: "references" as const, refs: [] };
  const p1 = evaluate(d, { ...base, settings: { ...defaultSettings(d), quality: "high", count: 1 } }, priceTable(d, {})).price;
  const p4 = evaluate(d, { ...base, settings: { ...defaultSettings(d), quality: "high", count: 4 } }, priceTable(d, {})).price;
  assert.ok(p1.ok && p4.ok && p4.coins > p1.coins * 3);
});

test("image references stay off until their price is set, then they work", () => {
  const d = g("openai-gpt-image-2");
  const input = { settings: defaultSettings(d), prompt: "make it night", instructions: "", refStyle: "references" as const, refs: [img()] };
  const off = evaluate(d, input, priceTable(d, {}));
  assert.equal(off.refKinds.image.allowed, false);
  assert.equal(off.price.ok, false);
  const on = evaluate(d, input, priceTable(d, { "ref:image": 150 }));
  assert.equal(on.refKinds.image.allowed, true);
  assert.ok(on.price.ok);
  assert.deepEqual(on.issues, []);
});

test("Seedance first frame: ratio fixed to adaptive (no silent crop)", () => {
  const d = g("byteplus-seedance-2-5");
  const e = evaluate(d, { settings: { ...defaultSettings(d), ratio: "9:16" }, prompt: "", instructions: "", refStyle: "frames", refs: [img({ role: "first_frame" })] }, priceTable(d, {}));
  assert.equal(e.mode.id, "first_frame");
  assert.equal(e.settings.ratio, "adaptive");
  assert.deepEqual(e.issues, []);
});

test("frames mode: a file outside the two frame slots (or a frame role outside frames mode) blocks sending", () => {
  const d = g("byteplus-seedance-2-5");
  const base = { settings: defaultSettings(d), prompt: "", instructions: "" };
  const extra = img();
  const e = evaluate(d, { ...base, refStyle: "frames", refs: [img({ role: "first_frame" }), extra] }, priceTable(d, {}));
  assert.ok(e.refProblems[extra.id]?.includes("الإطارين"));
  assert.ok(e.issues.some((i) => i.field === "refs"));
  const stray = img({ role: "first_frame" });
  const o = evaluate(d, { ...base, prompt: "a horse", refStyle: "references", refs: [stray] }, priceTable(d, {}));
  assert.ok(o.refProblems[stray.id]);
});

test("Seedance text-to-video: 9:16 and 16:9 both offered; duration clamped to the model's range", () => {
  const d = g("byteplus-seedance-2-0");
  const e = evaluate(d, { settings: { ...defaultSettings(d), ratio: "9:16", duration: 99 }, prompt: "A drone shot over dunes", instructions: "", refStyle: "frames", refs: [] }, priceTable(d, {}));
  assert.equal(e.mode.id, "text_to_video");
  assert.equal(e.settings.ratio, "9:16");
  assert.equal(e.settings.duration, 15);
});

test("Seedance 2.0 refuses an Arabic prompt; 2.5 accepts it", () => {
  const s20 = g("byteplus-seedance-2-0");
  const s25 = g("byteplus-seedance-2-5");
  const input = { prompt: "طائرة فوق الكثبان", instructions: "", refStyle: "frames" as const, refs: [] };
  assert.ok(evaluate(s20, { ...input, settings: defaultSettings(s20) }, priceTable(s20, {})).issues.some((i) => i.field === "prompt"));
  assert.deepEqual(evaluate(s25, { ...input, settings: defaultSettings(s25) }, priceTable(s25, {})).issues, []);
});

test("Seedance 2.0 omni: audio alone is refused; total audio over 15 s is refused", () => {
  const d = g("byteplus-seedance-2-0");
  const base = { settings: defaultSettings(d), prompt: "x", instructions: "", refStyle: "references" as const };
  const alone = evaluate(d, { ...base, refs: [aud(5000)] }, priceTable(d, {}));
  assert.ok(alone.issues.some((i) => i.message.includes("على الأقل")));
  const long = evaluate(d, { ...base, refs: [img(), aud(9000), aud(9000)] }, priceTable(d, {}));
  assert.ok(long.issues.some((i) => i.message.includes("مجموع")));
});

test("Seedance video references stay off (unverified minimum tokens) until priced", () => {
  const d = g("byteplus-seedance-2-5");
  const e = evaluate(d, { settings: defaultSettings(d), prompt: "x", instructions: "", refStyle: "references", refs: [vid(5000)] }, priceTable(d, {}));
  assert.equal(e.refKinds.video.allowed, false);
  assert.equal(e.price.ok, false);
});

test("a too-small image is refused for Seedance (min side 300) with a clear reason", () => {
  const d = g("byteplus-seedance-2-5");
  const r = img({ width: 200, height: 200 });
  const e = evaluate(d, { settings: defaultSettings(d), prompt: "", instructions: "", refStyle: "references", refs: [r] }, priceTable(d, {}));
  assert.ok(e.refProblems[r.id]?.includes("300"));
  assert.ok(e.issues.some((i) => i.field === "refs"));
});

test("switching to an image generator keeps a video reference but blocks sending it", () => {
  const d = g("openai-gpt-image-2");
  const v = vid(4000);
  const e = evaluate(d, { settings: defaultSettings(d), prompt: "x", instructions: "", refStyle: "references", refs: [v] }, priceTable(d, { "ref:image": 100 }));
  assert.ok(e.refProblems[v.id]);
  assert.ok(e.issues.length > 0);
});

test("audio: no aspect ratio, separate performance text, price waits for the owner", () => {
  const d = g("openai-gpt-4o-mini-tts");
  assert.ok(!d.options.some((o) => o.key === "aspect" || o.key === "ratio"));
  const e = evaluate(d, { settings: defaultSettings(d), prompt: "مرحبًا بكم", instructions: "بهدوء", refStyle: "none", refs: [] }, priceTable(d, {}));
  assert.equal(e.price.ok, false);
  const priced = evaluate(d, { settings: defaultSettings(d), prompt: "مرحبًا بكم", instructions: "بهدوء", refStyle: "none", refs: [] }, priceTable(d, { "chars:1k": 200 }));
  assert.ok(priced.price.ok && priced.price.coins === 2);
});

test("strict (server) mode refuses an unsupported value instead of silently replacing it", () => {
  const d = g("byteplus-seedance-2-5");
  const base = { prompt: "x", instructions: "", refStyle: "frames" as const, refs: [] };
  const loose = evaluate(d, { ...base, settings: { ...defaultSettings(d), ratio: "5:4" } }, priceTable(d, {}));
  assert.equal(loose.settings.ratio, "16:9");
  assert.deepEqual(loose.issues, []);
  const strict = evaluate(d, { ...base, strict: true, settings: { ...defaultSettings(d), ratio: "5:4", duration: 99 } }, priceTable(d, {}));
  assert.ok(strict.issues.some((i) => i.field === "ratio") && strict.issues.some((i) => i.field === "duration"));
  // The studio sends the fixed value of a fixed option: accepted
  const fixed = evaluate(d, { ...base, strict: true, refStyle: "frames", refs: [img({ role: "first_frame" })], settings: { ...defaultSettings(d), ratio: "adaptive" } }, priceTable(d, {}));
  assert.deepEqual(fixed.issues, []);
});

test("price version changes when a price changes", () => {
  const d = g("byteplus-seedance-2-5");
  assert.notEqual(priceVersion(priceTable(d, {})), priceVersion(priceTable(d, { "sec:720p": 999 })));
});

test("all generators have sources, a version and verification notes", () => {
  for (const d of GENERATORS) {
    assert.ok(d.sources.length && d.sources.every((s) => s.url.startsWith("https://") && /^\d{4}-\d{2}-\d{2}$/.test(s.checked)));
    assert.ok(d.model.id && d.model.version);
    assert.ok(d.verification.length);
  }
});

console.log("\nDefault prices (coins):");
for (const d of GENERATORS) for (const k of d.priceKeys) console.log(`  ${d.name.padEnd(16)} ${k.key.padEnd(18)} ${k.defaultCenti == null ? "— (owner decides)" : (k.defaultCenti / 100).toFixed(2)}`);
console.log(`\n${passed} passed`);
