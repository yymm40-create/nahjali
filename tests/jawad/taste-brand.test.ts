import { beforeEach, describe, expect, it, vi } from "vitest";
import { GENERATORS, generatorById } from "@config/jawad/generators";
import { withStyle } from "@config/jawad/style-prompt";
import {
  brandBrief,
  cleanBrand,
  cleanHex,
  cleanTasteName,
  labelsOf,
  lookRefNames,
  ownRowProblem,
  pickLookRefs,
  picturesProblem,
  readTasteAnalysis,
  scrubNames,
  STYLE_REF_GENERATORS,
  styleRefRoom,
  TASTE_LIMIT,
  TASTE_REFS_MAX,
  takesStyleRefs,
  tasteNameProblem,
  tasteText,
  withBrand,
  withTaste,
} from "@config/jawad/taste";
import { FEATURES } from "@config/feature-use";
import type { RefMeta } from "@config/jawad/types";

// «الاستوديو الإبداعي»: «🎨 ذوقي» (tastes from the person's pictures) and «هويتي» (the brand kit).

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const T1 = "33333333-3333-4333-8333-333333333333";
const pic = (id: string): RefMeta => ({ id, kind: "image", role: "reference", mime: "image/png", bytes: 200_000, width: 1024, height: 1024, status: "ready" });

describe("«ذوقي»: the prompt", () => {
  it("adds the taste's words after the person's prompt (kept as written), like a library style", () => {
    const p = withTaste("  قطة على سطح  ", "Palette: #112233.\nLight: soft dusk light");
    expect(p.startsWith("قطة على سطح\n\nTASTE")).toBe(true);
    expect(p).toContain("Palette: #112233.\nLight: soft dusk light");
    expect(p).toContain("never changes who or what is shown");
    expect(p).not.toContain("STYLE REFERENCES");
  });

  it("names the pictures that went with it as style references only", () => {
    const p = withTaste("x", "Mood: calm", ["Image 2", "Image 3"]);
    expect(p).toContain("STYLE REFERENCES: Image 2, Image 3");
    expect(p).toMatch(/ONLY for the look/);
    expect(p).toMatch(/Never copy their people, faces, identities/);
    expect(withTaste("x", "Mood: calm", ["Image 1"])).toMatch(/use it ONLY[^]*Never copy its people/);
  });

  it("goes after a library style when both are chosen", () => {
    const p = withTaste(withStyle("x", "Ghibli watercolour"), "Mood: calm");
    expect(p.indexOf("STYLE (")).toBeLessThan(p.indexOf("TASTE ("));
  });

  it("labels the extra pictures the way the model numbers them", () => {
    const all = [{ id: "a", kind: "image" as const }, { id: "v", kind: "video" as const }, { id: "t1", kind: "image" as const }, { id: "t2", kind: "image" as const }];
    expect(labelsOf(all, ["t1", "t2"], (_k, n) => `Image ${n}`)).toEqual(["Image 2", "Image 3"]);
    expect(labelsOf(all, ["t1"])).toEqual(["image 2"]);
  });

  it("the written look: hex palette, the named parts, no maker's names", () => {
    const a = readTasteAnalysis(
      { summary: "  ألوان دافئة   وضوء ناعم ", palette: ["#AABBCC", "abc", "red", "#aabbcc"], light: "Golden hour, in the style of Roger Deakins.", texture: "Fine film grain", composition: "Wide, low angle", mood: "Nostalgic", keep: [9, 2, 2, 0, 3] },
      5,
    )!;
    expect(a.summary).toBe("ألوان دافئة وضوء ناعم");
    // «abc» is #aabbcc too: one of each, bad ones dropped
    expect(a.palette).toEqual(["#aabbcc"]);
    expect(a.light).not.toMatch(/Deakins/);
    // Claude's choice first (only real picture numbers, no repeats), filled with the first pictures up to 4
    expect(a.keep).toEqual([2, 3, 1, 4]);
    expect(tasteText(a).startsWith("Palette: #aabbcc.\nLight: Golden hour")).toBe(true);
    expect(tasteText(a)).toContain("Composition: Wide, low angle");
    // nothing usable → null (the person is refunded)
    expect(readTasteAnalysis({ summary: "x", palette: [], light: "", texture: "", composition: "", mood: "calm", keep: [] }, 3)).toBeNull();
    expect(readTasteAnalysis(null, 3)).toBeNull();
  });

  it("scrubs a maker's name, keeps plain words", () => {
    expect(scrubNames("Soft light inspired by Wes Anderson, pastel walls")).toBe("Soft light, pastel walls");
    expect(scrubNames("lit by a window")).toBe("lit by a window");
    expect(cleanHex("#ABC")).toBe("#aabbcc");
    expect(cleanHex("12ab34")).toBe("#12ab34");
    expect(cleanHex("blue")).toBeNull();
  });
});

describe("«ذوقي»: style references only where the generator takes them", () => {
  it("every allowed generator is a picture generator with several reference pictures", () => {
    for (const id of STYLE_REF_GENERATORS) {
      const g = generatorById(id);
      expect(g, id).toBeDefined();
      expect(g!.output).toBe("image");
      expect(g!.modes.some((m) => m.refStyle === "references" && (m.refs.image?.max ?? 0) > 0), id).toBe(true);
    }
  });

  it("never a video or sound generator (their references are identity), never frames", () => {
    for (const g of GENERATORS) {
      const any = takesStyleRefs(g, "references") || takesStyleRefs(g, "none") || takesStyleRefs(g, "frames");
      if (g.output !== "image") expect(any, g.id).toBe(false);
      expect(takesStyleRefs(g, "frames"), g.id).toBe(false);
      expect(any, g.id).toBe(STYLE_REF_GENERATORS.includes(g.id));
    }
  });

  it("GPT Image 2.6 only in PNG (GIF and SVG take no reference pictures)", () => {
    const g = generatorById("openai-gpt-image-2-6")!;
    expect(takesStyleRefs(g, "references", { format: "png" })).toBe(true);
    expect(takesStyleRefs(g, "references", { format: "gif" })).toBe(false);
    expect(takesStyleRefs(g, "references", { format: "svg" })).toBe(false);
  });

  it("room: the generator's limit beside the person's own pictures, at most 4 + the logo", () => {
    const ideo = generatorById("ideogram-v3")!; // 3 style pictures
    expect(styleRefRoom(ideo, "references", {}, 0)).toBe(3);
    expect(styleRefRoom(ideo, "references", {}, 2)).toBe(1);
    expect(styleRefRoom(ideo, "references", {}, 3)).toBe(0);
    const gpt = generatorById("openai-gpt-image-2")!; // 16
    expect(styleRefRoom(gpt, "references", {}, 0)).toBe(TASTE_REFS_MAX + 1);
    expect(styleRefRoom(generatorById("kling-3-pro")!, "references", {}, 0)).toBe(0);
  });

  it("the logo first, then up to 4 of the taste's pictures, only those that fit", () => {
    const taste = ["t1", "t2", "t3", "t4"].map(pic);
    expect(pickLookRefs({ room: 5, logo: pic("L"), taste })).toEqual({ logo: pic("L"), taste });
    expect(pickLookRefs({ room: 3, logo: pic("L"), taste }).taste.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(pickLookRefs({ room: 0, logo: pic("L"), taste })).toEqual({ logo: null, taste: [] });
    expect(pickLookRefs({ room: 5, taste, fits: (r) => r.id !== "t2" }).taste.map((t) => t.id)).toEqual(["t1", "t3", "t4"]);
    expect(pickLookRefs({ room: 9, taste: [...taste, pic("t5")] }).taste).toHaveLength(TASTE_REFS_MAX);
  });

  it("their names never clash with the person's references", () => {
    expect(lookRefNames(["image1", "taste_1", "Brand_Logo"], 2, true)).toEqual({ logo: "brand_logo_2", taste: ["taste_1_2", "taste_2"] });
    expect(lookRefNames([], 0, false)).toEqual({ logo: null, taste: [] });
  });

  it("the studio's quote adds the same pictures the server will", async () => {
    const { lookRefItems } = await import("@/components/jawad/studio/TasteBrand");
    const picture = (id: string) => ({ id, url: `https://x/${id}.png`, mime: "image/png", bytes: 1000, width: 512, height: 512 });
    const look = {
      migrated: true,
      tastes: [{ id: T1, name: "دافي", summary: "", palette: [], text: "Mood: warm", pictures: ["p1", "p2", "p3", "p4"].map(picture), sourceCount: 6, createdAt: "" }],
      brand: { colors: ["#112233"], fonts: [], voice: "", logoUploadId: "L", logo: picture("L") },
    };
    const ideo = generatorById("ideogram-v3")!;
    const items = lookRefItems(ideo, "references", {}, [], look, T1, { on: true, logo: true });
    expect(items.map((r) => [r.uploadId, r.name, r.role])).toEqual([["L", "brand_logo", "reference"], ["p1", "taste_1", "reference"], ["p2", "taste_2", "reference"]]);
    expect(lookRefItems(generatorById("kling-3-pro")!, "references", {}, [], look, T1, { on: true, logo: true })).toEqual([]);
    expect(lookRefItems(ideo, "references", {}, [], { ...look, migrated: false }, T1, undefined)).toEqual([]);
  });
});

describe("«هويتي»: the brand kit", () => {
  it("is cleaned to its limits", () => {
    const k = cleanBrand({ colors: ["#000", "#111111", "nope", "#222222", "#333333", "#444444", "#555555", "#666666"], fonts: ["cairo", "made-up", "tajawal", "almarai"], voice: `  ودود  ${"و".repeat(300)}`, logoUploadId: "not-a-uuid" });
    expect(k.colors).toEqual(["#000000", "#111111", "#222222", "#333333", "#444444", "#555555"]);
    expect(k.fonts).toEqual(["cairo", "tajawal"]);
    expect(k.voice.length).toBe(160);
    expect(k.voice.startsWith("ودود و")).toBe(true);
    expect(k.logoUploadId).toBeNull();
    expect(cleanBrand({ logoUploadId: A }).logoUploadId).toBe(A);
  });

  it("adds colours, fonts and voice to a picture; the logo by its label", () => {
    const kit = cleanBrand({ colors: ["#ff0000", "#00ff00"], fonts: ["cairo"], voice: "ودود وواثق" });
    const p = withBrand("بوستر عرض", kit, "image", "Image 3");
    expect(p.startsWith("بوستر عرض\n\nBRAND")).toBe(true);
    expect(p).toContain("#ff0000, #00ff00");
    expect(p).toMatch(/Arabic text set in .*Cairo/);
    expect(p).toContain("brand voice and tone: ودود وواثق");
    expect(p).toMatch(/BRAND LOGO: Image 3 .*exactly as drawn/);
  });

  it("a video gets the colours and voice (no fonts, no logo); a sound nothing", () => {
    const kit = cleanBrand({ colors: ["#ff0000"], fonts: ["cairo"], voice: "هادي" });
    const v = withBrand("مشهد", kit, "video", "Image 1");
    expect(v).toContain("#ff0000");
    expect(v).toContain("هادي");
    expect(v).not.toMatch(/Cairo|BRAND LOGO/);
    expect(withBrand("صوت", kit, "audio")).toBe("صوت");
    expect(withBrand("x", cleanBrand({}), "image")).toBe("x");
  });

  it("is read by other sections as a few plain lines", () => {
    expect(brandBrief(cleanBrand({}))).toBe("");
    const b = brandBrief(cleanBrand({ colors: ["#ff0000"], fonts: ["cairo"], voice: "ودود", logoUploadId: A }));
    expect(b).toContain("#ff0000");
    expect(b).toContain("القاهرة");
    expect(b).toContain("ودود");
    expect(b).toContain("شعار");
  });
});

describe("«ذوقي» and «هويتي»: limits", () => {
  it("names: 1–30 letters, one of each per person, at most 20 tastes", () => {
    expect(cleanTasteName("  دافي   وسينمائي ")).toBe("دافي وسينمائي");
    expect(cleanTasteName("  ")).toBeNull();
    expect(cleanTasteName("ا".repeat(31))).toBeNull();
    const mine = [{ id: T1, name: "أحلام" }];
    expect(tasteNameProblem("احلام", mine)).toMatch(/عندك ذوق/);
    expect(tasteNameProblem("احلام", mine, T1)).toBeNull();
    expect(tasteNameProblem(null, mine)).toMatch(/اسم الذوق/);
    const full = Array.from({ length: TASTE_LIMIT }, (_, i) => ({ id: `t${i}`, name: `ذوق ${i}` }));
    expect(tasteNameProblem("جديد", full)).toMatch(/حد الأذواق/);
    expect(tasteNameProblem("جديد", full, "t3")).toBeNull();
  });

  it("pictures: 3 to 20, no repeats", () => {
    expect(picturesProblem(["a", "b"])).toMatch(/٣ صور على الأقل|3 صور على الأقل/);
    expect(picturesProblem(["a", "b", "c"])).toBeNull();
    expect(picturesProblem(["a", "a", "b", "c"])).toMatch(/مكررة/);
    expect(picturesProblem(Array.from({ length: 21 }, (_, i) => `p${i}`))).toMatch(/الحد/);
  });

  it("counts its features under the studio", () => {
    for (const id of ["studio.taste_make", "studio.taste_use", "studio.taste_manage", "studio.brand_save", "studio.brand_use"]) {
      expect(FEATURES.find((f) => f.id === id)?.section, id).toBe("studio");
    }
  });
});

describe("«ذوقي» and «هويتي»: only the person's own rows", () => {
  const state = vi.hoisted(() => ({
    tastes: [] as Record<string, unknown>[],
    uploads: [] as Record<string, unknown>[],
    rpc: [] as unknown[],
    deletes: [] as string[],
    updates: [] as string[],
  }));
  vi.mock("@/lib/supabase/admin", () => {
    const builder = (table: string) => {
      let op = "select";
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "in", "or", "is", "limit", "contains", "like", "lt", "insert", "upsert"]) b[m] = () => b;
      b.delete = () => ((op = "delete"), state.deletes.push(table), b);
      b.update = () => ((op = "update"), state.updates.push(table), b);
      const result = () => {
        if (op !== "select") return { data: null, error: null };
        if (table === "jawad_tastes") return { data: state.tastes, error: null };
        if (table === "jawad_uploads") return { data: state.uploads, error: null };
        return { data: null, error: null };
      };
      b.maybeSingle = async () => {
        const r = result();
        return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: null };
      };
      b.single = b.maybeSingle;
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve(result()).then(ok);
      return b;
    };
    return { createAdminClient: () => ({ from: builder, rpc: async (...a: unknown[]) => (state.rpc.push(a), { data: 100, error: null }) }) };
  });
  vi.mock("@/lib/storage", () => ({ storage: { from: () => ({ createSignedUrls: async (p: string[]) => ({ data: p.map((x) => ({ signedUrl: `https://s/${x}` })) }), remove: async () => ({}) }) } }));
  beforeEach(() => {
    state.tastes = [{ id: T1, user_id: B, name: "ذوق غيره", description: "Mood: x", summary: "", palette: [], ref_upload_ids: [], source_count: 3, created_at: "" }];
    state.uploads = [];
    state.rpc = [];
    state.deletes = [];
    state.updates = [];
  });

  it("someone else's taste can't be used, renamed or deleted", async () => {
    const { deleteTaste, lookFor, renameTaste } = await import("@/lib/jawad/server/taste");
    await expect(lookFor(A, { tasteId: T1 })).rejects.toThrow(/ما لقينا هذا الذوق/);
    await expect(renameTaste(A, T1, "اسمي")).rejects.toThrow(/ما لقينا هذا الذوق/);
    await expect(deleteTaste(A, T1)).rejects.toThrow(/ما لقينا هذا الذوق/);
    expect(state.deletes).toEqual([]);
    expect(state.updates).toEqual([]);
  });

  it("their own taste is found", async () => {
    state.tastes[0].user_id = A;
    const { lookFor } = await import("@/lib/jawad/server/taste");
    const look = await lookFor(A, { tasteId: T1 });
    expect(look?.taste?.id).toBe(T1);
    expect(look?.brand).toBeNull();
    expect(await lookFor(A, {})).toBeNull();
  });

  it("a taste is made only from the person's own checked pictures, before anything is charged", async () => {
    state.tastes = [];
    // only one of the three pictures is theirs (the database answers with their rows only)
    state.uploads = [{ id: A, user_id: A, kind: "image", status: "ready", storage_path: "a.png", file_name: "", mime: "image/png", bytes: 1, width: 1, height: 1, duration_ms: null, fps: null, error: null, created_at: "" }];
    const { makeTaste } = await import("@/lib/jawad/server/taste");
    const ids = [A, B, T1];
    await expect(makeTaste({ id: A }, false, { key: "abcdefgh12", name: "ذوقي", uploadIds: ids, expectedCoins: 50 })).rejects.toThrow(/مو لك/);
    await expect(makeTaste({ id: A }, false, { key: "abcdefgh12", name: "ذوقي", uploadIds: [A, B], expectedCoins: 50 })).rejects.toThrow(/٣|3/);
    expect(state.rpc).toEqual([]);
  });

  it("ownership is the row's own person, the same answer for none", () => {
    expect(ownRowProblem(A, { ownerId: A })).toBeNull();
    expect(ownRowProblem(A, { ownerId: B })).toMatch(/ما لقينا/);
    expect(ownRowProblem(A, null)).toMatch(/ما لقينا/);
    expect(ownRowProblem(A, { ownerId: null })).toMatch(/ما لقينا/);
  });
});
