import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CONTENT_PALETTES, findPalette } from "@config/content-palettes";
import { readQuestions } from "@/lib/content/chats";

// «معرض الألوان»: 100 different four-colour palettes from Color Hunt, a gallery the person picks from in «صانع المحتوى».
describe("the colour gallery", () => {
  it("holds 100 different palettes of four colours each, in four groups", () => {
    expect(CONTENT_PALETTES).toHaveLength(100);
    expect(new Set(CONTENT_PALETTES.map((p) => p.id)).size).toBe(100);
    expect(new Set(CONTENT_PALETTES.map((p) => p.colors.join())).size).toBe(100);
    for (const p of CONTENT_PALETTES) {
      expect(p.colors).toHaveLength(4);
      for (const c of p.colors) expect(c).toMatch(/^#[0-9A-F]{6}$/);
      expect(p.id).toBe(`ch-${p.colors.map((c) => c.slice(1).toLowerCase()).join("")}`);
      expect(p.name.length).toBeGreaterThan(2);
    }
    expect(new Set(CONTENT_PALETTES.map((p) => p.group))).toEqual(new Set(["داكنة وفخمة", "ملوّنة وحيوية", "ناعمة وباستيل", "فاتحة وهادئة"]));
    // the royal navy the owner chose is among them
    expect(findPalette("ch-0107360d1c4222396ffcf1d0")?.name).toBe("كحلي ملكي وكريمي");
  });

  it("a question can open it, the page shows it, and he is told to ask with it", () => {
    expect(readQuestions([{ label: "الألوان؟", kind: "palettes", options: [], multi: false }])).toEqual([{ label: "الألوان؟", kind: "palettes", options: [], multi: false }]);
    expect(readFileSync("src/app/api/content/templates/route.ts", "utf8")).toContain("palettes: CONTENT_PALETTES.map(");
    const page = readFileSync("src/components/jawad/content/ContentChat.tsx", "utf8");
    expect(page).toContain("palettes: { open:");
    expect(page).toContain("if (item.swatch)");
    expect(readFileSync("config/content.ts", "utf8")).toContain('kind="palettes"');
    expect(readFileSync("src/lib/content/chat.ts", "utf8")).toContain('"moods", "palettes"]');
  });
});
