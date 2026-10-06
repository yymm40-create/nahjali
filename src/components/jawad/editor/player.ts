// «الممنتج الذكي» — the live preview. The browser's own <video>/<audio> elements play the media (hardware decoding,
// cheap on phones); every animation frame we keep each one at its clip's moment and draw the frame on one canvas with
// the same drawFrame the export uses. Only clips near the playhead hold an element, so long projects stay light.

import { clipEnd, duration, gainAt, sourceTime, voiceSpans, type Clip, type Timeline } from "@/lib/editor/model";
import { drawFrame, layersAt, type Frame } from "./render";
import { Masker } from "./segment";

export interface PlayerAsset {
  id: string;
  kind: "video" | "audio" | "image";
  url: string | null;
  hasAudio: boolean;
}

/** How far ahead clips get their element ready (so a cut doesn't wait), and how far around them it is kept. */
const AHEAD_MS = 2500;
const KEEP_MS = 6000;
/** The most the preview lets a playing element drift before it is put back on time. */
const DRIFT_S = 0.25;

type Media = HTMLVideoElement | HTMLAudioElement;

export class Player {
  private ctx: CanvasRenderingContext2D;
  private tl: Timeline;
  private assets = new Map<string, PlayerAsset>();
  /** where a voice is heard (the ducking tracks go quieter there) */
  private spans: [number, number][] = [];
  private media = new Map<string, Media>();
  private images = new Map<string, HTMLImageElement>();
  private host: HTMLDivElement;
  private raf = 0;
  private clock = { perf: 0, ms: 0 };
  private listeners = new Set<(ms: number, playing: boolean) => void>();
  ms = 0;
  playing = false;
  /** «عزل الشخص»: person masks, loaded the first time a clip asks for one */
  private masker = new Masker(() => this.draw());
  private maskAt = new Map<string, { t: number; mask: HTMLCanvasElement | null }>();

  constructor(
    private canvas: HTMLCanvasElement,
    tl: Timeline,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.tl = tl;
    // media elements decode best when they are in the page (Safari); this box keeps them out of sight
    this.host = document.createElement("div");
    this.host.style.cssText = "position:fixed;left:-10px;top:-10px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
    document.body.appendChild(this.host);
    document.fonts?.ready.then(() => this.draw()).catch(() => {});
  }

  /** Called on every change of the timeline or the library. */
  update(tl: Timeline, assets: PlayerAsset[]) {
    this.tl = tl;
    this.assets = new Map(assets.map((a) => [a.id, a]));
    this.spans = voiceSpans(tl, (c) => !c.text && !!this.assets.get(c.assetId ?? "")?.hasAudio);
    if (this.canvas.width !== tl.width || this.canvas.height !== tl.height) {
      this.canvas.width = tl.width;
      this.canvas.height = tl.height;
    }
    this.ms = Math.min(this.ms, duration(tl));
    this.sync(true);
    this.draw();
  }

  subscribe(fn: (ms: number, playing: boolean) => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn(this.ms, this.playing);
  }

  /** (not clamped to the current length: a change about to arrive may make the timeline longer; update() clamps) */
  seek(ms: number) {
    this.ms = Math.max(0, Math.round(ms));
    this.clock = { perf: performance.now(), ms: this.ms };
    this.sync(true);
    this.draw();
    this.emit();
  }

  play() {
    const end = duration(this.tl);
    if (!end) return;
    if (this.ms >= end - 30) this.ms = 0;
    this.playing = true;
    this.clock = { perf: performance.now(), ms: this.ms };
    this.sync(true);
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.tick);
    this.emit();
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    for (const m of this.media.values()) m.pause();
    this.emit();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  destroy() {
    this.pause();
    for (const m of this.media.values()) release(m);
    this.media.clear();
    this.host.remove();
    this.listeners.clear();
  }

  private tick = (now: number) => {
    if (!this.playing) return;
    // a clip still loading holds the clock, so picture and sound never run ahead of each other
    const waiting = this.active().some(({ clip }) => {
      const m = this.media.get(clip.id);
      return m instanceof HTMLVideoElement && (m.seeking || m.readyState < 3);
    });
    if (waiting) this.clock = { perf: now, ms: this.ms };
    else this.ms = Math.round(this.clock.ms + (now - this.clock.perf));
    const end = duration(this.tl);
    if (this.ms >= end) {
      this.ms = end;
      this.draw();
      this.pause();
      return;
    }
    this.sync(false);
    this.draw();
    this.emit();
    this.raf = requestAnimationFrame(this.tick);
  };

  /** The moment shown: at the very end the last frame stays on screen (not a black one). */
  private shown() {
    const end = duration(this.tl);
    return end > 0 && this.ms >= end ? end - 1 : this.ms;
  }

  /** Media clips on screen now (two during a transition). */
  private active() {
    return layersAt(this.tl, this.shown()).flatMap((l) => ("clip" in l && !l.clip.text ? [l] : []));
  }

  /** Every media clip near the playhead gets its element, at the right moment, playing or paused. */
  private sync(hard: boolean) {
    const ms = this.shown();
    const wanted = new Set<string>();
    // a clip in a transition shows a held frame (its first before the cut, its last after it)
    const held = new Map<string, number>();
    for (const l of layersAt(this.tl, ms)) if ("clip" in l && (ms < l.clip.start || ms >= clipEnd(l.clip))) held.set(l.clip.id, l.ms);
    for (const track of this.tl.tracks) {
      for (const clip of track.clips) {
        if (clip.text || !clip.assetId) continue;
        const a = this.assets.get(clip.assetId);
        if (!a?.url) continue;
        if (a.kind === "image") {
          if (track.kind !== "audio" && !this.images.has(a.id)) this.loadImage(a);
          continue;
        }
        const end = clipEnd(clip);
        if (end < ms - KEEP_MS || clip.start > ms + KEEP_MS) continue;
        wanted.add(clip.id);
        const on = ms >= clip.start && ms < end;
        const soon = !on && clip.start > ms && clip.start - ms < AHEAD_MS;
        if (!on && !soon && !held.has(clip.id) && !this.media.has(clip.id)) continue;
        const m = this.element(clip, a);
        // volume × fades × ducking (an element can't go above 100 %; the export can)
        const gain = on ? gainAt(track, clip, ms, this.spans) : 0;
        m.muted = track.muted || gain <= 0;
        m.volume = Math.min(1, Math.max(0, gain));
        if (Math.abs(m.playbackRate - clip.speed) > 0.001) m.playbackRate = clip.speed;
        const at = (on ? sourceTime(clip, ms) : held.has(clip.id) ? sourceTime(clip, held.get(clip.id)!) : clip.in) / 1000;
        if (on && this.playing) {
          if (hard || Math.abs(m.currentTime - at) > DRIFT_S * clip.speed) seekTo(m, at);
          if (m.paused) m.play().catch(() => {});
        } else {
          if (!m.paused) m.pause();
          if (Math.abs(m.currentTime - at) > 0.02) seekTo(m, at);
        }
      }
    }
    for (const [id, m] of this.media) {
      if (!wanted.has(id)) {
        release(m);
        this.media.delete(id);
      }
    }
  }

  private element(clip: Clip, a: PlayerAsset): Media {
    let m = this.media.get(clip.id);
    if (m && m.dataset.src === a.url) return m;
    if (m) release(m);
    m = document.createElement(a.kind === "video" ? "video" : "audio");
    m.crossOrigin = "anonymous";
    m.preload = "auto";
    if (m instanceof HTMLVideoElement) m.playsInline = true;
    // a faster or slower clip keeps its voice's pitch
    m.preservesPitch = true;
    m.dataset.src = a.url!;
    m.src = a.url!;
    // while paused, a frame that arrives after a seek is drawn straight away
    const redraw = () => !this.playing && this.draw();
    m.addEventListener("seeked", redraw);
    m.addEventListener("loadeddata", redraw);
    this.host.appendChild(m);
    this.media.set(clip.id, m);
    return m;
  }

  private loadImage(a: PlayerAsset) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => this.draw();
    img.src = a.url!;
    this.images.set(a.id, img);
  }

  private frameOf = (clip: Clip): Frame | null => {
    const a = clip.assetId ? this.assets.get(clip.assetId) : null;
    if (!a) return null;
    let f: Frame | null = null;
    let t = 0;
    if (a.kind === "image") {
      const img = this.images.get(a.id);
      f = img?.complete && img.naturalWidth ? { img, width: img.naturalWidth, height: img.naturalHeight } : null;
    } else {
      const m = this.media.get(clip.id);
      if (m instanceof HTMLVideoElement && m.readyState >= 2) {
        f = { img: m, width: m.videoWidth, height: m.videoHeight };
        t = m.currentTime;
      }
    }
    if (f && clip.bg) f.mask = this.mask(clip.id, f, t);
    return f;
  };

  /** The person mask of a clip's current frame (worked out again only when the frame changed). */
  private mask(id: string, f: Frame, t: number) {
    if (!this.masker.ready) {
      void this.masker.load();
      return null;
    }
    const had = this.maskAt.get(id);
    if (had && had.t === t && had.mask) return had.mask;
    let mask: HTMLCanvasElement | null = null;
    try {
      mask = this.masker.maskOf(id, f.img, f.width, f.height);
    } catch {
      mask = null;
    }
    this.maskAt.set(id, { t, mask });
    return mask;
  }

  draw() {
    drawFrame(this.ctx, this.tl, this.shown(), this.frameOf);
  }

  /** A still of the current frame (for the project's cover). */
  snapshot(type = "image/jpeg", quality = 0.8) {
    try {
      return this.canvas.toDataURL(type, quality);
    } catch {
      return null;
    }
  }
}

function seekTo(m: Media, s: number) {
  const max = Number.isFinite(m.duration) ? Math.max(0, m.duration - 0.01) : s;
  try {
    m.currentTime = Math.min(Math.max(0, s), max);
  } catch {
    /* not ready yet: the next sync tries again */
  }
}

function release(m: Media) {
  m.pause();
  m.removeAttribute("src");
  m.load();
  m.remove();
}
