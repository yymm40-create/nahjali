import { describe, expect, it } from "vitest";
import { applyOps, newDoc, readDoc } from "@/lib/photo/doc";
import { readImageLayer, readLayers } from "@/lib/designer/layers";

// «اللاير 1 داخل اللاير 2، ما تطلع من حدودها»: a clipping mask — the picture of a person shown only inside the frame
// under it. The flag lives on the layer in BOTH «زهراء» and «كاظم» (they share the layer model).
describe("a layer kept inside the layer under it", () => {
  const files = new Map([["frame", { w: 800, h: 1000 }], ["man", { w: 600, h: 900 }]]);

  it("is off by default, and read only from a real true", () => {
    expect(readImageLayer({ kind: "image", fileId: "a" })!.clip).toBe(false);
    for (const v of ["true", 1, "yes", {}, null]) expect(readImageLayer({ kind: "image", fileId: "a", clip: v })!.clip).toBe(false);
    expect(readImageLayer({ kind: "image", fileId: "a", clip: true })!.clip).toBe(true);
  });

  it("survives a project's save and read, on a picture and on a shape", () => {
    const made = applyOps(newDoc(1080, 1350), [
      { op: "add_shape", shape: "ellipse", x: 50, y: 40, w: 60, h: 40, fill: "#223344" },
      { op: "add_image", file: "man", x: 50, y: 40, w: 70 },
    ], { files, fonts: ["readex"] });
    expect(made.error).toBeNull();
    const [shape, picture] = made.doc.layers;
    const on = applyOps(made.doc, [{ op: "update", id: picture.id, patch: { clip: true } }, { op: "update", id: shape.id, patch: { clip: true } }], { files, fonts: ["readex"] });
    expect(on.error).toBeNull();
    expect(on.doc.layers.map((l) => (l.kind === "text" ? null : l.clip))).toEqual([true, true]);
    // through storage and back
    const back = readDoc(JSON.parse(JSON.stringify(on.doc)));
    expect(back.layers.map((l) => (l.kind === "text" ? null : l.clip))).toEqual([true, true]);
    // and it can be switched off again
    const off = applyOps(on.doc, [{ op: "update", id: picture.id, patch: { clip: false } }], { files, fonts: ["readex"] });
    expect(off.doc.layers[1].kind === "image" && off.doc.layers[1].clip).toBe(false);
  });

  it("كاظم's layers carry it too, and his order puts the pictures under the words", () => {
    const layers = readLayers([
      { kind: "image", fileId: "frame", x: 50, y: 50, w: 100 },
      { kind: "image", fileId: "man", x: 50, y: 45, w: 60, clip: true },
      { kind: "text", text: "دعوة", font: "readex" },
    ]);
    expect(layers.map((l) => l.kind)).toEqual(["image", "image", "text"]);
    expect(layers[0].kind === "image" && layers[0].clip).toBe(false);
    expect(layers[1].kind === "image" && layers[1].clip).toBe(true);
  });
});
