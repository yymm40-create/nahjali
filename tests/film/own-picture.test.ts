import { describe, expect, it } from "vitest";
import { backToSheetPlan, ownPicturePlan, type MapChoice, type MapItem } from "@/lib/film/sheets";
import { SHEET_APP_INTEGRATION, SHEET_MAKER_SCHEMA } from "@config/film-prompts/sheet-maker";
import type { FilmAsset } from "@/lib/film/types";

const item: MapItem = { id: "ENV-01", kind: "environment", name: "بيت الغابة", coverage: "" };
const asset = (id: string, kind: FilmAsset["kind"], status: string, meta: Record<string, unknown> = {}, ref = "ENV-01") =>
  ({ id, kind, ref_key: ref, status, storage_path: `p/${id}.png`, meta }) as unknown as FilmAsset;

describe("«صورتي كما هي»: the person's own picture instead of a sheet, at any time after the map is approved", () => {
  it("takes the reference picture as it is when none of the sheets drawn from it was liked", () => {
    const assets = [asset("up", "upload", "uploaded", { mode: "reference" }), asset("s1", "image", "rejected"), asset("s2", "image", "generated")];
    const plan = ownPicturePlan(item, { "ENV-01": "reference" }, assets)!;
    expect(plan.id).toBe("up");
    expect(plan.meta).toMatchObject({ mode: "as_is", at_name: "@بيت_الغابة", was: "reference", was_mode: "reference" });
    // nothing was approved for the item, so nothing is taken down
    expect(plan.reject).toEqual([]);
    expect(plan.backToUpload).toEqual([]);
  });

  it("replaces an approved sheet and keeps the name the director already writes", () => {
    const assets = [asset("up", "upload", "uploaded", { mode: "reference" }), asset("sheet", "image", "approved", { at_name: "@البيت" })];
    const plan = ownPicturePlan(item, { "ENV-01": "reference" }, assets)!;
    expect(plan.reject).toEqual(["sheet"]);
    expect(plan.name).toBe("@البيت");
    expect(plan.meta.at_name).toBe("@البيت");
  });

  it("uses the picture named, and leaves the person's other pictures as uploads (never rejected)", () => {
    const assets = [asset("old", "upload", "approved", { mode: "as_is", at_name: "@بيت_الغابة" }), asset("new", "upload", "uploaded")];
    const plan = ownPicturePlan(item, { "ENV-01": "as_is" }, assets, "new")!;
    expect(plan.id).toBe("new");
    expect(plan.backToUpload).toEqual(["old"]);
    expect(plan.reject).toEqual([]);
    // already «كما هي»: the earlier choice it remembers is not overwritten with «as_is»
    expect(plan.meta.was).toBeUndefined();
  });

  it("says there is no picture when the person gave none (a made sheet), or only a rejected one", () => {
    expect(ownPicturePlan(item, {}, [asset("s", "image", "generated")])).toBeNull();
    expect(ownPicturePlan(item, {}, [asset("up", "upload", "rejected")])).toBeNull();
    // another item's picture is never taken
    expect(ownPicturePlan(item, {}, [asset("up", "upload", "uploaded", {}, "ENV-02")])).toBeNull();
  });
});

describe("«اصنع لها شيت»: back from the person's picture to a sheet", () => {
  it("goes back to the choice it had, and the picture is an upload again with its reference role", () => {
    const assets = [asset("up", "upload", "approved", { mode: "as_is", at_name: "@بيت_الغابة", was: "reference", was_mode: "reference" })];
    const plan = backToSheetPlan({ "ENV-01": "as_is" }, assets, "ENV-01")!;
    expect(plan.choice).toBe("reference");
    expect(plan.uploads).toEqual([{ id: "up", meta: { mode: "reference" } }]);
  });

  it("there and back again leaves the picture exactly as it was", () => {
    const up = asset("up", "upload", "uploaded", { mode: "reference", series_name: "x" });
    const there = ownPicturePlan(item, { "ENV-01": "reference" }, [up])!;
    const back = backToSheetPlan({ "ENV-01": "as_is" }, [{ ...up, status: "approved", meta: there.meta } as FilmAsset], "ENV-01")!;
    expect(back.choice).toBe("reference");
    expect(back.uploads).toEqual([{ id: "up", meta: { mode: "reference", series_name: "x" } }]);
  });

  it("a real person's photos go back to «حوّل», each keeping its own mode", () => {
    const assets = [
      asset("p1", "upload", "uploaded", { mode: "convert", likeness: { face: "x" } }),
      asset("p2", "upload", "uploaded", { mode: "as_is", was: "convert", was_mode: "convert" }),
      // a ready picture given later from the card: never one of the photos to convert
      asset("ready", "upload", "approved", { mode: "as_is", at_name: "@علي", was: "convert" }),
    ];
    const plan = backToSheetPlan({ "ENV-01": "as_is" }, assets, "ENV-01")!;
    expect(plan.choice).toBe("convert");
    expect(plan.uploads.find((u) => u.id === "p1")!.meta).toEqual({ mode: "convert", likeness: { face: "x" } });
    expect(plan.uploads.find((u) => u.id === "p2")!.meta).toEqual({ mode: "convert" });
    expect(plan.uploads.find((u) => u.id === "ready")!.meta).toEqual({ mode: "as_is" });
  });

  it("an item made from nothing goes back to «اصنعه لي», and the ready picture is kept but not used as a reference", () => {
    const plan = backToSheetPlan({ "ENV-01": "as_is" }, [asset("ready", "upload", "approved", { mode: "as_is", at_name: "@بيت_الغابة", was: "make" })], "ENV-01")!;
    expect(plan.choice).toBe("make");
    expect(plan.uploads).toEqual([{ id: "ready", meta: { mode: "as_is" } }]);
  });

  it("a picture given «كما هي» on the map from the start becomes the sheet's reference", () => {
    const plan = backToSheetPlan({ "ENV-01": "as_is" }, [asset("up", "upload", "approved", { mode: "as_is", at_name: "@بيت_الغابة" })], "ENV-01")!;
    expect(plan.choice).toBe("reference");
    expect(plan.uploads[0].meta).toEqual({ mode: "reference" });
  });

  it("changes nothing for an item that is not standing on the person's picture", () => {
    for (const c of ["make", "reference", "convert"] as MapChoice[]) expect(backToSheetPlan({ "ENV-01": c }, [asset("up", "upload", "uploaded")], "ENV-01")).toBeNull();
    expect(backToSheetPlan({}, [], "ENV-01")).toBeNull();
  });
});

describe("«الكلام يشتغل زي الزر»: the same choice written to the sheet maker", () => {
  it("the reply can name the items whose own picture the person asked for, and the rules say when", () => {
    expect(SHEET_MAKER_SCHEMA.required).toContain("own_picture_ids");
    expect(SHEET_MAKER_SCHEMA.properties.own_picture_ids).toEqual({ type: "array", items: { type: "string" } });
    expect(SHEET_APP_INTEGRATION).toContain('"own_picture_ids"');
    expect(SHEET_APP_INTEGRATION).toContain("MY OWN PICTURE AS IT IS, AT ANY TIME");
  });
});

describe("the sheet's card offers «صورتي كما هي» and the way back", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const { default: SheetCards } = await import("@/app/film/[id]/sheets/SheetCards");
  const card = (a: Record<string, unknown>) => ({ error: null, url: "https://x/p.png", created_at: "2026-11-01", version_id: null, meta: {}, ...a }) as never;
  const prompt = { id: "v1", kind: "sheet_prompt", ref_key: "ENV-01", version: 1, body: "", data: { prompt: "p" }, status: "approved", stale: false, created_at: "2026-11-01" } as never;
  const render = (o: { choices: Record<string, MapChoice>; assets: never[]; versions?: never[]; ownable?: boolean }) =>
    renderToStaticMarkup(createElement(SheetCards, { projectId: "p", items: [{ id: "ENV-01", title: "ENV-01 · بيت الغابة" }], versions: o.versions ?? [prompt], assets: o.assets, busy: false, send: () => {}, onEdit: () => {}, choices: o.choices, ownable: o.ownable ?? true }));

  it("a sheet made from the person's picture: «استخدم صورتي كما هي» beside its attempts", () => {
    const html = render({ choices: { "ENV-01": "reference" }, assets: [card({ id: "up", kind: "upload", ref_key: "ENV-01", status: "uploaded" }), card({ id: "s", kind: "image", ref_key: "ENV-01", status: "generated", version_id: "v1" })] });
    expect(html).toContain("استخدم صورتي كما هي (بدون شيت)");
    expect(html).toContain("ارفع غيرها");
    expect(html).toContain("اعتمد ✅");
  });

  it("a made sheet with no picture of the person's: only «ارفع صورة جاهزة»", () => {
    const html = render({ choices: {}, assets: [card({ id: "s", kind: "image", ref_key: "ENV-01", status: "generated", version_id: "v1" })] });
    expect(html).toContain("ارفع صورة جاهزة بدال الشيت");
    expect(html).not.toContain("استخدم صورتي كما هي");
  });

  it("standing on the person's picture: shown as theirs, with «اصنع لها شيت» and the sheets drawn before", () => {
    const html = render({ choices: { "ENV-01": "as_is" }, assets: [card({ id: "up", kind: "upload", ref_key: "ENV-01", status: "approved", meta: { at_name: "@بيت_الغابة" } }), card({ id: "s", kind: "image", ref_key: "ENV-01", status: "rejected", version_id: "v1" })] });
    expect(html).toContain("صورتك كما هي ✅");
    expect(html).toContain("اصنع لها شيت بدالها");
    expect(html).toContain("شيتات انرسمت لها قبل (1)");
    expect(html).toContain("@بيت_الغابة");
    // nothing to generate for it
    expect(html).not.toContain("ولّد");
  });

  it("an item standing on the person's picture from the map (never described) has its card too", () => {
    const html = render({ choices: { "ENV-01": "as_is" }, versions: [], assets: [card({ id: "up", kind: "upload", ref_key: "ENV-01", status: "approved" })] });
    expect(html).toContain("صورتك كما هي ✅");
  });

  it("before the map is approved nothing of this is offered", () => {
    const html = render({ choices: {}, ownable: false, assets: [card({ id: "s", kind: "image", ref_key: "ENV-01", status: "generated", version_id: "v1" })] });
    expect(html).not.toContain("ارفع صورة جاهزة");
  });
});
