import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dir = new URL("../../src/components/jawad/student/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
const read = (f: string) => readFileSync(new URL(f, dir), "utf8");

// «مب محطوطة تسعيرتنا، محطوط قمر»: in «الطالب الذكي» the balance showed an emoji coin (a moon on some phones) and the raw
// halalas, not the coin's own logo and the formatted amount every other price of the site has.
describe("«الطالب الذكي» shows every price as our logo and the amount, never an emoji or a currency word", () => {
  it("has no emoji coin or moon anywhere in its pages", () => {
    for (const f of files) for (const emoji of ["🪙", "🌙", "🌛", "🌜", "☪", "💰", "💵"]) expect(read(f), `${f} ${emoji}`).not.toContain(emoji);
  });

  it("shows the balance in the header through the shared price logo, from halalas", () => {
    const project = read("StudentProject.tsx");
    expect(project).toContain('import Riyal from "@/components/Riyal"');
    expect(project).toContain("<Riyal halalas={p.state.balance}");
    // no raw number of halalas written beside the balance
    expect(project).not.toMatch(/>\s*\{p\.state\.balance\}/);
  });

  it("writes no currency word beside a price (the logo is the currency)", () => {
    for (const f of files) {
      const src = read(f);
      expect(src, f).not.toMatch(/\d\s*(ريال|ر\.س|SAR|ريالًا)/);
      expect(src, f).not.toMatch(/(ريال|ر\.س)\s*\d/);
    }
  });

  it("prices in its sentences go through the logo too (Coined / Riyal), never printed as text", () => {
    const q = read("Questions.tsx");
    expect(q).toContain('import Coined from "@/components/Coined"');
    // a coinStr() text is only ever used inside something that draws its «¤» as the logo
    expect(q).toMatch(/<Coined text=\{o\.label\}/);
    expect(q).toMatch(/<Coined text=\{price\(/);
    expect(read("ui.tsx")).toContain("<Riyal halalas={quote.coins}");
  });
});
