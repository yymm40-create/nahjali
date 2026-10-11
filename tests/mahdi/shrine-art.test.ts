import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PICKED_THEMES } from "@config/mahdi";
import { SHRINE_PLACES, SHRINE_SPECS, readPlace, shrineParts, shrineSpec } from "@/lib/mahdi/shrine-art";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("the holy shrines, drawn in code", () => {
  it("every shrine that has a picture has its own drawing", () => {
    const pictures = readdirSync(new URL("../../public/mahdi/shrines", import.meta.url)).map((f) => f.replace(/\.jpg$/, ""));
    for (const id of pictures) expect(SHRINE_SPECS[id], id).toBeTruthy();
    expect(shrineSpec("unknown")).toBe(SHRINE_SPECS["imam-ali"]);
  });

  it("each drawing has its domes and minarets, inside the frame", () => {
    for (const [id, spec] of Object.entries(SHRINE_SPECS)) {
      const parts = shrineParts(spec);
      expect(parts.some((p) => p.role === "dome"), id).toBe(true);
      expect(parts.filter((p) => p.role === "minaret").length, id).toBeGreaterThanOrEqual(spec.minarets.length);
      // every shape starts (M) inside the 400 × 200 frame
      for (const p of parts) for (const [, x, y] of p.d.matchAll(/M(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)) {
        expect(Number(x), `${id} x`).toBeGreaterThanOrEqual(-1);
        expect(Number(x), `${id} x`).toBeLessThanOrEqual(401);
        expect(Number(y), `${id} y`).toBeGreaterThanOrEqual(0);
        expect(Number(y), `${id} y`).toBeLessThanOrEqual(200);
      }
    }
  });

  it("the golden domes are gold, the Prophet's is green, Jamkaran's turquoise", () => {
    expect(SHRINE_SPECS["imam-ali"].domes[0].tint).toBe("gold");
    expect(SHRINE_SPECS.prophet.domes[0].tint).toBe("green");
    expect(SHRINE_SPECS.jamkaran.domes[0].tint).toBe("turquoise");
    expect(SHRINE_SPECS.kadhimiya.domes.length).toBe(2);
  });
});

describe("every design draws it, and the person chooses where", () => {
  it("each of the twenty designs has a drawing style and a place", () => {
    for (const d of PICKED_THEMES) {
      expect(["gold", "flat", "outline", "silhouette", "line", "glow", "gradient", "dots", "sketch"], d.key).toContain(d.art);
      expect(["backdrop", "banner", "horizon", "photo"], d.key).toContain(d.place);
    }
    expect(new Set(PICKED_THEMES.map((d) => d.art)).size).toBe(9);
    expect(new Set(PICKED_THEMES.map((d) => d.place)).size).toBe(4);
  });

  it("the places are offered, read safely, saved with the account (0064)", () => {
    expect(SHRINE_PLACES.map((p) => p.id)).toEqual(["auto", "backdrop", "banner", "horizon", "photo", "off"]);
    expect(readPlace("banner")).toBe("banner");
    expect(readPlace("x")).toBe("auto");
    expect(read("supabase/migrations/0064_mahdi_shrine_place.sql")).toContain("shrine_place");
    expect(read("src/app/api/mahdi/profile/route.ts")).toContain("shrinePlace");
    expect(read("src/app/mahdi/(app)/more/page.tsx")).toContain("SHRINE_PLACES");
  });

  it("drawn in code, not a generated picture (the photo is only the «photo» place)", () => {
    const art = read("src/components/mahdi/ShrineArt.tsx");
    expect(art).toContain("<svg");
    expect(art).not.toMatch(/openai|gpt-image/i);
  });
});
