import { describe, expect, it } from "vitest";
import { DIRECTOR_SKILL, INTENSITY, VO_BUDGET } from "@/lib/editor/director";
import { MOTION_TEN_SKILL } from "@/lib/editor/motion-ten";
import { ANIMS, STILL, animAt, countText, decodeText } from "@/lib/editor/model";

describe("«مخرج الموشن»: what حيدرة learnt from the Motion Video Director skill", () => {
  it("covers the craft: structure, intensity, type, colour, safe zones, sound, voice script, reference, QA", () => {
    for (const piece of ["Hook (0–3 s)", "INTENSITY BY VIDEO TYPE", "ANIMATION PRINCIPLES", "60-30-10", "SAFE ZONES", "riser", "ElevenLabs v3", "A REFERENCE VIDEO", "BEFORE YOU SAY IT IS DONE", '"glow"', '"grad"', '"depth"', '"decode"', '"count"', "letterbox"]) expect(DIRECTOR_SKILL, piece).toContain(piece);
    expect(INTENSITY.map((i) => i.level)).toEqual([5, 4, 3, 2, 1]);
    expect(VO_BUDGET.map((b) => b.s)).toEqual([15, 30, 45, 60, 90]);
  });
  it("lists the ten styles for him", () => {
    expect((MOTION_TEN_SKILL.match(/^\d+\. «/gm) ?? []).length).toBe(10);
  });
});

describe("the new finishes and entrances", () => {
  it("«عدّاد» rolls numbers up and lands on the exact value", () => {
    expect(countText("وصلنا 50 عميل", 0.5)).toBe("وصلنا 25 عميل");
    expect(countText("نمو 3.5٪", 0.5)).toBe("نمو 1.75٪".replace("1.75", (3.5 * 0.5).toFixed(1)));
    expect(countText("1,200 طلب", 0.5)).toBe("600 طلب");
    expect(countText("٤٠ يوم", 0.5)).toBe("20 يوم");
    expect(countText("وصلنا 50 عميل", 1)).toBe("وصلنا 50 عميل");
  });
  it("«فك الشفرة» shows random letters that settle into the real text, keeping the spaces", () => {
    const half = decodeText("حياتك بس مرتبة", 0.5, 3);
    expect(half).not.toBe("حياتك بس مرتبة");
    expect(half.split(" ").map((w) => w.length)).toEqual([5, 2, 5]);
    expect(decodeText("حياتك بس مرتبة", 1, 3)).toBe("حياتك بس مرتبة");
  });
  it("are entrances the editor accepts for texts, and they settle at the end", () => {
    expect(ANIMS.decode.only).toBe("text");
    expect(ANIMS.count.only).toBe("text");
    const clip = { anim: { in: "count" as const, out: null, inMs: 1000, outMs: 300 }, start: 0, in: 0, out: 3000, speed: 1 };
    expect(animAt(clip, 500).count).toBeGreaterThan(0.5);
    expect(animAt(clip, 2000).count).toBe(STILL.count);
  });
});
