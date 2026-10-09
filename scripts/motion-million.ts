// «موشن جرافيكس» — the million tests. Runs the bank's pieces through the engine in batches of 20,000 and prints a
// report after each batch (how many came out clean, what went wrong and in which moods and skills, the score), so
// every batch can be read and the engine corrected before the next one.
//
//   npx vite-node scripts/motion-million.ts -- [from=0] [count=1000000] [batch=20000] [workers=4]
import { spawn } from "node:child_process";
import { auditPiece, pieceAt, type Audit } from "../src/lib/editor/motion-bank";

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.includes("=")).map((a) => a.split("=") as [string, string]));
const from = Number(args.from ?? 0);
const count = Number(args.count ?? 1_000_000);
const batch = Number(args.batch ?? 20_000);
const workers = Number(args.workers ?? 4);

interface Stats {
  n: number;
  failed: number;
  score: number;
  kinds: Record<string, number>;
  samples: Record<string, string>;
  byMood: Record<string, [number, number]>;
  byStyle: Record<string, [number, number]>;
  dropped: number;
  beats: number;
  icons: number;
  shapes: number;
  ms: number;
  seen: number;
}

function run(start: number, n: number): Stats & { fingerprints?: number } {
  const st: Stats = { n: 0, failed: 0, score: 0, kinds: {}, samples: {}, byMood: {}, byStyle: {}, dropped: 0, beats: 0, icons: 0, shapes: 0, ms: 0, seen: 0 };
  const seen = new Set<string>();
  for (let i = start; i < start + n; i++) {
    const p = pieceAt(i);
    const a: Audit = auditPiece(p, { deep: i % 7 === 0, retime: i % 29 === 0 });
    st.n++;
    st.score += a.score;
    st.ms += a.m.ms;
    st.beats += a.m.beats;
    st.icons += a.m.icons;
    st.shapes += a.m.shapes;
    st.dropped += a.m.dropped;
    const bad = a.issues.filter((x) => x.k !== "dropped_text");
    if (bad.length) st.failed++;
    for (const x of new Set(a.issues.map((y) => y.k))) {
      st.kinds[x] = (st.kinds[x] ?? 0) + 1;
      st.samples[x] ??= `#${i} ${p.mood}/${p.style}/${p.ratio}${p.noisy ? "/noisy" : ""}: ${a.issues.find((y) => y.k === x)!.t.slice(0, 160)}`;
    }
    for (const [map, key] of [[st.byMood, p.mood], [st.byStyle, p.style]] as const) {
      const c = (map[key] ??= [0, 0]);
      c[0]++;
      c[1] += a.score;
    }
    seen.add(JSON.stringify(p.raw));
  }
  st.seen = seen.size;
  return st;
}

if (process.env.MOTION_WORKER) {
  const [s, n] = process.env.MOTION_WORKER.split(",").map(Number);
  process.stdout.write(`@@${JSON.stringify(run(s, n))}\n`);
} else {
  const merge = (a: Stats, b: Stats): Stats => {
    const sum = (x: Record<string, number>, y: Record<string, number>) => Object.fromEntries([...new Set([...Object.keys(x), ...Object.keys(y)])].map((k) => [k, (x[k] ?? 0) + (y[k] ?? 0)]));
    const pair = (x: Record<string, [number, number]>, y: Record<string, [number, number]>) => Object.fromEntries([...new Set([...Object.keys(x), ...Object.keys(y)])].map((k) => [k, [(x[k]?.[0] ?? 0) + (y[k]?.[0] ?? 0), (x[k]?.[1] ?? 0) + (y[k]?.[1] ?? 0)] as [number, number]]));
    return { n: a.n + b.n, failed: a.failed + b.failed, score: a.score + b.score, kinds: sum(a.kinds, b.kinds), samples: { ...b.samples, ...a.samples }, byMood: pair(a.byMood, b.byMood), byStyle: pair(a.byStyle, b.byStyle), dropped: a.dropped + b.dropped, beats: a.beats + b.beats, icons: a.icons + b.icons, shapes: a.shapes + b.shapes, ms: a.ms + b.ms, seen: a.seen + b.seen };
  };
  const worker = (s: number, n: number) =>
    new Promise<Stats>((ok, no) => {
      const ch = spawn("npx", ["vite-node", "scripts/motion-million.ts"], { env: { ...process.env, MOTION_WORKER: `${s},${n}` } });
      let out = "";
      ch.stdout.on("data", (d) => (out += d));
      ch.stderr.on("data", (d) => process.stderr.write(d));
      ch.on("close", () => {
        const line = out.split("\n").find((l) => l.startsWith("@@"));
        line ? ok(JSON.parse(line.slice(2))) : no(new Error(`worker ${s} gave nothing: ${out.slice(0, 200)}`));
      });
    });
  (async () => {
    let all: Stats | null = null;
    for (let s = from; s < from + count; s += batch) {
      const n = Math.min(batch, from + count - s);
      const per = Math.ceil(n / workers);
      const parts = await Promise.all(Array.from({ length: workers }, (_, w) => (w * per < n ? worker(s + w * per, Math.min(per, n - w * per)) : Promise.resolve(null))));
      const st = parts.filter((x): x is Stats => !!x).reduce((a, b) => merge(a, b));
      all = all ? merge(all, st) : st;
      const avg = (m: Record<string, [number, number]>) => Object.entries(m).map(([k, [c, t]]) => `${k} ${(t / c).toFixed(2)}`).join(" · ");
      console.log(`\n── batch ${s}–${s + n - 1} ──  pieces ${st.n}  clean ${(((st.n - st.failed) / st.n) * 100).toFixed(2)}%  failed ${st.failed}  avg score ${(st.score / st.n).toFixed(3)}  distinct ${st.seen}  ${(st.ms / st.n).toFixed(1)} ms/piece`);
      console.log(`   beats ${(st.beats / st.n).toFixed(1)}/piece · icons ${(st.icons / st.n).toFixed(2)} · shapes ${(st.shapes / st.n).toFixed(2)} · words left out ${st.dropped}`);
      console.log(`   moods: ${avg(st.byMood)}`);
      console.log(`   skills: ${avg(st.byStyle)}`);
      for (const [k, c] of Object.entries(st.kinds).sort((a, b) => b[1] - a[1])) console.log(`   ✗ ${k}: ${c}  e.g. ${st.samples[k]}`);
    }
    console.log(`\n══ total ${all!.n} pieces · clean ${(((all!.n - all!.failed) / all!.n) * 100).toFixed(3)}% · avg score ${(all!.score / all!.n).toFixed(3)} ══`);
  })();
}
