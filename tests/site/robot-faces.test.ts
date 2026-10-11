import { readFileSync } from "node:fs";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RobotFace, { ROBOT_LOOKS } from "@/components/RobotFace";

const draw = (props: { id: string; size?: number; title?: string }) => renderToStaticMarkup(createElement(RobotFace, props));
const source = readFileSync(new URL("../../src/components/RobotFace.tsx", import.meta.url), "utf8");

// «أشكال الروبوتات خلها محترمة لا تخليها تضحك أو شكلها غريب، فيها ثقل وهيبة ووقار»
describe("the robots' faces are sober and weighty", () => {
  it("every robot is drawn, from the same set of ids", () => {
    const ids = Object.keys(ROBOT_LOOKS);
    expect(ids.length).toBeGreaterThanOrEqual(14);
    for (const id of ids) {
      const svg = draw({ id, size: 48 });
      expect(svg, id).toContain("<svg");
      expect(svg, id).toContain("viewBox=\"0 0 64 64\"");
    }
    // an id nobody knows still draws a face (the first one), never nothing
    expect(draw({ id: "nobody" })).toContain("<svg");
  });

  it("uses deep metals, never candy colours: every body colour is dark enough", () => {
    const luminance = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    for (const [id, l] of Object.entries(ROBOT_LOOKS)) {
      expect(luminance(l.a), `${id} top`).toBeLessThan(0.5);
      expect(luminance(l.b), `${id} bottom`).toBeLessThan(0.3);
      // lit from above: the bottom is never lighter than the top
      expect(luminance(l.b), id).toBeLessThanOrEqual(luminance(l.a));
    }
  });

  it("has no googly white eyes, no smile, no sparkles and no pink bow or red nose left in the drawing", () => {
    // the old comic features: white eyeballs with pupils, a row of grin teeth, a sparkle star, a lightning bolt
    expect(source).not.toMatch(/r="5\.5" fill="#fff"/);
    expect(source).not.toMatch(/M52 6l1\.6 4\.4/);
    expect(source).not.toMatch(/M33 2 26 12h5l-2 6 8-11/);
    expect(source).not.toMatch(/#ef4444/);
    // the old palette's candy hues are gone from the looks
    for (const candy of ["#ec4899", "#f97316", "#22d3ee", "#facc15", "#f472b6", "#fb7185"]) expect(source, candy).not.toContain(candy);
  });

  it("gives every face the same dignified parts: a collar under the head, a gold trim, level glowing eyes", () => {
    for (const id of Object.keys(ROBOT_LOOKS)) {
      const svg = draw({ id });
      // the collar (the broad shoulders) and the flat mouth-groove are on every robot
      expect(svg, id).toContain("M6 63c0-6 5-10 12-11");
      expect(svg, id).toContain('height="1.8"');
      // the warm steady glow of the eyes, and the aged gold of the trim
      expect(svg, id).toContain("#f1dc9f");
      expect(svg, id).toContain("#d4b46a");
    }
  });

  it("keeps its title for assistive tech, and is hidden from it when it has none", () => {
    expect(draw({ id: "jawad", title: "جواد" })).toContain('aria-label="جواد"');
    expect(draw({ id: "jawad" })).toContain('aria-hidden="true"');
  });
});
