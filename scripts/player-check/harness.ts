// Runs INSIDE the browser (run.mjs): the editor's real Player on a timeline of cameras stacked on one another, to
// see how many videos it decodes at once and which one it draws.
import { Player, type PlayerAsset } from "@/components/jawad/editor/player";
import { apply, type Command } from "@/lib/editor/commands";
import { clipEnd, flatten, readTimeline, sourceTime, type Timeline } from "@/lib/editor/model";

declare global {
  interface Window {
    pcStart: (n: number) => Promise<void>;
    pcRun: (cmd: Command) => void;
    pcSeek: (ms: number) => Promise<void>;
    pcPlay: (ms: number) => Promise<void>;
    pcLag: (ms: number) => Promise<{ at: number; lag: number }[]>;
    pcRapid: (cams: string[], everyMs: number) => Promise<{ elapsed: number; advanced: number; seeks: number; audible: number; black: number; frames: number }>;
    pcLook: () => { videos: number; sounds: number; playing: number; pixel: [number, number, number] };
  }
}

let tl: Timeline;
let player: Player;
let assets: PlayerAsset[] = [];
const info = () => new Map(assets.map((a) => [a.id, { id: a.id, kind: a.kind, durationMs: a.durationMs ?? null, width: a.width ?? null, height: a.height ?? null, hasAudio: a.hasAudio }]));
const settle = (ms = 700) => new Promise((r) => setTimeout(r, ms));

window.pcStart = async (n) => {
  // every camera: one file, one clip of 20 s on a track of its own, all over one another (file names say .mp4: the
  // sandbox's Chromium only plays WebM, and a .webm name would count as "may be transparent")
  assets = Array.from({ length: n }, (_, i) => ({ id: `cam${i}`, kind: "video" as const, url: `/cam${i}.webm`, hasAudio: true, durationMs: 20_000, name: `cam${i}.mp4`, width: 320, height: 180 }));
  const clip = (i: number) => ({ id: `c${i}`, assetId: `cam${i}`, start: 0, in: 0, out: 20_000, speed: 1, fit: "cover" });
  tl = readTimeline({ width: 320, height: 180, fps: 30, magnetic: false, tracks: assets.map((_, i) => ({ id: i ? `v${i}` : "main", kind: "video", name: `كاميرا ${i + 1}`, clips: [clip(i)] })) });
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  player = new Player(canvas, flatten(tl));
  player.update(flatten(tl), assets);
  await window.pcSeek(5000);
};
window.pcRun = (cmd) => {
  try {
    tl = apply(tl, cmd, info()).timeline;
  } catch (e) {
    // (the editor shows the reason and nothing changes)
    console.log("refused:", e instanceof Error ? e.message : e);
    return;
  }
  player.update(flatten(tl), assets);
};
window.pcSeek = async (ms) => {
  player.seek(ms);
  await settle();
  player.draw();
};
window.pcPlay = async (ms) => {
  player.play();
  await settle(ms);
};
window.pcLook = () => {
  const vids = [...document.querySelectorAll("video")];
  const c = document.querySelector("canvas")!;
  const d = c.getContext("2d")!.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
  return { videos: vids.length, sounds: document.querySelectorAll("audio").length, playing: vids.filter((v) => !v.paused).length, pixel: [d[0], d[1], d[2]] };
};

// How far the picture on screen is behind the film: every 50 ms while it plays, the shown cut's own video against
// the moment it should be at (seconds; negative = the picture is late). The cut is the top clip under the playhead.
window.pcLag = async (ms) => {
  const out: { at: number; lag: number }[] = [];
  player.seek(0);
  await settle(600);
  player.play();
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    await new Promise((r) => setTimeout(r, 50));
    const now = player.ms;
    const top = [...flatten(tl).tracks].reverse().flatMap((t) => (t.kind === "video" && !t.hidden ? t.clips.filter((c) => c.start <= now && clipEnd(c) > now) : []))[0];
    const el = top ? (player as unknown as { media: Map<string, HTMLMediaElement> }).media.get(top.id) : null;
    if (top && el) out.push({ at: Math.round(now - top.start), lag: Math.round((el.currentTime - sourceTime(top, now) / 1000) * 1000) / 1000 });
  }
  player.pause();
  return out;
};

// Cuts pressed quickly while the film plays (the number keys of «شبكة الكاميرات»): does the film keep going? The
// time the film advanced against the time that passed, and how often a video or sound that is HEARD was made to jump.
window.pcRapid = async (cams, everyMs) => {
  player.seek(1000);
  await settle(600);
  player.play();
  await settle(800);
  let seeks = 0;
  const heard = () => [...document.querySelectorAll<HTMLMediaElement>("video,audio")].filter((m) => !m.muted && !m.paused);
  const count = () => seeks++;
  const watched = heard();
  for (const m of watched) m.addEventListener("seeking", count);
  const t0 = performance.now();
  const ms0 = player.ms;
  // every frame the screen shows meanwhile: is it ever black?
  let black = 0;
  let frames = 0;
  let watching = true;
  const c = document.querySelector("canvas")!;
  const look = () => {
    if (!watching) return;
    const d = c.getContext("2d")!.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    frames++;
    if (d[0] + d[1] + d[2] < 24) black++;
    requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
  for (const cam of cams) {
    window.pcRun({ type: "multicam_cut", cam, at: Math.round(player.ms) });
    await new Promise((r) => setTimeout(r, everyMs));
  }
  watching = false;
  const out = { elapsed: Math.round(performance.now() - t0), advanced: Math.round(player.ms - ms0), seeks, audible: watched.length, black, frames };
  for (const m of watched) m.removeEventListener("seeking", count);
  player.pause();
  return out;
};
