import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ICON_CHOICES } from "@config/mahdi";

const root = new URL("../../", import.meta.url).pathname;
const read = (p: string) => readFileSync(join(root, p), "utf8");
const files = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((f) => {
    const p = `${dir}/${f}`;
    return statSync(join(root, p)).isDirectory() ? files(p) : /\.(tsx|ts)$/.test(f) ? [p] : [];
  });
const mahdi = [...files("src/components/mahdi"), ...files("src/app/mahdi")];

// pictographic emoji (not arrows, ticks or punctuation): these are what stood for icons before
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2B50}\u{23F0}-\u{23FA}\u{2705}\u{274C}]/gu;
// what the person picks stays an emoji (their own habit or project icon, and the race team's): data, not chrome
const DATA = new Set<string>([...ICON_CHOICES.flatMap((x) => [...x.matchAll(EMOJI)].map((m) => m[0]))]);

describe("the polish of 26 November 2026", () => {
  it("no emoji stands for an icon in the app's screens: one stroke style (Icon.tsx)", () => {
    const left: string[] = [];
    for (const f of mahdi) {
      read(f)
        .split("\n")
        .forEach((line, i) => {
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
          for (const m of line.matchAll(EMOJI)) if (!DATA.has(m[0])) left.push(`${f}:${i + 1} ${m[0]}`);
        });
    }
    expect(left).toEqual([]);
  });

  it("no browser confirm(): big steps ask in a ConfirmSheet", () => {
    for (const f of mahdi) expect(read(f), f).not.toMatch(/\bwindow\.confirm\(|(^|[^.\w])confirm\(/m);
    expect(read("src/components/mahdi/GrowList.tsx")).toContain("<ConfirmSheet");
  });

  it("the phone's bars are light: every design is light", () => {
    const layout = read("src/app/mahdi/layout.tsx");
    expect(layout).not.toContain("black-translucent");
    expect(layout).toContain('colorScheme: "light"');
    const cap = JSON.parse(read("mahdi-app/capacitor.config.json"));
    expect(cap.plugins.StatusBar.style).toBe("LIGHT");
    expect(read("mahdi-app/android/app/src/main/res/values/styles.xml")).not.toContain("DayNight");
    expect(read("src/app/mahdi/offline/route.ts")).not.toContain("color-scheme:dark");
  });

  it("only the default design's letters are preloaded; the others load when a design uses them", () => {
    const layout = read("src/app/mahdi/layout.tsx");
    const fonts = [...layout.matchAll(/^const (\w+) = (?:\w+)\((\{[\s\S]*?\})\);$/gm)];
    expect(fonts.length).toBeGreaterThanOrEqual(13);
    for (const [, name, opts] of fonts) {
      if (name === "alexandria" || name === "sans") expect(opts, name).not.toContain("preload: false");
      else expect(opts, name).toContain("preload: false");
    }
  });

  it("the robot wears light colours (no dark robes, no dark screen)", () => {
    const robot = read("src/components/mahdi/Robot.tsx");
    for (const dark of ["#29211b", "#14100d", "#1d2632", "#4d4136"]) expect(robot).not.toContain(dark);
  });

  it("the share pictures and the offline page are light too", () => {
    expect(read("src/components/mahdi/ShareCard.tsx")).not.toMatch(/#0d0c0b|13,12,11/);
    expect(read("src/app/mahdi/(app)/share/page.tsx")).not.toContain("#0d0c0b");
  });
});
