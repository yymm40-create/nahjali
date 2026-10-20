// «Claude Code» for a voice recording, in the browser: the recording is decoded to mono here, measured and drawn as a
// waveform, Claude writes the cleaning program for it, the sandbox runs it, the result is measured and drawn again,
// he reviews it (and rewrites it while it is below the bar), and the cleaned recording comes back as a WAV — ready to
// become a voiceprint or the reference of one reading.

import { postJson } from "@/lib/fetch";
import { CODE_FIXES, CODE_ROUNDS, VOICE_RUBRIC } from "@/lib/claude-code/skill";
import { frameLevels, statsLine, voiceStats, type VoiceStats } from "@/lib/claude-code/voice-measure";
import { ProgramError, runClean } from "./compute-host";

const URL = "/api/jawad/claude-code";

/** A recording as mono samples at its own rate. */
export async function decodeMono(blob: Blob): Promise<{ samples: Float32Array; rate: number }> {
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const out = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < ch.length; i++) out[i] += ch[i] / buf.numberOfChannels;
    }
    return { samples: out, rate: buf.sampleRate };
  } finally {
    void ctx.close();
  }
}

/** Mono samples as a 16-bit PCM WAV. */
export function encodeWav(s: Float32Array, rate: number): Blob {
  const data = new DataView(new ArrayBuffer(44 + s.length * 2));
  const str = (o: number, t: string) => [...t].forEach((ch, i) => data.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  data.setUint32(4, 36 + s.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 1, true);
  data.setUint32(24, rate, true);
  data.setUint32(28, rate * 2, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  str(36, "data");
  data.setUint32(40, s.length * 2, true);
  for (let i = 0; i < s.length; i++) data.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s[i])) * 0x7fff, true);
  return new Blob([data.buffer], { type: "audio/wav" });
}

/** The waveform as Claude sees it: the level of each 10 ms in dB (−60…0) as a band, clipping in red (PNG base64). */
export function waveformPng(s: Float32Array, rate: number): string {
  const W = 1000, H = 200;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0e1116";
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "#2a3140";
  g.fillStyle = "#6b7487";
  g.font = "11px sans-serif";
  for (const d of [-12, -24, -36, -48]) {
    const y = H / 2 - ((d + 60) / 60) * (H / 2);
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
    g.fillText(`${d} dB`, 4, y - 2);
  }
  const f = frameLevels(s, rate, 10);
  const per = f.length / W;
  const n = Math.max(1, Math.round((rate * 10) / 1000));
  for (let x = 0; x < W; x++) {
    const a = Math.floor(x * per), b = Math.max(a + 1, Math.floor((x + 1) * per));
    let lvl = -180, clip = false;
    for (let i = a; i < b && i < f.length; i++) lvl = Math.max(lvl, f[i]);
    for (let i = a * n; i < b * n && i < s.length; i++) if (Math.abs(s[i]) >= 0.97) clip = true;
    const h = (Math.max(0, lvl + 60) / 60) * (H / 2);
    g.fillStyle = clip ? "#ef4444" : "#38bdf8";
    g.fillRect(x, H / 2 - h, 1, Math.max(1, h * 2));
  }
  g.fillStyle = "#9aa3b5";
  g.fillText(`${(s.length / rate).toFixed(1)} s`, W - 50, H - 6);
  return c.toDataURL("image/png").split(",")[1];
}

export interface CleanResult {
  blob: Blob;
  seconds: number;
  before: VoiceStats;
  after: VoiceStats;
  verdict: string;
  scores: Record<string, number>;
  pass: boolean;
  line: string;
}

/** Cleans a recording by Claude's program (write → run → measure → review → rewrite), up to CODE_ROUNDS. */
export async function cleanVoice(o: { blob: Blob; model: string; from: "studio" | "editor"; purpose: string; onStep: (s: string) => void; signal?: AbortSignal }): Promise<CleanResult> {
  const call = <T>(body: Record<string, unknown>) => postJson<T>(URL, { model: o.model, from: o.from, purpose: o.purpose, ...body }, o.signal);
  o.onStep("أقيس التسجيل…");
  const { samples, rate } = await decodeMono(o.blob);
  const before = voiceStats(samples, rate);
  const waveBefore = waveformPng(samples, rate);
  o.onStep("🧑‍💻 حيدرا ماكس يكتب برنامج تنظيف التسجيل…");
  type Wrote = { code: string; problems: string[] };
  let w = await call<Wrote>({ action: "voice_write", stats: statsLine(before), wave: waveBefore });
  let code = w.code;
  let problems = w.problems;
  let last: { out: Float32Array; after: VoiceStats; verdict: string; scores: Record<string, number>; pass: boolean } | null = null;
  for (let round = 1; round <= CODE_ROUNDS; round++) {
    let out: Float32Array | null = null;
    for (let fix = 0; ; fix++) {
      if (o.signal?.aborted) throw Object.assign(new Error("⏹️ وقّفت التنظيف."), { name: "AbortError" });
      try {
        if (problems.length) throw new ProgramError(problems.join("; "));
        o.onStep(`أنظّف التسجيل ببرنامجه${round > 1 ? ` (جولة ${round})` : ""}…`);
        out = await runClean(code, samples, rate);
        break;
      } catch (e) {
        if (!(e instanceof ProgramError) || fix >= CODE_FIXES) throw e instanceof ProgramError ? new Error(`برنامج التنظيف ما اشتغل: ${e.message}`) : e;
        o.onStep("البرنامج طلع فيه خطأ — حيدرا ماكس يصلّحه…");
        w = await call<Wrote>({ action: "voice_write", stats: statsLine(before), wave: waveBefore, code, errors: `${e.message}\n${e.stack2}` });
        code = w.code;
        problems = w.problems;
      }
    }
    const after = voiceStats(out, rate);
    o.onStep(`حيدرا ماكس يراجع النتيجة (جولة ${round} من ${CODE_ROUNDS})…`);
    const r = await call<{ review: { scores: Record<string, number>; pass: boolean; verdict: string }; code: string; problems: string[] }>({ action: "voice_review", code, round, before: statsLine(before), after: statsLine(after), waveBefore, waveAfter: waveformPng(out, rate) });
    last = { out, after, ...r.review };
    if (r.review.pass || !r.code) break;
    code = r.code;
    problems = r.problems;
  }
  const res = last!;
  return {
    blob: encodeWav(res.out, rate),
    seconds: res.out.length / rate,
    before,
    after: res.after,
    verdict: res.verdict,
    scores: res.scores,
    pass: res.pass,
    line: `${res.pass ? "✅" : "⚠️"} ${res.verdict}\n🧑‍💻 حيدرا ماكس · الطول ${before.seconds} ← ${res.after.seconds} ث · مستوى الكلام ${before.speechDb} ← ${res.after.speechDb} dB · أطول سكتة ${before.longestPauseMs} ← ${res.after.longestPauseMs} ms\n${VOICE_RUBRIC.map((x) => `${x.ar} ${res.scores[x.id] ?? "—"}`).join(" · ")}`,
  };
}
