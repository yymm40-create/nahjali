import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { crc32, remapTimeline, unzip, zipStore } from "@/components/jawad/editor/package";
import { emptyTimeline } from "@/lib/editor/model";

describe("project package", () => {
  it("crc32 matches the known value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("zips and unzips files with Arabic names", async () => {
    const z = await zipStore([
      { name: "project.json", data: new Blob(['{"a":1}']) },
      { name: "media/01 قصيدة.mp3", data: new Blob([new Uint8Array([1, 2, 3, 4, 5])]) },
    ]);
    const files = await unzip(z);
    expect([...files.keys()]).toEqual(["project.json", "media/01 قصيدة.mp3"]);
    expect(await files.get("project.json")!.text()).toBe('{"a":1}');
    expect(Array.from(new Uint8Array(await files.get("media/01 قصيدة.mp3")!.arrayBuffer()))).toEqual([1, 2, 3, 4, 5]);
  });

  it("reads a zip a computer compressed (deflate)", async () => {
    const body = new TextEncoder().encode("hello hello hello hello");
    const comp = deflateRawSync(body);
    const name = new TextEncoder().encode("a.txt");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(name.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(comp.length, 20);
    cd.writeUInt32LE(body.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(0, 42);
    const cdAt = 30 + name.length + comp.length;
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(1, 8);
    end.writeUInt16LE(1, 10);
    end.writeUInt32LE(46 + name.length, 12);
    end.writeUInt32LE(cdAt, 16);
    const files = await unzip(new Blob([local, name, comp, cd, name, end]));
    expect(await files.get("a.txt")!.text()).toBe("hello hello hello hello");
  });

  it("points clips at the new files and leaves out the ones that didn't come", () => {
    const tl = emptyTimeline("9:16");
    const clip = (id: string, assetId: string | null) => ({ id, assetId }) as never;
    tl.tracks[0].clips = [clip("c1", "old1"), clip("c2", "old2"), clip("t", null)];
    const out = remapTimeline(tl, new Map([["old1", "new1"]]));
    expect(out.tracks[0].clips.map((c) => [c.id, c.assetId])).toEqual([
      ["c1", "new1"],
      ["t", null],
    ]);
  });
});
