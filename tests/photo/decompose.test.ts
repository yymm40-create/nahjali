import { describe, expect, it } from "vitest";
import { MAX_PIECES, pieceOps, readPieces } from "@/lib/photo/decompose";
import { applyOps, newDoc } from "@/lib/photo/doc";

// «أقدر أفرّغ العناصر الموجودة فيها»: the reading of a flat picture, checked — and what each piece becomes on the
// canvas (words a REAL text layer, a picture its own cut-out layer).
const piece = (o: Partial<Record<string, unknown>> = {}) => ({ kind: "picture", name: "صورة", what: "the red car", x: 50, y: 40, w: 30, h: 20, ...o });

describe("reading a flat picture's pieces", () => {
  it("keeps what can be lifted out and drops what cannot", () => {
    const pieces = readPieces({
      pieces: [
        piece(),
        piece({ kind: "text", what: "", text: "عنوان كبير", color: "#ff0000", align: "center" }),
        piece({ kind: "text", what: "", text: "" }), // words with no words
        piece({ what: "" }), // a picture with nothing to find
      ],
    });
    expect(pieces.map((p) => p.kind)).toEqual(["picture", "text"]);
    expect(pieces.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(pieces[1].text).toBe("عنوان كبير");
    expect(pieces[1].color).toBe("#FF0000");
    expect(pieces[1].align).toBe("center");
  });

  it("brings every box onto the picture, whatever it was given", () => {
    const [p] = readPieces({ pieces: [piece({ x: -40, y: 900, w: 0, h: 1e6 })] });
    expect(p.box.x).toBe(0);
    expect(p.box.y).toBe(100);
    expect(p.box.w).toBe(1);
    expect(p.box.h).toBe(100);
  });

  it("reads nothing out of nothing, and never more than the limit", () => {
    expect(readPieces(null)).toEqual([]);
    expect(readPieces({ pieces: "no" })).toEqual([]);
    expect(readPieces({ pieces: Array.from({ length: 40 }, () => piece()) }).length).toBe(MAX_PIECES);
  });

  it("refuses a colour that is not a colour, and keeps the words' line breaks", () => {
    const [p] = readPieces({ pieces: [piece({ kind: "text", what: "", text: "سطر\nسطر ثاني", color: "red" })] });
    expect(p.color).toBeUndefined();
    expect(p.text).toBe("سطر\nسطر ثاني");
  });
});

describe("what a piece becomes on the canvas", () => {
  const doc = () => newDoc(1080, 1080);

  it("words become a real text layer at their place, in the site's font", () => {
    const [p] = readPieces({ pieces: [piece({ kind: "text", what: "", text: "سطر\nسطر", color: "#112233", x: 30, y: 70, w: 40, h: 16 })] });
    const ops = pieceOps(p, null, "readex");
    const out = applyOps(doc(), ops, { files: new Map(), fonts: ["readex"] });
    expect(out.error).toBeNull();
    const layer = out.doc.layers[0];
    expect(layer.kind).toBe("text");
    if (layer.kind !== "text") return;
    expect(layer.text).toBe("سطر\nسطر");
    expect(layer.color).toBe("#112233");
    expect(layer.x).toBe(30);
    expect(layer.y).toBe(70);
    // two lines, so each line is about half the block's height
    expect(layer.size).toBeGreaterThan(5);
    expect(layer.size).toBeLessThan(8);
  });

  it("a picture becomes its own layer, and nothing at all without its file", () => {
    const [p] = readPieces({ pieces: [piece({ x: 20, y: 25, w: 36, h: 30 })] });
    expect(pieceOps(p, null, "readex")).toEqual([]);
    const out = applyOps(doc(), pieceOps(p, "f1", "readex"), { files: new Map([["f1", { w: 400, h: 300 }]]), fonts: ["readex"] });
    expect(out.error).toBeNull();
    const layer = out.doc.layers[0];
    expect(layer.kind).toBe("image");
    expect(layer.x).toBe(20);
    expect(layer.y).toBe(25);
    if (layer.kind === "image") expect(layer.w).toBe(36);
  });

  it("every piece of a whole reading lands on the canvas, in order", () => {
    const pieces = readPieces({
      pieces: [
        piece({ name: "الخلفية", what: "the gradient card" }),
        piece({ kind: "text", what: "", text: "العنوان", x: 50, y: 20, w: 80, h: 12 }),
        piece({ kind: "logo", name: "الشعار", what: "the gold logo", x: 85, y: 90, w: 14, h: 10 }),
      ],
    });
    const files = new Map([["a", { w: 500, h: 500 }], ["b", { w: 200, h: 200 }]]);
    const ops = [...pieceOps(pieces[0], "a", "readex"), ...pieceOps(pieces[1], null, "readex"), ...pieceOps(pieces[2], "b", "readex")];
    const out = applyOps(doc(), ops, { files, fonts: ["readex"] });
    expect(out.error).toBeNull();
    expect(out.doc.layers.map((l) => l.kind)).toEqual(["image", "text", "image"]);
  });
});
