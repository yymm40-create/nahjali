#!/usr/bin/env node
// Load test for the site's PUBLIC pages: N virtual visitors arrive within a ramp-up and each browses a few pages, like a
// real crowd (GET only; never touches AI generation, payments or sign-in). It reports how many requests passed, the
// speed (p50 / p95 / p99), the slowest page and the errors, and exits with 1 if the run did not hold up.
//
//   node scripts/loadtest.mjs --url https://www.aljawadai.app --users 1000 --ramp 30 --pages 4
//
// Run it from your own computer (not a phone), outside peak hours, and watch Supabase's «Reports» and Vercel's
// «Observability» while it runs. Start small (--users 50) before the full 1000.
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const base = String(arg("url", "")).replace(/\/+$/, "");
const users = Math.max(1, Number(arg("users", 100)));
const ramp = Math.max(0, Number(arg("ramp", 20)));
const pagesEach = Math.max(1, Number(arg("pages", 4)));
const think = Math.max(0, Number(arg("think", 1500)));
const timeout = Math.max(1000, Number(arg("timeout", 20000)));
const maxP95 = Number(arg("max-p95", 4000));
const maxErr = Number(arg("max-errors", 1));
const paths = String(arg("paths", "/,/jawad-ai,/jawad-ai/games,/jawad-ai/course,/mahdi,/mahdi/login,/jawad-ai/login,/privacy,/terms")).split(",").filter(Boolean);

if (!base || !/^https?:\/\//.test(base)) {
  console.error("Give the site's address: --url https://www.aljawadai.app");
  process.exit(2);
}
if (users > 200 && !process.argv.includes("--yes")) {
  console.error(`${users} visitors is a big run against ${base}. Run with fewer first, or add --yes to confirm.`);
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const times = [];
const byPath = new Map();
const errors = new Map();
let ok = 0;
let bad = 0;

async function hit(path) {
  const t0 = performance.now();
  try {
    const res = await fetch(base + path, { redirect: "follow", signal: AbortSignal.timeout(timeout), headers: { "user-agent": "jawad-loadtest/1", accept: "text/html" } });
    await res.arrayBuffer();
    const ms = performance.now() - t0;
    times.push(ms);
    const p = byPath.get(path) ?? [];
    p.push(ms);
    byPath.set(path, p);
    // a page that answers 5xx or 429 failed; 4xx on a public page is a broken link
    if (res.status >= 400) {
      bad++;
      const k = `${res.status} ${path}`;
      errors.set(k, (errors.get(k) ?? 0) + 1);
    } else ok++;
  } catch (e) {
    bad++;
    const k = `${e?.name === "TimeoutError" ? "timeout" : "network"} ${path}`;
    errors.set(k, (errors.get(k) ?? 0) + 1);
  }
}

async function visitor(i) {
  await sleep(ramp ? (i / users) * ramp * 1000 : 0);
  for (let n = 0; n < pagesEach; n++) {
    await hit(paths[Math.floor(Math.random() * paths.length)]);
    if (n < pagesEach - 1) await sleep(think * (0.5 + Math.random()));
  }
}

const pct = (arr, p) => (arr.length ? [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))] : 0);
const fmt = (ms) => `${Math.round(ms)} ms`;

console.log(`${users} visitors → ${base}  (ramp ${ramp}s, ${pagesEach} pages each, ${paths.length} pages in the mix)`);
const started = performance.now();
const ticker = setInterval(() => process.stdout.write(`\r  ${ok + bad} requests · ${bad} failed `), 1000);
await Promise.all(Array.from({ length: users }, (_, i) => visitor(i)));
clearInterval(ticker);
const secs = (performance.now() - started) / 1000;

console.log(`\n\nDone in ${secs.toFixed(1)} s — ${ok + bad} requests (${((ok + bad) / secs).toFixed(1)}/s), ${ok} passed, ${bad} failed`);
console.log(`Speed: p50 ${fmt(pct(times, 50))} · p95 ${fmt(pct(times, 95))} · p99 ${fmt(pct(times, 99))} · slowest ${fmt(Math.max(0, ...times))}`);
console.log("\nBy page (p95):");
for (const [p, v] of [...byPath].sort((a, b) => pct(b[1], 95) - pct(a[1], 95))) console.log(`  ${p.padEnd(28)} ${String(v.length).padStart(5)} requests · p95 ${fmt(pct(v, 95))}`);
if (errors.size) {
  console.log("\nErrors:");
  for (const [k, n] of [...errors].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)} × ${k}`);
}
const failPct = (bad / Math.max(1, ok + bad)) * 100;
const held = failPct <= maxErr && pct(times, 95) <= maxP95;
console.log(`\n${held ? "✅ Held up" : "❌ Did not hold up"} (failed ${failPct.toFixed(1)}% of ${maxErr}% allowed · p95 ${fmt(pct(times, 95))} of ${maxP95} ms allowed)`);
process.exit(held ? 0 : 1);
