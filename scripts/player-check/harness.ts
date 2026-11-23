// Runs INSIDE the browser (run.mjs): the editor's real Player on a timeline of cameras stacked on one another, to
// see how many videos it decodes at once and which one it draws.
import { Player, type PlayerAsset } from "@/components/jawad/editor/player";
import { apply, type Command } from "@/lib/editor/commands";
import { flatten, readTimeline, type Timeline } from "@/lib/editor/model";

declare global {
  interface Window {
    pcStart: (n: number) => Promise<void>;
    pcRun: (cmd: Command) => void;
    pcSeek: (ms: number) => Promise<void>;
    pcPlay: (ms: number) => Promise<void>;
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
  tl = apply(tl, cmd, info()).timeline;
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
