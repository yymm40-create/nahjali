import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FILM_STYLES, GUIDE_STYLE_IDS, STYLE_FAMILIES, familySchools, styleImage, stylePicturePrompt } from "@config/film-styles";
import { CARTOON_ONLY, CARTOON_STYLES } from "@config/jawad/cartoon";
import { withStyle } from "@config/jawad/style-prompt";
import { assistantSystem, checkAnswer } from "@config/jawad/assistant";
import { GENERATORS } from "@config/jawad/generators";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("«الستايل» and one «جواد» for the studios", () => {
  it("keeps the course guide's 24, same ids and names, each with its shipped picture", () => {
    const guide = FILM_STYLES.filter((s) => GUIDE_STYLE_IDS.has(s.id));
    expect(guide).toHaveLength(24);
    for (const s of guide) expect(() => readFileSync(new URL(`../../public/film/styles/${s.id}.jpg`, import.meta.url))).not.toThrow();
    const order = ["pixar-classic", "pixar-caricature", "illumination", "neo-disney", "pixar-natural", "dreamworks-epic", "shinkai", "seinen", "dreamworks-painterly", "hybrid-2d3d", "drawn-over-cg", "golden-2d", "ghibli", "pixar-abstract", "comic-print", "modern-shonen", "anime-western", "dreamworks-satire", "retro-cel", "3dcg-anime", "auteur", "stylistic-drift", "chibi", "renaissance-90s"];
    expect(order.map((id) => FILM_STYLES.find((s) => s.id === id)!.name)).toEqual([
      "بيكسار الكلاسيكية", "بيكسار الكاريكاتيرية", "إلومينيشن", "النيو-ديزني", "بيكسار الطبيعية", "دريم ووركس الملحمي",
      "شينكاي", "سايبربانك / ساينن", "دريم ووركس اللوحي", "الهجين 2D/3D", "المرسوم فوق CG", "العصر الذهبي 2D",
      "جيبلي", "بيكسار التجريدي", "الكوميكس المطبوع", "شونين حديث", "الهجين الأنمي-غربي", "دريم ووركس الساخر",
      "ريترو سِل", "3DCG أنمي", "تجريبي / مؤلف", "الانحراف الأسلوبي", "موي / تشيبي", "نهضة التسعينات",
    ]);
  });
  it("«خريطة الستايلات»: 100 base styles in 14 families, each under a studio or school", () => {
    expect(FILM_STYLES).toHaveLength(100);
    expect(new Set(FILM_STYLES.map((s) => s.id)).size).toBe(100);
    expect(STYLE_FAMILIES).toHaveLength(14);
    for (const f of STYLE_FAMILIES) {
      const list = FILM_STYLES.filter((s) => s.family === f.id);
      expect(list.length, f.id).toBeGreaterThanOrEqual(3);
      expect(familySchools(f.id).length, f.id).toBeGreaterThanOrEqual(2);
      for (const s of list) expect(s.group).toBe(f.name);
    }
    // 3D has its companies under it, the way the owner asked
    expect(familySchools("3d")).toEqual(expect.arrayContaining(["بيكسار", "دريم ووركس", "ديزني", "إلومينيشن", "سوني بيكتشرز أنيميشن"]));
    // the families come in the map's order, never mixed
    const order = FILM_STYLES.map((s) => STYLE_FAMILIES.findIndex((f) => f.id === s.family));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const s of FILM_STYLES) {
      expect(s.school.length, s.id).toBeGreaterThan(1);
      expect(s.description && s.feel && s.bestFor, s.id).toBeTruthy();
    }
    // the new ones are whole looks (line, shading, palette, light, material), with nothing left to fill in
    for (const s of FILM_STYLES.filter((x) => !GUIDE_STYLE_IDS.has(x.id))) {
      expect(s.text.split(/\s+/).length, s.id).toBeGreaterThanOrEqual(22);
      expect(s.text, s.id).not.toContain("[");
    }
  });
  it("carries every look of «حولني الى الستايل الكرتوني» into the map", () => {
    for (const c of CARTOON_STYLES.filter((x) => !CARTOON_ONLY.includes(x.id))) expect(FILM_STYLES.filter((s) => s.cartoon === c.id), c.id).toHaveLength(1);
  });
  it("a new style shows its family's tile until the owner draws its picture once, from its family's scene", () => {
    const fresh = FILM_STYLES.filter((s) => !GUIDE_STYLE_IDS.has(s.id));
    expect(fresh).toHaveLength(76);
    for (const s of fresh) expect(styleImage(s.id)).toBeNull();
    const p = stylePicturePrompt("persian-miniature");
    expect(p).toContain(STYLE_FAMILIES.find((f) => f.id === "heritage")!.scene);
    expect(p).toContain(FILM_STYLES.find((s) => s.id === "persian-miniature")!.text);
    expect(p).toContain("No writing");
    expect(read("src/lib/film/style-pictures.ts")).toContain("upsert: true");
    expect(read("src/app/admin/film/page.tsx")).toContain("<StylePictures />");
    for (const f of ["src/app/film/_views/Sheets.tsx", "src/app/api/content/templates/route.ts"]) expect(read(f)).toContain("stylePicturesSafe()");
    expect(read("src/app/film/[id]/sheets/SheetsWorkspace.tsx")).toContain("<StyleBrowser");
    expect(read("src/components/jawad/studio/StylePicker.tsx")).toContain("<StyleBrowser");
  });
  it("puts the style's text in what the generator reads, keeping motion video-only", () => {
    const out = withStyle("قطة على سطح", FILM_STYLES[0].text);
    expect(out.startsWith("قطة على سطح")).toBe(true);
    expect(out).toContain(FILM_STYLES[0].text);
    const moving = FILM_STYLES.find((style) => style.videoText)!;
    expect(withStyle("قطة على سطح", moving.text)).not.toContain(moving.videoText);
    expect(withStyle("قطة على سطح", moving.text, moving.videoText)).toContain(`VIDEO MOTION: ${moving.videoText}`);
    expect(read("src/lib/jawad/server/jobs.ts")).toContain('def.output === "video" ? style.videoText : undefined');
  });
  it("contains no negative prompt or blanket ban on text and logos", () => {
    const library = FILM_STYLES.map((style) => `${style.text} ${style.videoText ?? ""}`).join("\n").toLowerCase();
    expect(library).not.toContain("negative prompt");
    expect(library).not.toContain("watermark");
    expect(library).not.toContain("logo");
    expect(library).not.toMatch(/pixar|dreamworks|disney|ghibli|shinkai|ufotable|spider-verse|kpop/);
    expect(library).not.toMatch(/\b(arcane|fortiche|illumination|sony|laika|aardman|burton|anderson|lego|minecraft|zelda|nintendo|blizzard|warcraft|overwatch|fortnite|mihoyo|genshin|marvel|moebius|lichtenstein|tintin|herg[eé]|kurzgesagt|saloon|klaus|bluth|hanna|barbera|fleischer|looney|warner|upa|tartakovsky|kyoto|science saru|toei|gundam|studio mir|reiniger|south park|vincent|wasiti|villeneuve|bbc|wong kar|blade runner|sin city|mappa|webtoon™)\b/);
    expect(read("src/lib/film/sheets.ts")).toContain("findStyle(styleId)!.text");
    expect(read("src/components/jawad/studio/StylePicker.tsx")).toContain("FILM_STYLES");
  });
  it("جواد knows the styles (not for sound) and may pick one", () => {
    const img = GENERATORS.filter((g) => g.output === "image").slice(0, 1);
    expect(assistantSystem("image", img)).toContain("shinkai");
    expect(assistantSystem("audio", GENERATORS.filter((g) => g.output === "audio").slice(0, 1))).not.toContain("shinkai");
    const draft = { generatorId: img[0].id, prompt: "", instructions: "", settings: {}, refStyle: "none" as const, refs: [], styleId: "" };
    expect(checkAnswer({ reply: "تم", styleId: "ghibli" } as never, { defs: img, draft, attachments: 0 }).set.styleId).toBe("ghibli");
    expect(checkAnswer({ reply: "تم", styleId: "nope" } as never, { defs: img, draft, attachments: 0 }).set.styleId).toBeUndefined();
  });
  it("one conversation for every studio, with past conversations", () => {
    expect(read("src/components/jawad/studio/Studio.tsx")).toContain("storage={user.id}");
    const chat = read("src/components/jawad/studio/AssistantChat.tsx");
    expect(chat).toContain("محادثاتي");
    expect(chat).toContain("KEEP_CHATS");
  });
});

describe("«برومبت ثاني وثالث»", () => {
  it("جواد fills up to two more prompts with the references each one uses, by known names only", async () => {
    const { checkAnswer } = await import("@config/jawad/assistant");
    const { GENERATORS } = await import("@config/jawad/generators");
    const img = GENERATORS.filter((g) => g.output === "image").slice(0, 1);
    const draft = { generatorId: img[0].id, prompt: "", instructions: "", settings: {}, refStyle: "references" as const, refs: [{ uploadId: "u1", name: "ali", kind: "image" as const, role: "reference" as const }, { uploadId: "u2", name: "cat", kind: "image" as const, role: "reference" as const }], styleId: "" };
    const r = checkAnswer({ reply: "تم", extraPrompts: [{ prompt: "ثاني", refs: ["@cat", "dog"] }, { prompt: "ثالث", refs: [] }, { prompt: "رابع", refs: [] }], mainRefs: ["ali"] } as never, { defs: img, draft, attachments: 0 });
    expect(r.set.extra).toEqual([{ prompt: "ثاني", refs: ["cat"] }, { prompt: "ثالث", refs: null }]);
    expect(r.set.mainRefs).toEqual(["ali"]);
    expect(checkAnswer({ reply: "x", extraPrompts: [{ prompt: "", refs: [] }] } as never, { defs: img, draft, attachments: 0 }).set.extra).toEqual([]);
  });
  it("the studio sends one generation per prompt with its own references and price", () => {
    const s = readFileSync(new URL("../../src/components/jawad/studio/Studio.tsx", import.meta.url), "utf8");
    expect(s).toContain("async function submitAll()");
    expect(s).toContain("await submit(x.ev.price.coins, { prompt: x.prompt, refs: x.refs })");
  });
});
