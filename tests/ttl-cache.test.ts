import { describe, expect, it } from "vitest";
import { ttlCache } from "@/lib/ttl-cache";

describe("ttlCache", () => {
  it("a crowd asking together shares one question, and later ones reuse the answer", async () => {
    let calls = 0;
    const get = ttlCache(1000, async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return { n: calls };
    });
    const all = await Promise.all(Array.from({ length: 500 }, () => get()));
    expect(calls).toBe(1);
    expect(new Set(all.map((x) => x.n)).size).toBe(1);
    await get();
    expect(calls).toBe(1);
  });
  it("asks again after the time, or after being cleared", async () => {
    let calls = 0;
    const get = ttlCache(30, async () => ++calls);
    expect(await get()).toBe(1);
    await new Promise((r) => setTimeout(r, 50));
    expect(await get()).toBe(2);
    get.clear();
    expect(await get()).toBe(3);
  });
  it("when the database fails the last good answer is served; with none, the error", async () => {
    let fail = false;
    const get = ttlCache(10, async () => {
      if (fail) throw new Error("down");
      return "ok";
    });
    await expect(ttlCache(10, async () => { throw new Error("down"); })()).rejects.toThrow("down");
    expect(await get()).toBe("ok");
    fail = true;
    await new Promise((r) => setTimeout(r, 20));
    expect(await get()).toBe("ok");
  });
});
