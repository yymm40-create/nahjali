import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// «⬇️ من رابط» (the owner, 5 Nov 2026): the desktop program downloads a YouTube video on the person's computer.
const { cleanLink } = createRequire(import.meta.url)("../../desktop/youtube.js") as { cleanLink: (v: unknown) => string | null };

describe("the desktop program's link download", () => {
  it("hands yt-dlp only a web link, never an option", () => {
    expect(cleanLink(" https://www.youtube.com/watch?v=jNQXAC9IVRw ")).toBe("https://www.youtube.com/watch?v=jNQXAC9IVRw");
    expect(cleanLink("--exec=rm -rf ~")).toBeNull();
    expect(cleanLink("file:///etc/passwd")).toBeNull();
    expect(cleanLink("not a link")).toBeNull();
  });

  it("checks what it fetches before running it", () => {
    const src = readFileSync("desktop/youtube.js", "utf8");
    expect(src).toContain("SHA2-256SUMS");
    expect(src).toMatch(/sha256\(gz\) !== pick\[1\]/);
    expect(src).toContain('"--", url');
  });

  it("is wired from the library to the program", () => {
    expect(readFileSync("desktop/preload.js", "utf8")).toContain("fromLink");
    expect(readFileSync("desktop/main.js", "utf8")).toContain('ipcMain.handle("youtube:get"');
    expect(readFileSync("src/components/jawad/editor/Library.tsx", "utf8")).toContain("desktopLinks()");
    expect(JSON.parse(readFileSync("desktop/package.json", "utf8")).build.files).toContain("youtube.js");
  });
});
