import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ZAYNAB_GREETING, ZAYNAB_HARAM_PATH, ZAYNAB_MAX_PHOTOS, ZAYNAB_STYLES, zaynabInput, zaynabPrompt } from "@config/jawad/zaynab";
import { FREE_FIRST_ENDS_AT, FREE_FIRST_HOURS, freeFirstOpen } from "@config/jawad/free-first";
import { DEFAULT_SECTIONS, RESERVED_SECTION_IDS } from "@config/jawad/sections";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const ok = { style: "real", time: "night", weather: "rain", aspect: "3:2", labels: ["أبي", ""], greeting: true, count: 1, consent: true };

describe("«في حضرة السيدة زينب (ع)»", () => {
  it("is unlisted: no section on the bar, its address reserved, hidden from search engines", () => {
    expect(DEFAULT_SECTIONS.some((s) => s.id === "zaynab" || (s.implementation as string) === "zaynab")).toBe(false);
    expect(RESERVED_SECTION_IDS).toContain("zaynab");
    expect(read("src/app/jawad-ai/zaynab/page.tsx")).toContain("index: false");
  });
  it("offers 5 to 7 looks, night/day, rain/snow/clear", () => {
    expect(ZAYNAB_STYLES.length).toBeGreaterThanOrEqual(5);
    expect(ZAYNAB_STYLES.length).toBeLessThanOrEqual(7);
    for (const s of ZAYNAB_STYLES) expect(s.text.length).toBeGreaterThan(120);
    for (const time of ["day", "night"]) for (const weather of ["clear", "rain", "snow"]) expect(() => zaynabInput({ ...ok, time, weather })).not.toThrow();
    expect(() => zaynabInput({ ...ok, weather: "fog" })).toThrow();
    expect(() => zaynabInput({ ...ok, consent: false })).toThrow();
  });
  it("puts the shrine's photograph first and the people after it, in the look, the time and the weather", () => {
    const p = zaynabPrompt(zaynabInput(ok), 2);
    expect(p).toContain("Image 1 is the PLACE");
    expect(p).toContain("Image 2 (“أبي”), Image 3");
    expect(p).toContain("every person in every one of them appears");
    expect(p).toContain("never redesigned");
    expect(p).toContain("NIGHT");
    expect(p).toContain("gentle rain");
    expect(p).toContain("Photorealistic cinematic photograph");
    expect(p).toContain("no holy figure is depicted");
    expect(p).toContain("a greeting is written there afterwards");
    expect(zaynabPrompt(zaynabInput({ ...ok, greeting: false, weather: "snow", time: "day" }), 1)).not.toContain("a greeting is written");
  });
  it("takes several people's photos and keeps the shrine's photograph as a reference of its own with every generation", () => {
    expect(ZAYNAB_MAX_PHOTOS).toBeGreaterThanOrEqual(5);
    const route = read("src/app/api/jawad/zaynab/route.ts");
    expect(route).toContain("haramBytes()");
    expect(route).toContain("[haram.id, ...(uploads as string[])]");
    expect(ZAYNAB_HARAM_PATH).toBe("zaynab/haram.jpg");
    // only the owner puts the shrine's photograph, and nobody starts without it
    expect(route).toContain('body.action === "set_haram"');
    expect(route).toContain("if (!owner) throw");
    expect(route).toContain("صورة الحضرة لم تُرفع بعد");
  });
  it("writes the greeting over the picture itself, in real letters", () => {
    expect(ZAYNAB_GREETING.join(" ")).toContain("نرفع أسمى آيات التهاني والتبريك لمقام صاحب العصر والزمان (عج)");
    expect(ZAYNAB_GREETING.join(" ")).toContain("بمناسبة ميلاد السيدة زينب عليها السلام");
    expect(read("src/components/jawad/zaynab/greeting.ts")).toContain("fillText");
    expect(read("src/app/jawad-ai/zaynab/page.tsx")).toContain("Marhey");
  });
  it("the first attempt is free for 26 hours on both branches, once per account, never for a failed one", () => {
    expect(FREE_FIRST_HOURS).toBe(26);
    expect(freeFirstOpen(new Date(FREE_FIRST_ENDS_AT).getTime() - 1000)).toBe(true);
    expect(freeFirstOpen(new Date(FREE_FIRST_ENDS_AT).getTime() + 1000)).toBe(false);
    const free = read("src/lib/jawad/server/free-first.ts");
    expect(free).toContain('.neq("status", "failed")');
    expect(free).toContain("freeFirstOpen()");
    for (const f of ["src/app/api/jawad/zaynab/route.ts", "src/app/api/jawad/cartoon/route.ts"]) expect(read(f)).toContain("freeFirstEligible(");
    // the server alone decides: the job charges nothing and is labelled
    const jobs = read("src/lib/jawad/server/jobs.ts");
    expect(jobs).toContain("server.free === true");
    expect(jobs).toContain("أول تجربة مجانية");
    expect(read("src/app/api/jawad/zaynab/route.ts")).toContain("input.count === 1");
  });
  it("Claude knows both", () => {
    expect(JAWAD_KNOWLEDGE).toContain("/jawad-ai/zaynab");
    expect(JAWAD_KNOWLEDGE).toContain("أول تجربة مجانية");
  });
});
