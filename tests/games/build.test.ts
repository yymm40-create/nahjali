import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { GAMES_MODE_RULES, GAMES_PLATFORM_RULES } from "@config/games";
import { assemble, codeBrief, continueBrief, joinParts, editBrief, fixBrief, GAME_BUILD, GAME_CODE_RULES, keepErrors, pageProblems, playCsp, playPath, readPage, readPlan } from "@config/games-build";
import { keyBackdrop, spriteFile } from "@/lib/games/art";
import { checkPage, syntaxProblems } from "@/lib/games/build";
import { modeOf } from "@/lib/games/chats";
import { passing, PARTIAL_MIN, readStream } from "@/lib/games/claude";
import { systemText } from "@/lib/games/persona";
import { rulesFor } from "@/lib/rate-limit";

const SPEC = "A one-button runner: tap to jump over cacti, the speed rises every 10 seconds, three lives, the score is the distance in meters.";

const plan = (o: Record<string, unknown> = {}) =>
  "Here it is:\n```json\n" +
  JSON.stringify({
    title: "قفزة الصحراء",
    summary: "اقفز فوق الصبار واجمع النقاط",
    style: "bright flat cartoon",
    cover: 'A camel jumping over cacti, with the title "قفزة الصحراء"',
    assets: [
      { id: "Hero1", kind: "sprite", aspect: "16:9", prompt: "a happy camel running" },
      { id: "bg", kind: "background", aspect: "9:16", prompt: "a desert at sunset" },
      { id: "bg", kind: "sprite", prompt: "duplicate" },
      { id: "cover", kind: "sprite", prompt: "reserved" },
      { id: "x", kind: "sprite", prompt: "" },
      ...Array.from({ length: 8 }, (_, i) => ({ id: `item${"abcdefgh"[i]}`, kind: "sprite", prompt: `item ${i}` })),
    ],
    spec: SPEC,
    ...o,
  }) +
  "\n```";

const GOOD = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>t</title><style>body{margin:0}</style></head>
<body><canvas id="c"></canvas><img src="{{asset:hero}}" alt="">
<script>
const img = new Image(); img.src = "{{asset:bg}}";
let best = 0; try { best = Number(localStorage.getItem("b")) || 0; } catch (e) {}
function loop(t) { requestAnimationFrame(loop); }
requestAnimationFrame(loop);
</script>
</body></html>`;

describe("the plan", () => {
  it("reads the json block: cleans the pictures' ids, drops repeats, the reserved and the empty, caps them, and shares the style", () => {
    const p = readPlan(plan())!;
    expect(p.title).toBe("قفزة الصحراء");
    expect(p.spec).toBe(SPEC);
    expect(p.assets.map((a) => a.id)).toEqual(["hero", "bg", "itema", "itemb", "itemc"]);
    expect(p.assets).toHaveLength(GAME_BUILD.maxAssets);
    // a sprite is always square; a background keeps its shape
    expect(p.assets[0]).toMatchObject({ kind: "sprite", aspect: "1:1" });
    expect(p.assets[1]).toMatchObject({ kind: "background", aspect: "9:16" });
    expect(p.assets.every((a) => a.prompt.includes("bright flat cartoon"))).toBe(true);
    expect(p.cover).toContain("bright flat cartoon");
  });

  it("builds without pictures when asked, and refuses an answer with no real spec", () => {
    expect(readPlan(plan(), false)!.assets).toEqual([]);
    expect(readPlan(plan({ spec: "short" }))).toBeNull();
    expect(readPlan("no json here")).toBeNull();
    expect(readPlan("```json\n{bad json\n```")).toBeNull();
  });

  it("gives the cover a prompt with the title even when the plan has none", () => {
    expect(readPlan(plan({ cover: "" }))!.cover).toContain("قفزة الصحراء");
  });
});

describe("the page", () => {
  it("is read from its html block (closed, cut off, or bare)", () => {
    expect(readPage("x\n```html\n<html></html>\n```\ny")).toBe("<html></html>");
    expect(readPage("```html\n<!doctype html><html><body>")).toBe("<!doctype html><html><body>");
    expect(readPage("Sure! <!doctype html><html></html>")).toBe("<!doctype html><html></html>");
    expect(readPage("nothing")).toBeNull();
  });

  it("passes when it is complete and self-contained", () => {
    expect(checkPage(GOOD, ["hero", "bg"])).toEqual([]);
  });

  it("is sent back for what the sandbox would break or the plan doesn't have", () => {
    const p = (html: string) => pageProblems(html, ["hero"]).join(" | ");
    expect(p(GOOD.replace("</html>", ""))).toMatch(/complete HTML document/);
    expect(p(GOOD.replace("<script>", '<script src="https://cdn.example/x.js"></script><script>'))).toMatch(/outside/);
    expect(p(GOOD.replace("let best", 'fetch("/api"); let best'))).toMatch(/network/);
    expect(p(GOOD.replace("let best", 'alert("hi"); let best'))).toMatch(/alert/);
    expect(p(GOOD.replace("let best", "showAlert(1); this.confirm(2); let best"))).not.toMatch(/alert \//);
    expect(p(GOOD)).toMatch(/\{\{asset:bg\}\}/);
    expect(p(GOOD.replace("<style>", '<link rel="stylesheet" href="a.css"><style>'))).toMatch(/stylesheet/);
    expect(p('<html><body><img src="https://evil.example/a.png"><script>1</script></body></html>')).toMatch(/outside address/);
    expect(p("<html><body>no code</body></html>")).toMatch(/no inline <script>/);
  });

  it("checks the scripts' syntax without running them", () => {
    expect(syntaxProblems(GOOD)).toEqual([]);
    const bad = syntaxProblems(GOOD.replace("function loop(t) {", "function loop(t) {{"));
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatch(/SyntaxError/);
    // a JSON or template block is not JavaScript
    expect(syntaxProblems('<html><script type="application/json">{"a":</script><script>let a = 1;</script></html>')).toEqual([]);
    // nothing in the page runs on the server
    expect(syntaxProblems("<html><script>globalThis.__ran = true;</script></html>")).toEqual([]);
    expect((globalThis as { __ran?: boolean }).__ran).toBeUndefined();
  });

  it("is served with its pictures, a missing one empty (so the game draws its fallback), and the error watch first", () => {
    const out = assemble(GOOD, { hero: "/api/games/play/x/art/hero-1.webp", bg: null });
    expect(out).toContain('src="/api/games/play/x/art/hero-1.webp"');
    expect(out).toContain('img.src = "data:,"');
    expect(out).not.toContain("{{asset:");
    expect(out.indexOf("jwGame")).toBeGreaterThan(out.indexOf("<head>"));
    expect(out.indexOf("jwGame")).toBeLessThan(out.indexOf("<style>"));
  });

  it("runs fenced off: its own sandbox (never the site's origin), nothing sent, only its pictures", () => {
    const csp = playCsp("https://aljawadai.app");
    expect(csp).toMatch(/^sandbox allow-scripts allow-pointer-lock;/);
    expect(csp).not.toContain("allow-same-origin");
    expect(csp).not.toContain("allow-top-navigation");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("img-src 'self' https://aljawadai.app data: blob:");
    // the addresses come from the request: anything that isn't a plain origin is left out
    expect(playCsp(["https://aljawadai.app", "https://aljawadai.app", "https://x.vercel.app", "evil; script-src *"])).toContain("img-src 'self' https://aljawadai.app https://x.vercel.app data: blob:");
    expect(csp).toContain("frame-ancestors 'self'");
  });

  it("keeps the last few distinct errors players ran into", () => {
    let e: string[] = [];
    for (const m of ["a", "b", "a", "c", "d", "e", "f"]) e = keepErrors(e, m);
    expect(e).toEqual(["b", "c", "d", "e", "f"]);
    expect(keepErrors("junk", "  x  ")).toEqual(["x"]);
    expect(keepErrors(["x"], "")).toEqual(["x"]);
  });
});

describe("the briefs", () => {
  const p = readPlan(plan())!;
  it("give the programmer the spec and only the placeholders that exist", () => {
    const b = codeBrief(p);
    expect(b).toContain(SPEC);
    for (const a of p.assets) expect(b).toContain(`{{asset:${a.id}}}`);
    expect(codeBrief({ ...p, assets: [] })).toMatch(/none: draw everything/);
  });

  it("send a failed page back with what failed, and an edit with the client's words and the players' errors", () => {
    expect(fixBrief(p, "<html>", ["P1", "P2"])).toMatch(/- P1\n- P2/);
    const e = editBrief(p, "<html>old</html>", "خل الجمل أسرع", ["TypeError: x"]);
    expect(e).toContain("خل الجمل أسرع");
    expect(e).toContain("TypeError: x");
    expect(e).toContain("<html>old</html>");
    expect(editBrief(p, "<html>", "", [])).not.toContain("CLIENT ASKS");
  });

  it("forbid what the sandbox blocks", () => {
    for (const w of ["fetch", "alert", "localStorage", "{{asset:ID}}", "getImageData", "100dvh", "visibilitychange"]) expect(GAME_CODE_RULES).toContain(w);
  });
});

describe("the two ways", () => {
  it("is kept per conversation and told to «قنبر» after the platform's rules", () => {
    expect(modeOf("build")).toBe("build");
    expect(modeOf("prompt")).toBe("prompt");
    expect(modeOf("hack")).toBe("");
    const t = systemText("PERSONA", "", "prompt");
    expect(t.indexOf(GAMES_PLATFORM_RULES)).toBeLessThan(t.indexOf(GAMES_MODE_RULES.prompt));
    expect(systemText("PERSONA", "", "")).not.toContain(GAMES_MODE_RULES.build);
    // the prompt comes in one block to copy; the build way points at the button
    expect(GAMES_MODE_RULES.prompt).toContain("```text");
    expect(GAMES_MODE_RULES.build).toContain("اصنع اللعبة");
    expect(GAMES_PLATFORM_RULES).toContain("اصنع اللعبة");
  });

  it("links a game where anyone can play it", () => {
    expect(playPath("abc")).toBe("/play/abc");
    expect(rulesFor("/api/games/play/abc", "POST").map((r) => r.key)).toContain("game-error");
  });
});

describe("sprites", () => {
  /** A w×h picture of one colour with a square of another in the middle. */
  const picture = (w: number, h: number, bg: [number, number, number], fg: [number, number, number], sq: { x: number; y: number; s: number }) => {
    const px = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const inside = x >= sq.x && x < sq.x + sq.s && y >= sq.y && y < sq.y + sq.s;
        const c = inside ? fg : bg;
        px.set([...c, 255], (y * w + x) * 4);
      }
    return px;
  };

  it("cut the green away, keep the subject whole, and trim to it", () => {
    const px = picture(40, 30, [0, 255, 0], [200, 40, 30], { x: 10, y: 8, s: 12 });
    const box = keyBackdrop(px, 40, 30)!;
    expect(box).toEqual({ left: 8, top: 6, width: 16, height: 16 });
    expect(px[3]).toBe(0);
    expect(px[(12 * 40 + 15) * 4 + 3]).toBe(255);
    expect(Array.from(px.slice((12 * 40 + 15) * 4, (12 * 40 + 15) * 4 + 3))).toEqual([200, 40, 30]);
  });

  it("take the green spill off a soft edge", () => {
    const px = picture(10, 10, [0, 255, 0], [220, 60, 60], { x: 3, y: 3, s: 4 });
    const i = (3 * 10 + 2) * 4;
    px.set([110, 160, 30, 255], i); // half subject, half green
    keyBackdrop(px, 10, 10);
    expect(px[i + 3]).toBeGreaterThan(0);
    expect(px[i + 3]).toBeLessThan(255);
    expect(px[i + 1]).toBeLessThanOrEqual(Math.max(px[i], px[i + 2]));
  });

  it("cut another flat backdrop from the edges only (a hole of the same colour inside stays)", () => {
    const px = picture(30, 30, [255, 255, 255], [20, 20, 120], { x: 5, y: 5, s: 20 });
    // a white eye inside the subject
    px.set([255, 255, 255, 255], (15 * 30 + 15) * 4);
    const box = keyBackdrop(px, 30, 30)!;
    expect(box).toEqual({ left: 3, top: 3, width: 24, height: 24 });
    expect(px[3]).toBe(0);
    expect(px[(15 * 30 + 15) * 4 + 3]).toBe(255);
  });

  it("leave a picture with no flat backdrop as it is", () => {
    const px = new Uint8Array(20 * 20 * 4);
    for (let i = 0; i < px.length; i += 4) px.set([(i * 7) % 256, (i * 13) % 256, (i * 29) % 256, 255], i);
    const before = px.slice();
    expect(keyBackdrop(px, 20, 20)).toBeNull();
    expect(px).toEqual(before);
  });

  it("come out as a trimmed WebP with a see-through background", async () => {
    const raw = Buffer.from(picture(64, 64, [0, 255, 0], [200, 40, 30], { x: 16, y: 20, s: 24 }));
    const png = await sharp(raw, { raw: { width: 64, height: 64, channels: 4 } }).png().toBuffer();
    const out = await spriteFile(png);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.hasAlpha).toBe(true);
    expect(meta.width).toBe(28);
    expect(meta.height).toBe(28);
  });
});

describe("a long reply read as it is written", () => {
  const sse = (events: object[], split = 7) => {
    const raw = events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
    const bytes = new TextEncoder().encode(raw);
    // the network hands it over in odd pieces (an event cut in the middle)
    return new Response(new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += split) c.enqueue(bytes.slice(i, i + split)); c.close(); } }));
  };

  it("joins the text and keeps the usage of its start and its end", async () => {
    const r = await readStream(sse([
      { type: "message_start", message: { model: "claude-sonnet-5-5", usage: { input_tokens: 1200, cache_read_input_tokens: 300, output_tokens: 1 } } },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "ping" },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "```html\n<html>" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "</html>\n```" } },
      { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 4321 } },
      { type: "message_stop" },
    ]));
    expect(r.text).toBe("```html\n<html></html>\n```");
    expect(r.usage).toMatchObject({ input_tokens: 1200, cache_read_input_tokens: 300, output_tokens: 4321 });
    expect(r.model).toBe("claude-sonnet-5-5");
    expect(r.stop).toBe("end_turn");
  });

  it("raises an error sent inside the stream", async () => {
    await expect(readStream(sse([{ type: "message_start", message: { usage: {} } }, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }]))).rejects.toThrow(/Overloaded/);
  });

  it("keeps a long reply cut off in the middle when asked (and only then)", async () => {
    const long = "x".repeat(PARTIAL_MIN + 10);
    const broken = () => {
      const raw = [
        { type: "message_start", message: { usage: { input_tokens: 10 } } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "```html\n<html>" + long } },
      ].map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
      let sent = false;
      // the line breaks after the first piece arrived
      return new Response(new ReadableStream({ pull(c) { if (sent) c.error(new Error("terminated")); else { sent = true; c.enqueue(new TextEncoder().encode(raw)); } } }));
    };
    const r = await readStream(broken(), true);
    expect(r.stop).toBe("cut");
    expect(r.text.endsWith(long)).toBe(true);
    expect(r.usage.output_tokens).toBeGreaterThan(1000);
    await expect(readStream(broken())).rejects.toThrow(/terminated/);
  });
});

describe("a reply that stopped in the middle", () => {
  it("goes on from where it stopped, with the spec and what was written", () => {
    const b = continueBrief({ title: "t", summary: "s", spec: SPEC, cover: "c", assets: [] }, "```html\n<html><body>");
    expect(b).toContain(SPEC);
    expect(b).toContain("<html><body>");
    expect(b).toMatch(/continuation ONLY/);
  });

  it("joins the parts, dropping a repeated fence or last line", () => {
    expect(joinParts("```html\n<html>\n<body>", "</body></html>\n```")).toBe("```html\n<html>\n<body></body></html>\n```");
    expect(joinParts("a\nconst speed = 10;", "```html\n;\n</html>")).toBe("a\nconst speed = 10;;\n</html>");
    expect(joinParts("a\nconst speed = 10; let", "const speed = 10; let lives = 3;")).toBe("a\nconst speed = 10; let lives = 3;");
    expect(readPage(joinParts("```html\n<!doctype html><html><body><script>let a =", " 1;</script></body></html>\n```"))).toBe("<!doctype html><html><body><script>let a = 1;</script></body></html>");
  });

  it("tries again only a passing failure", () => {
    expect(passing(new Error("Claude 529: Overloaded"))).toBe(true);
    expect(passing(new Error("Claude 500: Internal server error"))).toBe(true);
    expect(passing(new Error("Claude stream: Overloaded"))).toBe(true);
    expect(passing(new TypeError("fetch failed"))).toBe(true);
    expect(passing(new Error("Claude 400: invalid_request_error"))).toBe(false);
    expect(passing(new Error("Claude 401: invalid x-api-key"))).toBe(false);
    expect(passing(new Error("Claude declined this request"))).toBe(false);
  });

  it("is continued a few times before it counts as broken", () => {
    expect(GAME_BUILD.maxContinues).toBeGreaterThanOrEqual(2);
  });
});
