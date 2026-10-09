// The course player's engine. There is no file and no link to a file: the page asks the site for one locked piece at a time,
// opens it here with THIS viewing's key, and hands the bytes to the video through Media Source Extensions. The blob address
// the video plays from is revoked as soon as it is attached, so it can't be fetched again from the elements panel or the
// network panel; what travels is only pieces locked for one session, paced by the site to the speed of watching.

import { aad, fromB64, importKey, open } from "@/lib/learn/crypto";
import { LEARN, segmentAt, type Manifest } from "@config/learn";

export interface PlayInfo {
  session: string;
  key: string;
  manifest: Manifest;
  label: string;
  beatEvery: number;
}

export type Fatal = "ended" | "unsupported" | "failed";

interface Callbacks {
  /** the viewing can't go on (closed elsewhere, refused, or the browser can't play this) */
  onFatal: (why: Fatal, message: string) => void;
  /** pieces are being waited for (the site paces them) */
  onWait?: (waiting: boolean) => void;
}

/** MediaSource, or Safari's iPhone twin. */
type MSLike = MediaSource;
const mediaSource = (): { new (): MSLike; isTypeSupported(t: string): boolean } | null => {
  const w = window as unknown as { MediaSource?: unknown; ManagedMediaSource?: unknown };
  return (w.MediaSource ?? w.ManagedMediaSource ?? null) as ReturnType<typeof mediaSource>;
};
export const canPlayCourse = () => typeof window !== "undefined" && !!mediaSource();

const AHEAD = 40; // seconds buffered ahead of the playing time
const BEHIND = 150; // seconds kept behind it

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class LearnStream {
  private ms: MSLike | null = null;
  private sb: SourceBuffer | null = null;
  private key: CryptoKey | null = null;
  private have = new Set<number>();
  private dead = false;
  private running = false;
  private wake: (() => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private onEvt = () => this.wake?.();
  private onHide = () => void this.send({ end: true }, true);

  constructor(
    private video: HTMLVideoElement,
    private lessonId: string,
    private info: PlayInfo,
    private cb: Callbacks,
  ) {}

  async start() {
    const M = mediaSource();
    const { mime } = this.info.manifest;
    if (!M || !M.isTypeSupported(mime)) {
      this.cb.onFatal("unsupported", "هذا المتصفح ما يقدر يشغّل الدورات. جرّب Chrome أو Safari حديث.");
      return;
    }
    this.key = await importKey(fromB64(this.info.key));
    const ms = new M();
    this.ms = ms;
    const v = this.video as HTMLVideoElement & { disableRemotePlayback?: boolean };
    v.disableRemotePlayback = true;
    const url = URL.createObjectURL(ms as unknown as MediaSource);
    const opened = new Promise<void>((r) => ms.addEventListener("sourceopen", () => r(), { once: true }));
    if ((window as unknown as { MediaSource?: unknown }).MediaSource) v.src = url;
    else (v as unknown as { srcObject: unknown }).srcObject = ms;
    await opened;
    // the address is useless from now on (nobody can fetch it again), but the video keeps playing from the source it has
    URL.revokeObjectURL(url);
    const sb = ms.addSourceBuffer(mime);
    this.sb = sb;
    ms.duration = this.info.manifest.duration;
    await this.append(await this.piece(0));

    for (const e of ["seeking", "seeked", "timeupdate", "waiting", "playing"]) this.video.addEventListener(e, this.onEvt);
    window.addEventListener("pagehide", this.onHide);
    this.timer = setInterval(() => void this.send({}), this.info.beatEvery * 1000);
    void this.pump();
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.wake?.();
    if (this.timer) clearInterval(this.timer);
    for (const e of ["seeking", "seeked", "timeupdate", "waiting", "playing"]) this.video.removeEventListener(e, this.onEvt);
    window.removeEventListener("pagehide", this.onHide);
    try {
      if (this.ms?.readyState === "open") this.ms.endOfStream();
    } catch {}
    this.video.pause();
    this.video.removeAttribute("src");
    (this.video as unknown as { srcObject: unknown }).srcObject = null;
    this.video.load();
    void this.send({ end: true }, true);
  }

  /** «أنا موجود» (or a report); the site answers false when this viewing was closed. */
  async send(body: { bad?: string; end?: boolean }, keepalive = false) {
    try {
      const res = await fetch("/api/learn/beat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ session: this.info.session, ...body }), keepalive });
      if (body.end || this.dead) return;
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (res.status === 401 || j.ok === false) this.fail("ended", "انتهت هذه المشاهدة (فتحت الدرس في مكان آخر، أو سجّلت خروجك). اضغط تشغيل للبدء من جديد.");
    } catch {}
  }

  private fail(why: Fatal, message: string) {
    if (this.dead) return;
    this.cb.onFatal(why, message);
  }

  private async piece(n: number): Promise<Uint8Array> {
    for (let attempt = 0; !this.dead; ) {
      let res: Response;
      try {
        res = await fetch(`/api/learn/seg?s=${this.info.session}&n=${n}`, { headers: { "x-learn": "1" }, cache: "no-store", credentials: "same-origin" });
      } catch {
        if (++attempt > 4) throw new Error("network");
        await sleep(800 * attempt);
        continue;
      }
      if (res.status === 429) {
        // the site hands pieces out at the speed of watching: wait and ask again
        this.cb.onWait?.(true);
        await sleep(4000);
        continue;
      }
      this.cb.onWait?.(false);
      if (res.status === 410 || res.status === 403 || res.status === 401) {
        this.fail("ended", "انتهت هذه المشاهدة (فتحت الدرس في مكان آخر، أو سجّلت خروجك). اضغط تشغيل للبدء من جديد.");
        throw new Error("closed");
      }
      if (!res.ok) {
        if (++attempt > 4) throw new Error(`piece ${n}: ${res.status}`);
        await sleep(800 * attempt);
        continue;
      }
      return open(this.key!, new Uint8Array(await res.arrayBuffer()), aad("s", this.info.session, this.lessonId, n));
    }
    throw new Error("closed");
  }

  private updateEnd() {
    const sb = this.sb!;
    return new Promise<void>((resolve, reject) => {
      const ok = () => { sb.removeEventListener("error", bad); resolve(); };
      const bad = () => { sb.removeEventListener("updateend", ok); reject(new Error("buffer error")); };
      sb.addEventListener("updateend", ok, { once: true });
      sb.addEventListener("error", bad, { once: true });
    });
  }

  private async append(bytes: Uint8Array) {
    const sb = this.sb!;
    for (let tries = 0; ; tries++) {
      while (sb.updating) await sleep(20);
      try {
        const done = this.updateEnd();
        sb.appendBuffer(bytes as unknown as BufferSource);
        await done;
        return;
      } catch (e) {
        if ((e as DOMException)?.name === "QuotaExceededError" && tries < 3) {
          await this.evict(true);
          continue;
        }
        throw e;
      }
    }
  }

  /** Frees what was watched long ago (all of it behind the playing time when the browser says it is full). */
  private async evict(force = false) {
    const sb = this.sb!;
    const t = this.video.currentTime;
    const keepFrom = force ? t - 10 : t - BEHIND;
    if (keepFrom <= 0 || !sb.buffered.length || sb.buffered.start(0) >= keepFrom) return;
    while (sb.updating) await sleep(20);
    const done = this.updateEnd();
    sb.remove(0, keepFrom);
    await done.catch(() => null);
    for (const [i, s] of this.info.manifest.segments.entries()) if (s.start + s.dur <= keepFrom) this.have.delete(i);
  }

  /** The browser threw away what we thought was there (memory pressure): ask again for the pieces around the playing time. */
  private reconcile() {
    const t = this.video.currentTime;
    const b = this.video.buffered;
    for (let i = 0; i < b.length; i++) if (b.start(i) - 0.3 <= t && b.end(i) >= t) return;
    const idx = segmentAt(this.info.manifest.segments, t);
    if (idx >= 0) for (let i = Math.max(0, idx - 1); i <= idx + 2; i++) this.have.delete(i);
  }

  private async pump() {
    if (this.running) return;
    this.running = true;
    const segs = this.info.manifest.segments;
    try {
      while (!this.dead) {
        const t = this.video.currentTime;
        if (this.video.readyState < 3 && !this.video.seeking) this.reconcile();
        let target = -1;
        for (let i = Math.max(0, segmentAt(segs, t)); i < segs.length; i++) {
          if (segs[i].start - t > AHEAD) break;
          if (!this.have.has(i)) {
            target = i;
            break;
          }
        }
        if (target < 0) {
          if (this.have.size === segs.length && this.ms?.readyState === "open" && !this.sb!.updating) {
            try {
              this.ms.endOfStream();
            } catch {}
          }
          await new Promise<void>((r) => {
            this.wake = r;
            setTimeout(r, 700);
          });
          continue;
        }
        const bytes = await this.piece(segs[target].n);
        if (this.dead) return;
        await this.append(bytes);
        this.have.add(target);
        await this.evict();
      }
    } catch (e) {
      if (!this.dead && (e as Error).message !== "closed") this.fail("failed", "تعذّر تحميل جزء من الفيديو. تأكد من الاتصال وأعد المحاولة.");
    } finally {
      this.running = false;
    }
  }
}

export { LEARN };
