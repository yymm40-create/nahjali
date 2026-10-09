import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BoxSplitter, Packager, fragmentStart, trackKinds, trackTimescales } from "@/lib/learn/fmp4";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

/** A real fragmented MP4 of `secs` seconds with a key frame every second (H.264 + AAC). */
function makeFmp4(secs: number) {
  const dir = mkdtempSync(join(tmpdir(), "learn-"));
  const out = join(dir, "v.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `testsrc=size=320x180:rate=25:duration=${secs}`, "-f", "lavfi", "-i", `sine=frequency=440:duration=${secs}`, "-c:v", "libx264", "-g", "25", "-keyint_min", "25", "-sc_threshold", "0", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "frag_keyframe+empty_moov+default_base_moof", out]);
  return new Uint8Array(readFileSync(out));
}

const box = (type: string, payload: Uint8Array) => {
  const out = new Uint8Array(8 + payload.length);
  new DataView(out.buffer).setUint32(0, out.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(payload, 8);
  return out;
};

describe("BoxSplitter", () => {
  it("returns whole boxes however the bytes arrive", () => {
    const a = box("ftyp", new Uint8Array([1, 2, 3, 4]));
    const b = box("free", new Uint8Array(50));
    const all = new Uint8Array([...a, ...b]);
    const s = new BoxSplitter();
    const got: string[] = [];
    for (let i = 0; i < all.length; i += 5) got.push(...s.push(all.subarray(i, i + 5)).map((x) => x.type));
    expect(got).toEqual(["ftyp", "free"]);
    expect(s.pending).toBe(0);
  });
  it("refuses a box of size 0 (a plain MP4 is not what the player needs)", () => {
    const bad = new Uint8Array(16);
    bad.set(new TextEncoder().encode("mdat"), 4);
    expect(() => new BoxSplitter().push(bad)).toThrow();
  });
});

describe.skipIf(!hasFfmpeg)("Packager on a real fragmented MP4", () => {
  const file = hasFfmpeg ? makeFmp4(10) : new Uint8Array();

  it("makes one init piece and fragments that start at the key frames, whatever the chunking", () => {
    for (const chunk of [file.length, 4096, 7]) {
      const p = new Packager();
      const pieces = [];
      for (let i = 0; i < file.length; i += chunk) pieces.push(...p.push(file.subarray(i, i + chunk)));
      expect(pieces[0].kind).toBe("init");
      const segs = pieces.filter((x) => x.kind === "segment");
      expect(segs.length).toBeGreaterThanOrEqual(5);
      expect(segs[0]).toMatchObject({ n: 1 });
      // starts are increasing and begin at (about) zero
      const starts = segs.map((s) => (s.kind === "segment" ? s.start : -1));
      expect(starts[0]).toBeLessThan(0.2);
      for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1]);
      expect(p.clean).toBe(true);
    }
  });

  it("the init piece and a fragment together are a valid file", () => {
    const p = new Packager();
    const pieces = p.push(file);
    const init = pieces[0].bytes;
    const seg = pieces[1].bytes;
    const joined = new Uint8Array(init.length + seg.length);
    joined.set(init, 0);
    joined.set(seg, init.length);
    const dir = mkdtempSync(join(tmpdir(), "learn-"));
    const path = join(dir, "one.mp4");
    writeFileSync(path, joined);
    const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", path]).toString();
    expect(probe).toContain("video");
    expect(probe).toContain("audio");
  });

  it("reads the track timescales and kinds from the init piece", () => {
    const init = new Packager().push(file)[0].bytes;
    const scales = trackTimescales(init);
    const kinds = trackKinds(init);
    expect(scales.size).toBe(2);
    expect([...kinds.values()].sort()).toEqual(["soun", "vide"]);
    const moofBox = new BoxSplitter().push(file).find((b) => b.type === "moof")!;
    expect(fragmentStart(moofBox.bytes, scales, kinds)).toBeCloseTo(0, 1);
  });
});
