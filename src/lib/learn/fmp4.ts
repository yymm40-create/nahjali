// Cuts a fragmented MP4 (the stream the owner's browser makes with Mediabunny) into the pieces the course player needs:
// one INIT piece (ftyp + moov: the codecs and tracks) and one piece per fragment (moof + mdat), each with its start time.
// Pure byte work, no browser APIs: it reads the stream as it is written, box by box, so a long video never sits in memory.

export interface Box {
  type: string;
  bytes: Uint8Array;
}

const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u64 = (b: Uint8Array, o: number) => u32(b, o) * 2 ** 32 + u32(b, o + 4);
const fourcc = (b: Uint8Array, o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

/** A box's header: its total size and where its payload starts; null when the bytes are too few to tell. */
function header(b: Uint8Array, o: number): { size: number; head: number; type: string } | null {
  if (o + 8 > b.length) return null;
  const size = u32(b, o);
  const type = fourcc(b, o + 4);
  if (size === 1) {
    if (o + 16 > b.length) return null;
    return { size: u64(b, o + 8), head: 16, type };
  }
  return { size, head: 8, type };
}

/** The boxes inside [start, end) of `b` (one level). */
function* children(b: Uint8Array, start = 0, end = b.length): Generator<{ type: string; payload: number; end: number }> {
  let o = start;
  while (o + 8 <= end) {
    const h = header(b, o);
    if (!h || h.size < h.head || o + h.size > end) return;
    yield { type: h.type, payload: o + h.head, end: o + h.size };
    o += h.size;
  }
}

/** Reads a stream of bytes (in any chunking) and gives back each whole top-level box. */
export class BoxSplitter {
  private buf: Uint8Array = new Uint8Array(0);

  push(chunk: Uint8Array): Box[] {
    if (chunk.length) {
      if (this.buf.length === 0) this.buf = chunk;
      else {
        const joined = new Uint8Array(this.buf.length + chunk.length);
        joined.set(this.buf, 0);
        joined.set(chunk, this.buf.length);
        this.buf = joined;
      }
    }
    const out: Box[] = [];
    let o = 0;
    for (;;) {
      const h = header(this.buf, o);
      if (!h) break;
      if (h.size < h.head) throw new Error("not a fragmented MP4 (a box of size 0 or too small)");
      if (o + h.size > this.buf.length) break;
      out.push({ type: h.type, bytes: this.buf.slice(o, o + h.size) });
      o += h.size;
    }
    this.buf = o ? this.buf.slice(o) : this.buf;
    return out;
  }

  /** Bytes read but not yet a whole box. */
  get pending() {
    return this.buf.length;
  }
}

/** The moov inside `b` (a moov box itself, or an init piece that has ftyp before it): where its children start and end. */
function moovRange(b: Uint8Array): { start: number; end: number } | null {
  for (const x of children(b)) if (x.type === "moov") return { start: x.payload, end: x.end };
  return null;
}

/** track id → timescale, from a moov box (or an init piece). */
export function trackTimescales(moov: Uint8Array): Map<number, number> {
  const out = new Map<number, number>();
  const m = moovRange(moov);
  if (!m) return out;
  for (const trak of children(moov, m.start, m.end)) {
    if (trak.type !== "trak") continue;
    let id = 0;
    let scale = 0;
    for (const c of children(moov, trak.payload, trak.end)) {
      if (c.type === "tkhd") id = u32(moov, c.payload + (moov[c.payload] === 1 ? 20 : 12));
      if (c.type === "mdia") {
        for (const d of children(moov, c.payload, c.end)) if (d.type === "mdhd") scale = u32(moov, d.payload + (moov[d.payload] === 1 ? 20 : 12));
      }
    }
    if (id && scale) out.set(id, scale);
  }
  return out;
}

/** The kinds of track in a moov: track id → handler ("vide" or "soun"). */
export function trackKinds(moov: Uint8Array): Map<number, string> {
  const out = new Map<number, string>();
  const m = moovRange(moov);
  if (!m) return out;
  for (const trak of children(moov, m.start, m.end)) {
    if (trak.type !== "trak") continue;
    let id = 0;
    let kind = "";
    for (const c of children(moov, trak.payload, trak.end)) {
      if (c.type === "tkhd") id = u32(moov, c.payload + (moov[c.payload] === 1 ? 20 : 12));
      if (c.type === "mdia") for (const d of children(moov, c.payload, c.end)) if (d.type === "hdlr") kind = fourcc(moov, d.payload + 8);
    }
    if (id && kind) out.set(id, kind);
  }
  return out;
}

/** Start of a fragment in seconds: the earliest base decode time among its tracks (the video's, when it has one). */
export function fragmentStart(moof: Uint8Array, scales: Map<number, number>, kinds?: Map<number, string>): number | null {
  const m = header(moof, 0);
  if (!m) return null;
  const starts: { id: number; t: number }[] = [];
  for (const traf of children(moof, m.head, moof.length)) {
    if (traf.type !== "traf") continue;
    let id = 0;
    let t: number | null = null;
    for (const c of children(moof, traf.payload, traf.end)) {
      if (c.type === "tfhd") id = u32(moof, c.payload + 4);
      if (c.type === "tfdt") t = moof[c.payload] === 1 ? u64(moof, c.payload + 4) : u32(moof, c.payload + 4);
    }
    const scale = scales.get(id);
    if (t !== null && scale) starts.push({ id, t: t / scale });
  }
  if (!starts.length) return null;
  const video = starts.filter((s) => kinds?.get(s.id) === "vide");
  return Math.min(...(video.length ? video : starts).map((s) => s.t));
}

export type Piece = { kind: "init"; bytes: Uint8Array } | { kind: "segment"; n: number; start: number; bytes: Uint8Array };

/** Feeds on the stream's bytes, hands out the init piece and each fragment (moof + the mdat after it). */
export class Packager {
  private split = new BoxSplitter();
  private head: Uint8Array[] = [];
  private scales = new Map<number, number>();
  private kinds = new Map<number, string>();
  private moof: Uint8Array | null = null;
  private count = 0;
  private gotInit = false;

  push(chunk: Uint8Array): Piece[] {
    const out: Piece[] = [];
    for (const box of this.split.push(chunk)) {
      if (box.type === "ftyp") this.head.push(box.bytes);
      else if (box.type === "moov") {
        this.head.push(box.bytes);
        this.scales = trackTimescales(box.bytes);
        this.kinds = trackKinds(box.bytes);
        out.push({ kind: "init", bytes: concat(this.head) });
        this.gotInit = true;
      } else if (box.type === "moof") {
        if (!this.gotInit) throw new Error("fragment before the init piece");
        this.moof = box.bytes;
      } else if (box.type === "mdat" && this.moof) {
        const start = fragmentStart(this.moof, this.scales, this.kinds);
        if (start === null) throw new Error("a fragment has no start time");
        out.push({ kind: "segment", n: ++this.count, start, bytes: concat([this.moof, box.bytes]) });
        this.moof = null;
      }
      // anything else (styp, sidx, mfra, free, a lone mdat) is not needed for playing
    }
    return out;
  }

  /** The stream ended: true when nothing is left half-read. */
  get clean() {
    return this.split.pending === 0 && this.moof === null && this.gotInit;
  }
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
