import { describe, expect, it } from "vitest";
import { probe, probeAdts, probeAmr, probeFlac, probeOgg, sniff, UPLOAD_EXT, UPLOAD_MIMES } from "@/lib/jawad/media";

const bytes = (...xs: (number | string)[]) => new Uint8Array(xs.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));
const pad = (b: Uint8Array, n: number) => {
  const o = new Uint8Array(Math.max(n, b.length));
  o.set(b);
  return o;
};

describe("every sound is taken (owner, 15 Nov 2026)", () => {
  it("knows each sound by its bytes", () => {
    expect(sniff(pad(bytes(0, 0, 0, 0x20, "ftypM4A ", 0, 0, 0, 0), 16))).toEqual({ kind: "audio", mime: "audio/mp4" });
    expect(sniff(pad(bytes("OggS"), 16))?.mime).toBe("audio/ogg");
    expect(sniff(pad(bytes("fLaC"), 16))?.mime).toBe("audio/flac");
    expect(sniff(pad(bytes("#!AMR\n"), 16))?.mime).toBe("audio/amr");
    expect(sniff(pad(bytes("FORM", 0, 0, 0, 0, "AIFF"), 16))?.mime).toBe("audio/aiff");
    expect(sniff(pad(bytes(0x1a, 0x45, 0xdf, 0xa3), 16))?.mime).toBe("audio/webm");
    expect(sniff(pad(bytes(0xff, 0xf1, 0x50, 0x80), 16))?.mime).toBe("audio/aac");
    // an MP3 frame is still an MP3
    expect(sniff(pad(bytes(0xff, 0xfb, 0x90, 0x64), 16))?.mime).toBe("audio/mpeg");
    for (const m of ["audio/mp4", "audio/aac", "audio/ogg", "audio/flac", "audio/webm", "audio/amr", "audio/aiff"]) {
      expect(UPLOAD_MIMES[m]).toBe("audio");
      expect(UPLOAD_EXT[m]).toBeTruthy();
    }
  });

  it("reads a FLAC's length from STREAMINFO", () => {
    const b = new Uint8Array(42);
    b.set(bytes("fLaC", 0, 0, 0, 34), 0);
    // 44100 Hz (0x0AC44 in 20 bits), 88200 samples = 2 s
    b[18] = 0x0a;
    b[19] = 0xc4;
    b[20] = 0x40;
    b[21] = 0x00;
    b.set([0, 1, 0x58, 0x88], 22);
    expect(probeFlac(b).durationMs).toBe(2000);
  });

  it("counts AAC and AMR frames", () => {
    // 3 ADTS frames of 10 bytes at 44100 Hz (rate index 4)
    const f = [0xff, 0xf1, 4 << 2, 0x80, (10 >> 3) & 0xff, (10 & 7) << 5, 0xfc, 0, 0, 0];
    const aac = new Uint8Array([...f, ...f, ...f]);
    expect(probeAdts(aac).durationMs).toBe(Math.round(((3 * 1024) / 44100) * 1000));
    // 50 AMR frames of mode 7 (32 bytes) = 1 s
    const amr = new Uint8Array(6 + 50 * 32);
    amr.set(bytes("#!AMR\n"));
    for (let i = 0; i < 50; i++) amr[6 + i * 32] = 7 << 3;
    expect(probeAmr(amr).durationMs).toBe(1000);
  });

  it("reads an Opus file's length from its last page", () => {
    const b = new Uint8Array(400);
    b.set(bytes("OggS"), 0);
    b.set(bytes("OpusHead"), 28);
    b.set(bytes("OggS"), 300);
    // granule 96000 at 48 kHz = 2 s
    b.set([0x00, 0x77, 0x01, 0, 0, 0, 0, 0], 306);
    expect(probeOgg(b).durationMs).toBe(2000);
    expect(probe(b, { kind: "audio", mime: "audio/ogg" }).durationMs).toBe(2000);
  });
});
