// «صانع الألعاب»: the conversation's two ways, the «اصنع اللعبة» sheet, the games' cards in each state, and a built game played
// in its fenced frame (the real CSP, the real assembly, real cut-out sprites) — screenshots at phone and desktop sizes and checks
// inside the game's sandbox. node scripts/games-preview/run.mjs [outDir]
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = process.argv[2] ?? join(tmpdir(), "games-preview");
mkdirSync(out, { recursive: true });
const stubs = join(root, "scripts/course-preview/stubs.tsx");
const alias = { "@": join(root, "src"), "@config": join(root, "config") };
await build({
  entryPoints: [join(root, "scripts/games-preview/entry.tsx")], bundle: true, outfile: join(out, "bundle.js"), format: "iife", jsx: "automatic", loader: { ".css": "css" },
  alias: { ...alias, "next/link": stubs, "next/navigation": stubs }, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error",
});
// the node side lives under the repository so «sharp» resolves
const libOut = join(root, "node_modules/.cache/games-preview/lib.mjs");
await build({ entryPoints: [join(root, "scripts/games-preview/lib.ts")], bundle: true, outfile: libOut, format: "esm", platform: "node", packages: "external", alias, logLevel: "error" });
const lib = await import(pathToFileURL(libOut).href);
const { default: sharp } = await import(pathToFileURL(join(root, "node_modules/sharp/dist/index.mjs")).href);

// the sample game (written by the rules), checked as a build would be
const sample = readFileSync(join(root, "scripts/games-preview/sample-game.html"), "utf8");
const problems = [...lib.pageProblems(sample, ["hero", "bg"]), ...(lib.syntaxOk(sample) ? [] : ["syntax"])];
console.log(problems.length ? `✗ the sample game fails the checks: ${problems.join(" | ")}` : "✓ the sample game passes the build's checks");

// its pictures, as the desk would hand them over: a camel-ish sprite drawn on chroma green, a background, a cover
const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
const heroRaw = await sharp(svg(1024, 1024, `<rect width="1024" height="1024" fill="#00ff00"/><ellipse cx="520" cy="560" rx="300" ry="190" fill="#d9a35f" stroke="#5a3410" stroke-width="18"/><circle cx="760" cy="360" r="110" fill="#d9a35f" stroke="#5a3410" stroke-width="18"/><circle cx="790" cy="340" r="22" fill="#1b0f2e"/><rect x="330" y="700" width="60" height="220" fill="#b98545"/><rect x="620" y="700" width="60" height="220" fill="#b98545"/>`)).png().toBuffer();
const bgRaw = await sharp(svg(1024, 1536, `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b1d6e"/><stop offset="1" stop-color="#ff9e7a"/></linearGradient></defs><rect width="1024" height="1536" fill="url(#s)"/><circle cx="760" cy="420" r="120" fill="#ffd166"/>`)).png().toBuffer();
const coverRaw = await sharp(svg(1536, 864, `<rect width="1536" height="864" fill="#3b1d6e"/><circle cx="1150" cy="300" r="160" fill="#ffd166"/><rect y="640" width="1536" height="224" fill="#c2884d"/><text x="768" y="380" font-size="150" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="900">قفزة الصحراء</text>`)).png().toBuffer();
const files = { "hero-aaaaaaaa.webp": await lib.spriteFile(heroRaw), "bg-bbbbbbbb.webp": await lib.backgroundFile(bgRaw), "cover-cccccccc.jpg": await lib.coverFile(coverRaw) };
const heroMeta = await sharp(files["hero-aaaaaaaa.webp"]).metadata();
console.log(`✓ sprite cut out: ${heroMeta.width}×${heroMeta.height}, see-through: ${heroMeta.hasAlpha}`);

const G = "11111111-1111-1111-1111-111111111111";
const art = (f) => `/api/games/play/${G}/art/${f}`;
const card = (o) => ({ id: G, chatId: "c1", title: "قفزة الصحراء", summary: "اقفز فوق الصبار بالجمل واجمع أطول مسافة، والسرعة تزيد كل شوي.", status: "ready", code: "done", editing: false, art: "done", pictures: { done: 3, failed: 0, total: 3 }, cover: art("cover-cccccccc.jpg"), link: `/play/${G}`, version: 1, error: "", playerErrors: 0, createdAt: "2026-10-10T10:00:00Z", ...o });
const SCENES = {
  ready: [card({ playerErrors: 1 })],
  building: [card({ id: "22222222-2222-2222-2222-222222222222", status: "building", code: "writing", art: "drawing", pictures: { done: 2, failed: 0, total: 4 }, cover: art("cover-cccccccc.jpg") })],
  failed: [card({ id: "33333333-3333-3333-3333-333333333333", status: "failed", code: "failed", cover: null, error: "ما قدر قنبر يكمل كود اللعبة بدون أخطاء. اضغط «🔄 ابنها من جديد»." })],
};
let scene = "ready";
let steps = 0;
const SUMMARY = "تمام، هذا تصميم لعبتك باختصار 👇\n\n### 🐪 قفزة الصحراء\n- **الفكرة:** جمل يركض في الصحراء ويقفز فوق الصبار.\n- **التحكم:** لمسة على الشاشة (أو المسافة) = قفزة.\n- **الصعوبة:** السرعة تزيد كل ١٠ ثواني، ولك ٣ أرواح.\n- **الفوز:** أطول مسافة.\n\nإذا عجبك، اضغط **🎮 اصنع اللعبة** تحت.\n\n[[خيارات]]\n- اصنعها الحين\n- غيّر الشخصية\n- زد صعوبة";
const PROMPT = "هذا البرومبت جاهز تنسخه 👇\n\n```text\nBuild a mobile-first web game called \"Desert Jump\" (Arabic UI, RTL).\n- A camel runs right-to-left; tap or press Space to jump over cacti.\n- Speed rises every 10 seconds; 3 lives; score = distance in meters.\n- Start screen, game, game-over screen with best score.\n```\n\nوتقدر بدال كذا تضغط «🎮 اصنع اللعبة» والموقع يبنيها لك هنا.";

const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#07070d;font-family:system-ui,'Noto Sans Arabic',sans-serif;color:#fff}
.inline-flex{display:inline-flex}.items-center{align-items:center}.gap-1{gap:4px}.whitespace-nowrap{white-space:nowrap}.tabular-nums{font-variant-numeric:tabular-nums}
</style><link rel=stylesheet href="/bundle.css"><div id=root></div><script src="/bundle.js"></script>`;
const json = (res, v, status = 200) => void res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(v));
const body = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b ? JSON.parse(b) : {})); });
const reported = [];
const server = createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const p = u.pathname;
  if (p === "/") return void res.writeHead(200, { "content-type": "text/html" }).end(html);
  if (p === "/__scene") { scene = u.searchParams.get("s"); steps = 0; return json(res, { ok: true }); }
  if (p === "/__reported") return json(res, reported);
  if (p === "/bundle.js" || p === "/bundle.css") return void res.writeHead(200, { "content-type": p.endsWith(".js") ? "text/javascript" : "text/css" }).end(readFileSync(join(out, p.slice(1))));
  if (p === "/api/games/chats") {
    const id = u.searchParams.get("id");
    if (!id) return json(res, { chats: [{ id: "c1", title: "لعبة جمل يقفز" }, { id: "c2", title: "برومبت لعبة" }] });
    if (id === "c2") return json(res, { chat: { id: "c2", mode: "prompt", messages: [{ role: "user", text: "ابي برومبت كامل لصنع لعبة أوديه لأداة ثانية." }, { role: "assistant", text: PROMPT }] } });
    return json(res, { chat: { id: "c1", mode: "build", messages: [{ role: "user", text: "ابي تصنع لي لعبة هنا في الموقع وتعطيني رابط ألعبها." }, { role: "assistant", text: SUMMARY }] } });
  }
  if (p === "/api/games/build" && req.method === "GET") {
    if (u.searchParams.get("quote")) return json(res, { picture: 150, cover: 300, free: false });
    if (u.searchParams.get("id")) return json(res, { build: card({ id: u.searchParams.get("id") }) });
    if (u.searchParams.get("chatId") === "c1") return json(res, { builds: scene === "fresh" ? [] : SCENES[scene] ?? [] });
    if (u.searchParams.get("chatId")) return json(res, { builds: [] });
    return json(res, { builds: [card({})] });
  }
  if (p === "/api/games/build" && req.method === "POST") {
    await new Promise((r) => setTimeout(r, 400));
    return json(res, { build: card({ id: "44444444-4444-4444-4444-444444444444", status: "building", code: "pending", art: "pending", cover: null, pictures: { done: 0, failed: 0, total: 4 } }) });
  }
  if (p === "/api/games/build/step") {
    const b = await body(req);
    steps++;
    await new Promise((r) => setTimeout(r, b.part === "code" ? 1200 : 800));
    // a build that is still going (the «building» scene stays there, to be seen)
    if (scene === "building") return json(res, { build: SCENES.building[0] });
    const done = card({ id: b.id, chatId: "c1" });
    return json(res, { build: steps >= 2 ? done : { ...done, status: "building", code: b.part === "code" ? "done" : "writing", art: b.part === "art" ? "done" : "drawing" } });
  }
  if (p === "/api/games/chat") return json(res, { chatId: "c9", text: SUMMARY });
  if (p === `/api/games/play/${G}` && req.method === "GET") {
    const page = lib.assemble(sample, { hero: art("hero-aaaaaaaa.webp"), bg: art("bg-bbbbbbbb.webp") });
    return void res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-security-policy": lib.playCsp(process.env.SELF_ONLY ? [] : [`http://127.0.0.1:${port}`]) }).end(page);
  }
  if (p === `/api/games/play/${G}` && req.method === "POST") { reported.push((await body(req)).error); return json(res, { ok: true }); }
  const f = p.startsWith(`/api/games/play/${G}/art/`) ? p.split("/").pop() : null;
  if (f && files[f]) return void res.writeHead(200, { "content-type": f.endsWith(".jpg") ? "image/jpeg" : "image/webp" }).end(files[f]);
  if (p === "/api/x") return json(res, { leaked: true });
  if (p === "/jawad-ai/logo.png") return void res.writeHead(200, { "content-type": "image/png" }).end(readFileSync(join(root, "public/jawad-ai/logo.png")));
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const { default: puppeteer } = await import(join(root, "node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js"));
const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
let bad = problems.length;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(w, h) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, isMobile: w < 700, hasTouch: w < 700 });
  page.on("pageerror", (e) => { if (/boom-test/.test(e.message)) return; bad++; console.log("  pageerror:", e.message); });
  return page;
}
async function overflow(page, name) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  if (o.sw > o.iw) { bad++; console.log(`  ✗ ${name}: sideways overflow ${o.sw} > ${o.iw}`); }
}
const shot = async (page, name) => { await overflow(page, name); await page.screenshot({ path: join(out, `${name}.png`) }); };

for (const [w, h, tag] of [[360, 740, "phone360"], [390, 844, "phone"], [1280, 860, "desk"]]) {
  // a new conversation: the two ways first
  await fetch(`${base}/__scene?s=ready`);
  let page = await open(w, h);
  await page.goto(`${base}/?view=chat`);
  await wait(900);
  await shot(page, `${tag}-1-ways`);
  // a conversation with its game ready (and a player's error to fix)
  if (w < 900) { await page.click(".gm-burger"); await wait(200); }
  await page.click(".gm-chat-item");
  await wait(900);
  await page.evaluate(() => document.querySelector(".gm-feed").scrollTo(0, 1e6));
  await wait(500);
  await shot(page, `${tag}-2-ready`);
  // the sheet
  await page.click(".gm-make");
  await wait(600);
  await shot(page, `${tag}-3-sheet`);
  await page.close();
  for (const s of ["building", "failed"]) {
    await fetch(`${base}/__scene?s=${s}`);
    page = await open(w, h);
    await page.goto(`${base}/?view=chat`);
    await wait(600);
    if (w < 900) { await page.click(".gm-burger"); await wait(200); }
    await page.click(".gm-chat-item");
    await wait(900);
    await page.evaluate(() => document.querySelector(".gm-feed").scrollTo(0, 1e6));
    await wait(400);
    await shot(page, `${tag}-4-${s}`);
    await page.close();
  }
  // the prompt way: a block to copy
  page = await open(w, h);
  await page.goto(`${base}/?view=chat`);
  await wait(600);
  if (w < 900) { await page.click(".gm-burger"); await wait(200); }
  await page.click(".gm-chat-item:nth-child(2)");
  await wait(800);
  await page.evaluate(() => document.querySelector(".gm-code")?.scrollIntoView({ block: "start" }));
  await wait(300);
  await shot(page, `${tag}-5-prompt`);
  if (!(await page.$(".gm-code pre"))) { bad++; console.log("  ✗ the prompt block is not drawn as a block to copy"); }
  await page.close();
}

// building from the sheet: the card goes from «يكتب» to ready by itself
await fetch(`${base}/__scene?s=fresh`);
{
  const page = await open(390, 844);
  await page.goto(`${base}/?view=chat`);
  await wait(600);
  await page.click(".gm-burger");
  await wait(200);
  await page.click(".gm-chat-item");
  await wait(800);
  await page.click(".gm-make");
  await wait(400);
  await page.click(".gm-go");
  await wait(900);
  await shot(page, "flow-1-started");
  await page.waitForSelector(".gm-bgo", { timeout: 15000 }).catch(() => { bad++; console.log("  ✗ the new game never became ready on its card"); });
  await page.evaluate(() => document.querySelector(".gm-feed").scrollTo(0, 1e6));
  await wait(400);
  await shot(page, "flow-2-ready");
  await page.close();
}

// the play page: the game in its sandbox
for (const [w, h, tag] of [[390, 844, "phone"], [1280, 800, "desk"]]) {
  const page = await open(w, h);
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  await page.goto(`${base}/?view=play`);
  await wait(1500);
  const frame = page.frames().find((f) => f.url().includes("/api/games/play/"));
  if (!frame) { bad++; console.log("  ✗ no game frame"); continue; }
  await shot(page, `play-${tag}-1-start`);
  const inside = await frame.evaluate(async () => {
    const r = {};
    r.origin = String(window.origin);
    try { localStorage.getItem("x"); r.storage = "open"; } catch { r.storage = "blocked"; }
    try { r.cookie = document.cookie === "" ? "empty" : "SEEN"; } catch { r.cookie = "blocked"; }
    r.fetch = await fetch("/api/x").then(() => "LEAKED", () => "blocked");
    r.top = (() => { try { return String(window.top.location.href); } catch { return "blocked"; } })();
    r.go = !document.getElementById("go").disabled;
    r.picture = await new Promise((done) => { const i = new Image(); i.onload = () => done("loaded"); i.onerror = () => done("blocked"); i.src = document.documentElement.innerHTML.match(/\/api\/games\/play\/[^"]+art\/[^"]+/)?.[0] ?? "/none"; });
    return r;
  });
  console.log(`  ${tag} sandbox:`, JSON.stringify(inside));
  if (inside.origin !== "null" || inside.storage !== "blocked" || inside.fetch !== "blocked" || inside.top !== "blocked" || inside.cookie === "SEEN") { bad++; console.log("  ✗ the game is not fenced off"); }
  if (!inside.go || inside.picture !== "loaded") { bad++; console.log("  ✗ the pictures did not load"); }
  // play: start, jump a few times
  await frame.click("#go");
  for (let i = 0; i < 4; i++) { await wait(500); await frame.click("#game").catch(() => null); }
  await wait(600);
  await shot(page, `play-${tag}-2-playing`);
  const state = await frame.evaluate(() => ({ hud: document.getElementById("score").textContent, startHidden: document.getElementById("start").classList.contains("hide") }));
  console.log(`  ${tag} playing:`, JSON.stringify(state));
  if (!state.startHidden || state.hud === "0 م") { bad++; console.log("  ✗ the game did not start"); }
  // an error inside the game: shown on it, and reported by the play page
  // (thrown by the game's own inline code, as a real game's error would be)
  await frame.evaluate(() => { const s = document.createElement("script"); s.textContent = 'setTimeout(function () { throw new Error("boom-test"); }, 0);'; document.body.appendChild(s); });
  await wait(800);
  await shot(page, `play-${tag}-3-error`);
  const rep = await (await fetch(`${base}/__reported`)).json();
  if (!rep.some((e) => String(e).includes("boom-test"))) { bad++; console.log("  ✗ the game's error was not reported", rep); }
  const unexpected = consoleErrors.filter((t) => !/boom-test|Content Security Policy|connect-src|Failed to fetch|sandboxed|localStorage|cookie/i.test(t));
  if (unexpected.length) console.log("  console:", unexpected.slice(0, 5));
  await page.close();
}

await browser.close();
server.close();
console.log(bad ? `✗ ${bad} problem(s) — screenshots in ${out}` : `✓ all good — screenshots in ${out}`);
process.exit(bad ? 1 : 0);
