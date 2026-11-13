import { describe, expect, it } from "vitest";
import { CREATIVE_METHODS, creativeMethod, promptUse } from "@config/jawad/creative";
import { generatorById } from "@config/jawad/generators";
import { findStyle } from "@config/film-styles";
import { refKindOfTag } from "@/lib/jawad/creative-use";

const all = CREATIVE_METHODS.flatMap((m) => m.steps.flatMap((s) => (s.prompts ?? []).map((p) => ({ m: m.slug, p }))));

// «جرّبه في الاستوديو»: every prompt on «طرق إبداعية» opens the studio on a real generator with settings it has.
describe("creative methods → Creative Studio hand-off", () => {
  it("every prompt has a generator the studio knows, with valid settings and style", () => {
    for (const { m, p } of all) {
      const u = promptUse(p);
      expect(u, `${m} · ${p.label}`).not.toBeNull();
      const def = generatorById(u!.generatorId);
      expect(def, `${m} · ${p.label} → ${u!.generatorId}`).toBeTruthy();
      for (const [k, v] of Object.entries(u!.settings ?? {})) {
        const o = def!.options.find((x) => x.key === k);
        expect(o, `${m} · ${p.label}: option ${k}`).toBeTruthy();
        if (o!.kind === "choice") expect(o!.values!.map((x) => x.value), `${m} · ${p.label}: ${k}=${v}`).toContain(v);
        if (o!.kind === "int") expect(typeof v === "number" && v >= (o!.min ?? 0) && v <= (o!.max ?? 1e9), `${m} · ${p.label}: ${k}=${v}`).toBe(true);
      }
      if (u!.styleId) expect(findStyle(u!.styleId), u!.styleId).toBeTruthy();
      if (u!.refStyle) expect(def!.modes.some((x) => x.refStyle === u!.refStyle)).toBe(true);
      if (def!.prompt?.max) expect(p.text.length, `${m} · ${p.label} is longer than ${def!.name} takes`).toBeLessThanOrEqual(def!.prompt.max);
    }
  });

  it("reads the generator and settings from the labels when a method doesn't spell them out", () => {
    expect(promptUse({ label: "x", tool: "Wan 3.0", settings: "٨ ث · 1080p · 9:16", text: "t", refs: [{ tag: "@img1", name: "a" }] })).toEqual({
      generatorId: "wan-3-0", settings: { ratio: "9:16", resolution: "1080p", duration: 8 }, refStyle: "references",
    });
    expect(promptUse({ label: "x", tool: "GPT Image 2 · جودة متوسطة", settings: "16:9", text: "t" })).toEqual({ generatorId: "openai-gpt-image-2", settings: { aspect: "16:9", quality: "medium" } });
    expect(promptUse({ label: "x", tool: "Seedance 2.0", settings: "١٢ ث · 1080p · ١٦:٩", text: "t" })?.settings).toEqual({ ratio: "16:9", resolution: "1080p", duration: 12 });
    expect(promptUse({ label: "x", tool: "Something else", text: "t" })).toBeNull();
    expect(promptUse({ label: "x", tool: "Wan 3.0", text: "t", use: null })).toBeNull();
  });

  it("knows which kind of reference a prompt tag stands for", () => {
    expect(["@img1", "@image3", "@aud1", "@video2", "صورة"].map(refKindOfTag)).toEqual(["image", "image", "audio", "video", null]);
  });

  it("«من كلاود إلى الجواد» keeps the approved prompts and settings", () => {
    const m = creativeMethod("claude-carpet")!;
    expect(m).toBeTruthy();
    const ps = m.steps.flatMap((s) => s.prompts ?? []);
    expect(ps.map((p) => p.label)).toEqual(["شيت الشخصية", "شيت المكان", "شيت الزولية", "الفيديو"]);
    const video = ps[3];
    expect(promptUse(video)).toMatchObject({ generatorId: "wan-3-0", settings: { duration: 20, resolution: "480p", ratio: "9:16" }, styleId: "football-drift" });
    expect(video.refs?.map((r) => r.tag)).toEqual(["@image1", "@image2", "@image3"]);
    expect(JSON.parse(video.text)).toHaveLength(2);
  });
});
