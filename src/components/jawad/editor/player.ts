// «حيدرة كت» — the live preview. Sound files (and clips with worked sound) play through one Web Audio context:
// decoded once and scheduled sample-exact, with their volume, fades and ducking, and that context's clock is the
// preview's clock (on iPhone one tap unlocks it). Videos play their own sound from their <video> element (with the
// same volume, fades and ducking), so picture and sound never drift and a big file isn't downloaded twice. The
// pictures follow the clock, drawn on one canvas with the same drawFrame the export uses. Only clips near the playhead
// hold an element, so long projects stay light.

import { clipEnd, duration, gainAt, hasSoundFx, sourceTime, voiceSpans, type Clip, type Timeline } from "@/lib/editor/model";
import { drawFrame, layersAt, type Frame } from "./render";
import { Masker } from "./segment";
import { decodeWhole } from "./audio";
import { clipSound, soundKey } from "./voice";

export interface PlayerAsset {
  id: string;
  kind: "video" | "audio" | "image";
  url: string | null;
  hasAudio: boolean;
  durationMs?: number | null;
}

/** How far ahead clips get their element ready (so a cut doesn't wait), and how far around them it is kept. */
const AHEAD_MS = 2500;
const KEEP_MS = 6000;
/** The most the preview lets a playing picture drift from the sound before it is put back on time. */
const DRIFT_S = 0.5;
/** Past this the picture is nudged (played slightly faster or slower) back onto the sound. */
const NUDGE_S = 0.04;
/** How far ahead clips' sound is scheduled. */
const SCHEDULE_MS = 3000;
/** Longer files keep playing their sound from their element (decoding hours of sound would fill the memory). */
const DECODE_MAX_MS = 20 * 60_000;

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
  /** the sound: one context, the decoded files, and what is scheduled now */
  private ac: AudioContext | null = null;
  private anchor = { ctx: 0, ms: 0 };
  private sounds = new Map<string, AudioBuffer | "loading" | "failed">();
  private nodes = new Map<string, { src: AudioBufferSourceNode; gain: GainNode; key: string }>();
  /** clips' worked sound (noise reduction, effects): ready, being made, or not possible */
  private worked = new Map<string, AudioBuffer | "loading" | "failed">();

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
    // an edit while playing: the sound is scheduled again from here
    try {
      if (this.playing) {
        this.stopSound();
        this.reanchor();
        this.schedule();
      }
      this.sync(true);
    } catch (e) {
      console.warn("editor update", e);
    }
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
    if (this.playing) {
      this.stopSound();
      this.reanchor();
      this.schedule();
    }
    this.sync(true);
    this.draw();
    this.emit();
  }

  /** Called from a tap or a key (the browser lets sound start only then). */
  play() {
    const end = duration(this.tl);
    if (!end) return;
    if (this.ms >= end - 30) this.ms = 0;
    this.playing = true;
    this.clock = { perf: performance.now(), ms: this.ms };
    if (!this.ac) {
      try {
        this.ac = new AudioContext({ latencyHint: "interactive" });
        // iPhone: sound even with the silent switch on (like a video app)
        const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
        if (session) session.type = "playback";
      } catch {
        this.ac = null;
      }
    }
    void this.ac?.resume().catch(() => {});
    this.reanchor();
    this.schedule();
    this.sync(true);
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.tick);
    this.emit();
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    for (const m of this.media.values()) m.pause();
    this.stopSound();
    this.emit();
  }

  /** The sound clock now matches the preview's moment (a moment from now, so nothing starts in the past). */
  private reanchor() {
    if (this.ac) this.anchor = { ctx: this.ac.currentTime + 0.06, ms: this.ms };
  }

  private stopSound() {
    for (const { src } of this.nodes.values()) {
      try {
        src.onended = null;
        src.stop();
      } catch {
        /* never started */
      }
    }
    this.nodes.clear();
  }

  /** A file's decoded sound (decoded the first time it is asked for; null until ready or when it can't be). */
  private soundOf(a: PlayerAsset) {
    const had = this.sounds.get(a.id);
    if (had instanceof AudioBuffer) return had;
    if (had) return null;
    this.sounds.set(a.id, "loading");
    decodeWhole(a.url!).then(
      (b) => {
        this.sounds.set(a.id, b);
        if (this.playing) this.schedule();
      },
      () => this.sounds.set(a.id, "failed"),
    );
    return null;
  }

  /**
   * The clip's worked sound once it is ready (made the first time it is asked for); until then the plain sound
   * plays, and it switches over as soon as it is ready.
   */
  private workedOf(c: Clip, a: PlayerAsset) {
    const key = soundKey(a.url!, c);
    const had = this.worked.get(key);
    if (had instanceof AudioBuffer) return { buf: had, key };
    if (!had) {
      this.worked.set(key, "loading");
      clipSound(a.url!, c).then(
        (b) => {
          this.worked.set(key, b);
          if (this.worked.size > 12) this.worked.delete(this.worked.keys().next().value!);
          // playing the plain sound of this clip now: swap it
          const n = this.nodes.get(c.id);
          if (n && this.playing) {
            try {
              n.src.onended = null;
              n.src.stop();
            } catch {
              /* ended */
            }
            this.nodes.delete(c.id);
            this.schedule();
          }
        },
        () => this.worked.set(key, "failed"),
      );
    }
    return null;
  }

  /**
   * Does this clip's sound come from Web Audio (else from its element)? Only once its decoded sound is ready and the
   * sound clock runs: until then (a big file still loading, a browser that keeps the context asleep) the element
   * plays it, so the sound is never missing.
   */
  private webSound(clip: Clip, a: PlayerAsset) {
    if (!this.ac || this.ac.state !== "running" || !a.hasAudio || a.kind === "image") return false;
    // a video's own sound plays from its element (the picture and the sound of one stream never drift apart, and the
    // whole file isn't downloaded a second time while it streams: that is what made big videos stutter); Web Audio
    // takes sound files, clips whose sound is worked (noise reduction, effects) and clips turned up past 100%
    if (a.kind === "video" && !hasSoundFx(clip) && clip.volume <= 1) return false;
    const len = a.durationMs ?? 0;
    if ((len && len > DECODE_MAX_MS) || clip.out - clip.in > DECODE_MAX_MS) return false;
    return !!this.bufferOf(clip, a);
  }

  /** The sound Web Audio plays for a clip: its worked sound when it has effects and that is ready, else the file's. */
  private bufferOf(clip: Clip, a: PlayerAsset) {
    const worked = hasSoundFx(clip) ? this.workedOf(clip, a) : null;
    if (worked) return { buf: worked.buf, worked };
    const buf = this.soundOf(a);
    return buf ? { buf, worked: null } : null;
  }

  /** Every clip heard in the next few seconds gets its sound scheduled once (volume, fades and ducking as ramps). */
  private schedule() {
    const ac = this.ac;
    if (!ac || !this.playing) return;
    const ms = this.ms;
    for (const track of this.tl.tracks) {
      if (track.muted || track.kind === "text") continue;
      for (const c of track.clips) {
        if (this.nodes.has(c.id) || c.volume <= 0 || !c.assetId) continue;
        const end = clipEnd(c);
        if (end <= ms || c.start > ms + SCHEDULE_MS) continue;
        const a = this.assets.get(c.assetId);
        if (!a?.url || !this.webSound(c, a)) continue;
        const { buf, worked } = this.bufferOf(c, a)!;
        // from where the clip is now (or its start, if it is still to come)
        let from = Math.max(ms, c.start);
        let when = this.anchor.ctx + (from - this.anchor.ms) / 1000;
        if (when < ac.currentTime) {
          from += (ac.currentTime - when) * 1000 + 20;
          when = ac.currentTime + 0.02;
        }
        if (from >= end) continue;
        const src = ac.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = c.speed;
        const gain = ac.createGain();
        src.connect(gain).connect(ac.destination);
        if (c.fadeIn || c.fadeOut || track.duck) {
          gain.gain.setValueAtTime(gainAt(track, c, from, this.spans), when);
          for (let t = from + 50; t < end; t += 50) gain.gain.linearRampToValueAtTime(gainAt(track, c, t, this.spans), when + (t - from) / 1000);
        } else gain.gain.value = c.volume;
        // Safari refuses a start past the sound's end or a zero length (Chrome lets them pass): those clips stay quiet
        // (a worked sound starts at the clip's own beginning)
        const offset = Math.max(0, (sourceTime(c, from) - (worked ? c.in : 0)) / 1000);
        const length = ((end - from) / 1000) * c.speed;
        if (!(offset < buf.duration && length > 0.001)) {
          src.disconnect();
          continue;
        }
        try {
          src.start(when, offset, Math.min(length, buf.duration - offset));
        } catch (e) {
          console.warn("editor sound", e);
          src.disconnect();
          continue;
        }
        src.onended = () => {
          if (this.nodes.get(c.id)?.src === src) this.nodes.delete(c.id);
        };
        this.nodes.set(c.id, { src, gain, key: worked?.key ?? "" });
      }
    }
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  destroy() {
    this.pause();
    void this.ac?.close().catch(() => {});
    for (const m of this.media.values()) release(m);
    this.media.clear();
    this.host.remove();
    this.listeners.clear();
  }

  private tick = (now: number) => {
    if (!this.playing) return;
    // the sound's clock leads (the pictures follow it); without Web Audio, the page's clock
    if (this.ac && this.ac.state === "running") this.ms = Math.max(this.anchor.ms, Math.round(this.anchor.ms + (this.ac.currentTime - this.anchor.ctx) * 1000));
    else {
      this.ms = Math.round(this.clock.ms + (now - this.clock.perf));
      if (this.ac) this.reanchor();
    }
    this.clock = { perf: now, ms: this.ms };
    this.schedule();
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
        // the sound plays through Web Audio; the element only shows the picture (unless its sound can't be decoded)
        const gain = on && !this.webSound(clip, a) ? gainAt(track, clip, ms, this.spans) : 0;
        m.muted = track.muted || gain <= 0;
        m.volume = Math.min(1, Math.max(0, gain));
        const at = (on ? sourceTime(clip, ms) : held.has(clip.id) ? sourceTime(clip, held.get(clip.id)!) : clip.in) / 1000;
        let rate = clip.speed;
        if (on && this.playing) {
          // a picture a little behind or ahead catches up by playing a touch faster or slower (a jump only when far off:
          // jumping every few seconds is what made the preview stutter)
          const off = m.currentTime - at;
          if (hard || Math.abs(off) > DRIFT_S * clip.speed) seekTo(m, at);
          else if (Math.abs(off) > NUDGE_S) rate = clip.speed * (1 - Math.max(-0.03, Math.min(0.03, off * 0.5)));
          if (m.paused) m.play().catch(() => {});
        }
        if (Math.abs(m.playbackRate - rate) > 0.001) m.playbackRate = rate;
        if (!(on && this.playing)) {
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
    // one frame that can't be drawn (a picture the browser isn't ready to give) must never break the page
    try {
      drawFrame(this.ctx, this.tl, this.shown(), this.frameOf);
    } catch (e) {
      console.warn("editor draw", e);
    }
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
