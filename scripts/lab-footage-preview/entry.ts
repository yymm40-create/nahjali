// «مختبر الموشن» on the person's own video, run for real in a browser: the video read by FootageReader, handed to the
// sandboxed scene page frame by frame, a program written on K.footage (full → card → away → split → corner → full),
// contact sheets, and the final MP4 rendered with the video's own sound. Driven by run.mjs.
import { SceneHost } from "@/components/jawad/editor/scene-host";
import { FootageReader, footageSound, type FootageSource } from "@/components/jawad/editor/lab-footage";
import { faceTrack } from "@/components/jawad/editor/face";
import { contactSheet, probe, renderVideo } from "@/components/jawad/editor/scene-render";
import { mixSoundtrack } from "@/components/jawad/editor/lab-sound";
import { footageLines } from "@/lib/editor/scene/footage";

const PROGRAM = String.raw`
var F = K.footage;
// where the video sits: [t, x, y, w, h, radius] in fractions of the frame (springs between them)
var R = [
  [0.0, 0, 0, 1, 1, 0],
  [2.0, 0.08, 0.30, 0.84, 0.30, 0.035],
  [4.0, 0.30, 0.55, 0.40, 0.14, 0.03],
  [6.0, 0, 0, 1, 0.5, 0],
  [8.0, 0.60, 0.14, 0.30, 0.17, 0.5],
  [9.6, 0, 0, 1, 1, 0],
];
function at(t, i) { var v = R[0][i]; for (var k = 1; k < R.length; k++) { var p = K.spring(Math.max(0, t - R[k][0] + 0.15), { stiffness: 140, damping: 22 }); v = K.lerp(v, R[k][i], t >= R[k][0] - 0.15 ? p : 0); } return v; }
scene({
  title: "test", duration: F ? F.duration : 10, bpm: 120, background: "#f4f1ea", blur: 0,
  cues: [{ t: 1.9, sfx: "transition-whoosh-fast" }],
  params: { line: { label: "السطر", type: "text", value: "the power of" }, ink: { label: "اللون", type: "color", value: "#ffffff" } },
  draw: function (K, t, ctx) {
    var W = K.W, H = K.H;
    // the stage: a soft gradient with grain
    var g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#efe9ff"); g.addColorStop(1, "#ffe7d6"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    K.text(ctx, "CLAUDE · EDIT REEL '26", W * 0.08, H * 0.08, { size: W * 0.022, weight: 600, family: K.fonts.body, color: "#5b5b6b", align: "left" });
    var away = t > 4.0 && t < 6.0;
    // the explainer behind (away): tiles assembling into a grid
    if (t > 3.6 && t < 6.4) {
      var cols = ["#a78bfa", "#fdba74", "#86efac", "#fcd34d", "#93c5fd", "#f9a8d4"];
      for (var i = 0; i < 12; i++) {
        var p = K.ease.silk(K.seg(t, 3.8 + i * 0.06, 0.6)) * (1 - K.seg(t, 6.0, 0.4));
        var cx = W * (0.2 + (i % 4) * 0.2), cy = H * (0.36 + Math.floor(i / 4) * 0.12);
        ctx.save(); ctx.globalAlpha = p; ctx.translate(cx, cy + (1 - p) * 60); ctx.scale(0.8 + 0.2 * p, 0.8 + 0.2 * p);
        K.roundRect(ctx, -W * 0.08, -W * 0.08, W * 0.16, W * 0.16, W * 0.03); ctx.fillStyle = cols[i % 6]; ctx.fill(); ctx.restore();
      }
    }
    if (!away || t < 4.2 || t > 5.8) {
      var x = at(t, 1) * W, y = at(t, 2) * H, w = at(t, 3) * W, h = at(t, 4) * H, r = at(t, 5) * Math.min(w, h);
      var face = F.draw(ctx, x, y, w, h, { zoom: t < 2 ? 1 + t * 0.03 : 1, radius: r, shadow: w < W * 0.95 });
      // «الكلام ورا الراس»: the big word, then the person alone on top of it
      if (t < 2 && F.hasPerson) { K.text(ctx, "POWER", W * 0.5, H * 0.3, { size: W * 0.34, weight: 900, family: K.fonts.head, color: "#ffd84a", align: "center" }); F.draw(ctx, x, y, w, h, { zoom: 1 + t * 0.03, radius: r, person: true }); }
      if (t < 2) K.text(ctx, K.p("line", "the power of"), W * 0.5, Math.min(H * 0.8, face.y + face.h + H * 0.1), { size: W * 0.09, weight: 800, family: K.fonts.head, color: K.p("ink", "#ffffff"), align: "center", shadow: true });
      if (t > 6 && t < 8) K.text(ctx, K.counter(K.seg(t, 6.2, 1.2), 0, 120, { suffix: "+" }), W * 0.5, H * 0.75, { size: W * 0.2, weight: 900, family: K.fonts.head, color: "#3b2bd6", align: "center" });
      // the face box, outlined (the test checks it lands on the face)
      ctx.save(); ctx.strokeStyle = "#ff0066"; ctx.lineWidth = 4; ctx.strokeRect(face.x, face.y, face.w, face.h); ctx.restore();
    }
    K.grain(ctx, t, { amount: 0.03 });
  },
  sound: function (K, S) {},
});`;

declare global {
  interface Window {
    runLab: (url: string) => Promise<Record<string, unknown>>;
  }
}

window.runLab = async (url: string, matteUrl?: string) => {
  const out: Record<string, unknown> = {};
  const s: FootageSource = { clipId: "c1", assetId: "a1", name: "talk", url, in: 500, out: 10500, speed: 1, start: 0, hasAudio: true };
  const seconds = (s.out - s.in) / 1000;
  let face: { t: number; x: number; y: number; w: number; h: number }[] = [];
  try {
    const tr = await faceTrack(url, s.in, s.out, 8);
    face = tr.samples.map((x) => ({ t: (x.ms - s.in) / 1000, ...x.face }));
    out.faceFrom = "mediapipe";
  } catch (e) {
    out.faceError = String(e);
    face = [{ t: 0, x: 0.53, y: 0.28, w: 0.14, h: 0.4 }];
    out.faceFrom = "fallback";
  }
  out.face = face;
  const W = 1080, H = 1920;
  const r = await FootageReader.open(s, Math.max(W, H));
  out.reader = `${r.w}×${r.h}`;
  const host = new SceneHost();
  host.video = (t, scale) => r.at(t, scale);
  const pr = matteUrl ? await FootageReader.open({ ...s, url: matteUrl }, Math.max(W, H), true) : null;
  if (pr) host.person = (t, scale) => pr.at(t, scale);
  const words = [{ w: "the", s: 0.2, e: 0.4 }, { w: "power", s: 0.4, e: 0.8 }, { w: "of", s: 0.8, e: 1.0 }];
  const info = await host.load(PROGRAM, { w: W, h: H, fps: 30, footage: { w: r.w, h: r.h, duration: seconds, words, lines: footageLines(words), face, person: Boolean(pr) }, params: { line: "مرحبا يا جماعة", ink: "#ff3366" } });
  out.params = info.params;
  out.duration = info.duration;
  const bad = await probe(host, info.duration);
  out.probe = bad ? `${bad.where} ${bad.message}` : "ok";
  out.sheet = await contactSheet(host, 0, info.duration, 12, 6);
  const voice = await footageSound(s);
  out.voiceBytes = voice?.size ?? 0;
  out.sheetFirst = await contactSheet(host, 0, 1.9, 6, 6);
  const audio = await mixSoundtrack({ duration: info.duration, synth: null, cues: [], voice, music: null });
  const started = performance.now();
  const blob = await renderVideo(host, { duration: info.duration, fps: 30, blur: 0, audio }, () => {});
  out.renderMs = Math.round(performance.now() - started);
  out.mp4 = await new Promise<string>((ok) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(",")[1]);
    fr.readAsDataURL(blob);
  });
  host.destroy();
  r.close();
  return out;
};
