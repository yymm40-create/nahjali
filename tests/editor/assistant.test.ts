import { describe, expect, it } from "vitest";
import { checkCommands } from "@/lib/editor/assistant-core";
import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline } from "@/lib/editor/model";
import { lib, main, video } from "./helpers";

const assets = lib(video("a", 4000), video("b", 6000));
const tl = applyAll(emptyTimeline(), [{ type: "add_clip", assetId: "a" }, { type: "add_clip", assetId: "b" }], assets).timeline;

describe("checking Claude's commands before they reach the page", () => {
  it("passes commands that run", () => {
    const r = checkCommands(tl, [JSON.stringify({ type: "remove_ranges", ranges: [[1000, 2000]] }), JSON.stringify({ type: "add_text", at: 0, body: "عنوان" })], assets);
    expect(r.error).toBeNull();
    expect(r.cmds).toHaveLength(2);
  });

  it("stops at the first one that can't run, with the reason", () => {
    const id = main(tl).clips[0].id;
    const r = checkCommands(tl, [JSON.stringify({ type: "update_clip", clipId: id, patch: { volume: 0.4 } }), JSON.stringify({ type: "add_clip", assetId: "invented" }), JSON.stringify({ type: "add_text", at: 0 })], assets);
    expect(r.error?.i).toBe(1);
    expect(r.error?.message).toMatch(/مكتبة/);
  });

  it("refuses text that isn't a command", () => {
    expect(checkCommands(tl, ["not json"], assets).error).toEqual({ i: 0, message: "not valid JSON" });
    expect(checkCommands(tl, ["[1]"], assets).error?.message).toBe("not a command object");
    expect(checkCommands(tl, [JSON.stringify({ type: "format_disk" })], assets).error?.i).toBe(0);
  });
});
