import { describe, expect, it } from "vitest";
import { generatorById } from "@config/jawad/generators";
import type { RefMeta } from "@config/jawad/types";
import { evaluate, priceTable } from "@/lib/jawad/engine";

const def = generatorById("byteplus-seedance-2-5")!;
const frame = (role: "first_frame" | "last_frame"): RefMeta => ({
  id: role,
  kind: "image",
  role,
  mime: "image/jpeg",
  bytes: 100_000,
  width: 1280,
  height: 720,
  status: "ready",
});

describe("Seedance AI Extend", () => {
  it.each([
    ["first_frame" as const, "first_frame"],
    ["last_frame" as const, "last_frame"],
  ])("accepts a single %s boundary frame", (role, mode) => {
    const result = evaluate(
      def,
      { settings: { ratio: "16:9", resolution: "720p", duration: 5, audio: true }, prompt: "continue", instructions: "", refStyle: "frames", refs: [frame(role)], strict: false },
      priceTable(def, undefined),
    );
    expect(result.mode.id).toBe(mode);
    expect(result.issues.filter((issue) => issue.field !== "price")).toEqual([]);
    expect(result.settings.ratio).toBe("adaptive");
  });
});
