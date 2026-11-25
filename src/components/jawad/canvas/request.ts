// «اللوحة»: what one generator node sends to the studio's ordinary /api/jawad/generate — its generator and settings,
// the words its text wires bring, the pictures (or clips) its wires bring as references or first/last frames, and its
// style / «ذوقي» / «هويتي». For the price before a run, a result not made yet is estimated from its generator's settings
// (config/jawad/canvas.ts → expectedMedia); the real run sends only real, checked files.

import { defaultSettings, generatorById } from "@config/jawad/generators";
import { expectedMedia, inputsOf, isFresh, NODE_KINDS, promptOf, signatures, type CanvasGraph, type CanvasNode } from "@config/jawad/canvas";
import type { GeneratorDef, RefKind, RefMeta, RefRole, RefStyle, Settings } from "@config/jawad/types";
import type { OutputView } from "@/lib/jawad/labels";
import type { RefItem, UploadView } from "../studio/types";

export interface NodeRef {
  meta: RefMeta;
  /** the person's checked upload it is (null: still to make or copy) */
  uploadId: string | null;
  /** the node it comes from */
  from: string;
  /** a guess of a result not made yet */
  estimated: boolean;
}

export interface NodeRequest {
  def: GeneratorDef;
  settings: Settings;
  refStyle: RefStyle;
  refs: NodeRef[];
  prompt: string;
  styleId?: string;
  tasteId?: string;
  brand?: true | { logo: true };
}

export interface MediaBook {
  uploads: Record<string, UploadView>;
  outputs: Record<string, OutputView>;
}

const settingsOf = (def: GeneratorDef, n: CanvasNode): Settings => ({ ...defaultSettings(def), ...(n.data.settings ?? {}) });

const metaOfUpload = (u: UploadView, role: RefRole): RefMeta => ({ id: u.id, kind: u.kind, role, mime: u.mime, bytes: u.bytes, width: u.width, height: u.height, durationMs: u.durationMs, fps: u.fps, status: u.status });

/** One input picture/clip of a node, as the rules see it. */
function refOf(g: CanvasGraph, sigs: Record<string, string>, src: CanvasNode, role: RefRole, book: MediaBook, estimate: boolean): NodeRef | string {
  if (src.kind === "upload") {
    const u = src.data.uploadId ? book.uploads[src.data.uploadId] : undefined;
    if (!u) return src.data.uploadId ? "الصورة المرفوعة ما وصلت بعد." : "اختر صورة في «صورة مرفوعة».";
    return { meta: metaOfUpload(u, role), uploadId: u.id, from: src.id, estimated: false };
  }
  const run = g.runs[src.id];
  if (run && isFresh(g, sigs, src.id)) {
    const copy = run.uploadId ? book.uploads[run.uploadId] : undefined;
    if (copy) return { meta: metaOfUpload(copy, role), uploadId: copy.id, from: src.id, estimated: false };
    const o = book.outputs[run.outputId];
    if (!estimate) return "نتيجة العقدة قبلها لازم تتجهّز كمرجع أولًا.";
    const exp = expectedMedia(run.kind, {});
    return { meta: { id: `out-${run.outputId}`, kind: run.kind, role, mime: o?.mime ?? exp.mime, bytes: exp.bytes, width: o?.width ?? exp.width, height: o?.height ?? exp.height, durationMs: o?.durationMs ?? exp.durationMs, fps: exp.fps, status: "ready" }, uploadId: null, from: src.id, estimated: true };
  }
  if (!estimate) return "العقدة قبلها ما خلصت بعد.";
  const sdef = src.data.generatorId ? generatorById(src.data.generatorId) : undefined;
  const kind: RefKind = (NODE_KINDS[src.kind].output as RefKind | null) ?? "image";
  const exp = expectedMedia(kind, sdef ? settingsOf(sdef, src) : {});
  return { meta: { id: `est-${src.id}`, kind, role, ...exp, status: "ready" }, uploadId: null, from: src.id, estimated: true };
}

/** What a generator node sends (or why it can't yet). `estimate`: results not made yet are guessed (for the price only). */
export function nodeRequest(g: CanvasGraph, nodeId: string, book: MediaBook, estimate: boolean): NodeRequest | { problem: string } {
  const n = g.nodes.find((x) => x.id === nodeId);
  if (!n || !NODE_KINDS[n.kind].runs) return { problem: "هذي العقدة ما تولّد شي." };
  const def = n.data.generatorId ? generatorById(n.data.generatorId) : undefined;
  if (!def) return { problem: "اختر المولّد." };
  const sigs = signatures(g);
  const ins = inputsOf(g, nodeId);
  const settings = settingsOf(def, n);
  const refs: NodeRef[] = [];
  const add = (src: CanvasNode, role: RefRole): string | null => {
    const r = refOf(g, sigs, src, role, book, estimate);
    if (typeof r === "string") return r;
    refs.push(r);
    return null;
  };
  let refStyle: RefStyle = "none";
  if (n.kind === "image") {
    for (const s of ins.refs ?? []) {
      const why = add(s, "reference");
      if (why) return { problem: why };
    }
    refStyle = refs.length ? "references" : "none";
  } else if (n.kind === "video") {
    const pics = ins.images ?? [];
    const clips = ins.clips ?? [];
    const asFrames = n.data.imageAs !== "reference" && !clips.length;
    if (asFrames && pics.length > 2) return { problem: "أول لقطة وآخر لقطة: صورتين بالكثير. خلّها «مراجع» أو شيل سلك." };
    for (const [i, s] of pics.entries()) {
      const why = add(s, asFrames ? (i === 0 ? "first_frame" : "last_frame") : "reference");
      if (why) return { problem: why };
    }
    for (const s of clips) {
      const why = add(s, "reference");
      if (why) return { problem: why };
    }
    refStyle = refs.length ? (asFrames ? "frames" : "references") : "none";
  } else if (n.kind === "tool") {
    const pic = ins.image?.[0];
    if (!pic) return { problem: "وصّل «الصورة»." };
    const why = add(pic, "reference");
    if (why) return { problem: why };
    refStyle = "references";
  }
  const req: NodeRequest = { def, settings, refStyle, refs, prompt: def.prompt.max === 0 ? "" : promptOf(g, nodeId) };
  const style = ins.style?.[0];
  if (style && def.output !== "audio") {
    if (style.data.styleId) req.styleId = style.data.styleId;
    else if (style.data.tasteId) req.tasteId = style.data.tasteId;
  }
  const brand = ins.brand?.[0];
  if (brand && def.output !== "audio") req.brand = brand.data.logo ? { logo: true } : true;
  return req;
}

/** A reference as the studio's «ذوقي/هويتي» helper reads it (lookRefItems). */
export const asRefItem = (r: NodeRef): RefItem => ({
  localId: r.meta.id,
  uploadId: r.uploadId,
  kind: r.meta.kind,
  name: r.meta.name ?? "",
  role: r.meta.role,
  fileName: "",
  status: "ready",
  progress: 1,
  error: null,
  url: null,
  mime: r.meta.mime,
  bytes: r.meta.bytes,
  width: r.meta.width ?? null,
  height: r.meta.height ?? null,
  durationMs: r.meta.durationMs ?? null,
  fps: r.meta.fps ?? null,
});
