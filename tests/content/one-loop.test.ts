import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 5 Nov 2026: the conversation was opened from its address and then from the list, two drawing loops ran at once, both
// drew slide 3, and the second was refused («هذي الشريحة مو بانتظار الرسم»), stopping the carousel at 2 of 5.
describe("one drawing loop per conversation", () => {
  const src = readFileSync("src/components/jawad/content/ContentChat.tsx", "utf8");
  for (const [fn, key] of [["runProduce", "p"], ["runMedia", "m"]] as const) {
    it(`${fn} does not start while one runs for the same chat, and lets the next one start after`, () => {
      const body = src.slice(src.indexOf(`const ${fn} = useCallback`), src.indexOf("}, []);", src.indexOf(`const ${fn} = useCallback`)));
      expect(body).toContain(`if (looping.current.has(\`${key}:\${id}\`)) return;`);
      expect(body).toContain(`looping.current.add(\`${key}:\${id}\`);`);
      expect(body).toMatch(new RegExp(`finally \\{\\s*looping\\.current\\.delete\\(\`${key}:\\$\\{id\\}\`\\);`));
    });
  }
});
