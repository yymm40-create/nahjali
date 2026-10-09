import { describe, expect, it } from "vitest";
import { aad, fromB64, importKey, open, randomKey, seal, toB64 } from "@/lib/learn/crypto";

describe("piece locking", () => {
  it("opens what it locked, and the same piece locks differently each time", async () => {
    const key = await importKey(randomKey());
    const plain = new Uint8Array(3000).map((_, i) => i % 251);
    const a = await seal(key, plain, aad("c", "lesson", 4));
    const b = await seal(key, plain, aad("c", "lesson", 4));
    expect(a).not.toEqual(b);
    expect(a.length).toBe(plain.length + 12 + 16);
    expect(await open(key, a, aad("c", "lesson", 4))).toEqual(plain);
  });
  it("refuses a piece moved to another place, a wrong key, or a changed byte", async () => {
    const raw = randomKey();
    const key = await importKey(raw);
    const sealed = await seal(key, new Uint8Array([1, 2, 3, 4, 5]), aad("c", "L", 1));
    await expect(open(key, sealed, aad("c", "L", 2))).rejects.toBeTruthy();
    await expect(open(key, sealed, aad("s", "L", 1))).rejects.toBeTruthy();
    await expect(open(await importKey(randomKey()), sealed, aad("c", "L", 1))).rejects.toBeTruthy();
    const bad = sealed.slice();
    bad[20] ^= 1;
    await expect(open(key, bad, aad("c", "L", 1))).rejects.toBeTruthy();
    await expect(open(key, new Uint8Array(10), aad("c", "L", 1))).rejects.toBeTruthy();
  });
  it("base64 round-trips big arrays", () => {
    const u = new Uint8Array(100_000).map((_, i) => (i * 7) % 256);
    expect(fromB64(toB64(u))).toEqual(u);
  });
});
