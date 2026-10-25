import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DICTION_VALUES } from "@config/jawad/diction";

const read = (p: string) => readFileSync(p, "utf8");

describe("the film maker's voices: the three ways of writing the pronunciation", () => {
  it("offers precise, spelled and as written, and sends the choice with every line", () => {
    expect(DICTION_VALUES.map((d) => d.value)).toEqual(["precise", "spelled", "off"]);
    const page = read("src/app/film/[id]/voices/VoicesWorkspace.tsx");
    expect(page).toMatch(/DICTION_VALUES\.map/);
    expect(page).toMatch(/emotion: feel\[key\] \?\? "", diction/);
    expect(read("src/app/api/film/projects/[id]/voices/route.ts")).toMatch(/b\.emotion, b\.diction/);
  });
  it("the server takes only those three (anything else is «دقيق») and «كما كتبت» is not charged for the check", async () => {
    const { cleanDiction } = await import("@/lib/film/voices");
    expect(cleanDiction("spelled")).toBe("spelled");
    expect(cleanDiction("off")).toBe("off");
    expect(cleanDiction("precise")).toBe("precise");
    expect(cleanDiction("x")).toBe("precise");
    expect(cleanDiction(undefined)).toBe("precise");
    const src = read("src/lib/film/voices.ts");
    expect(src).toMatch(/arabic && diction !== "off"/);
    expect(src).toMatch(/prepareSpeech\(line\.line, arabic \? diction : "off"/);
  });
});
