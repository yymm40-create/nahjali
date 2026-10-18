// «الطالب الذكي» · «🎨 محرر العرض»: what the editor asks of a designed deck — the deck with its pictures (short links),
// saving the person's edits (every slide sanitized again on the server), a new picture they add, and the PDF / PPTX
// made from the deck as it is now (free: no AI in it). Server only.

import { UserError } from "@/lib/api";
import { defaultDesign, type Design } from "@config/jawad/student";
import { getOutput, putFile, saveOutput, signFile, type Output } from "./db";
import { deckContent, deckFiles, maxFiles, slotOf, slotPatch } from "./deck-make";
import { maxSourceFor } from "./max-sources";
import { isMax } from "./max-make";
import { deckImages, readDeck } from "@/lib/slides/format";

const designOf = (o: Output): Design => (o.settings.design as Design) ?? defaultDesign("editorial");
const NOT_DECK = "هذا الناتج ما انصمم بحيدرا ماكس.";

function mine(o: Output) {
  const src = isMax(o) ? maxSourceFor(o) : null;
  if (!src) throw new UserError(NOT_DECK, 400);
  const c = deckContent(o, src, designOf(o));
  if (!c.deck.slides.length) throw new UserError("العرض لسا ما انصمم.", 409);
  return c;
}

/** The deck as the editor shows it: its slides, and a short link for every picture. */
export async function deckView(userId: string, id: string) {
  const o = await getOutput(userId, id);
  const c = mine(o);
  const images: Record<string, string> = {};
  for (const p of deckImages(c.deck)) {
    try {
      images[p] = await signFile(p, 3600);
    } catch {}
  }
  const stale = ((slotOf(o) as { stale?: Record<string, boolean> }).stale) ?? {};
  return { id: o.id, projectId: o.project_id, title: o.title, status: o.status, deck: c.deck, images, stale, files: Object.keys(o.files ?? {}) };
}

export async function deckAction(userId: string, id: string, b: Record<string, unknown>) {
  const o = await getOutput(userId, id);
  const c = mine(o);
  const content = slotOf(o) as Record<string, unknown>;
  switch (b.action) {
    case "deck_get":
      return deckView(userId, id);
    case "deck_save": {
      if (!["review", "done"].includes(o.status)) throw new UserError("العرض يتصنع الحين؛ انتظر يخلص وبعدين احفظ تعديلاتك.", 409);
      const sent = readDeck(b.deck);
      if (!sent || !sent.slides.length) throw new UserError("ما وصلنا العرض.", 400);
      // the server keeps the deck's size and fonts; a slide changed by hand is marked (its map no longer redesigns it)
      const before = new Map(c.deck.slides.map((s, i) => [s.id, { s, i }]));
      const slides = sent.slides.map((s, i) => {
        const was = before.get(s.id);
        const same = was && was.s.html === s.html && was.s.notes === s.notes && was.i === i;
        return { ...s, sig: was?.s.sig, ...(same && !was.s.edited ? {} : { edited: true }) };
      });
      const deck = { ...c.deck, title: sent.title || c.deck.title, slides };
      const changedOrder = slides.length !== c.deck.slides.length || slides.some((s, i) => c.deck.slides[i]?.id !== s.id);
      await saveOutput(o.id, { content: slotPatch(o, { deck, unchecked: [], manual: Boolean(content.manual) || changedOrder || slides.some((s) => s.edited), stale: { pdf: true, pptx: true } }) });
      return { ok: true };
    }
    case "deck_image": {
      // a picture the person adds (already made small in the browser): kept with the output
      const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.data ?? ""));
      if (!m) throw new UserError("الصورة لازم تكون PNG أو JPG أو WebP.", 400);
      const buf = Buffer.from(m[2], "base64");
      if (buf.length > 4_000_000) throw new UserError("الصورة كبيرة (الحد ٤ ميجا).", 400);
      const ext = m[1] === "jpeg" ? "jpg" : m[1];
      const path = `${o.user_id}/${o.project_id}/out/${o.id}/img-${Date.now()}.${ext}`;
      await putFile(path, buf, `image/${m[1]}`);
      return { token: `img:${path}`, path, url: await signFile(path, 3600) };
    }
    case "deck_export": {
      const kind = b.kind === "pptx" ? "pptx" : "pdf";
      const name = (o.title || "عرض").replace(/[\\/:*?"<>|]/g, "");
      if (o.kind !== "slides") {
        // a printed output: its files again, from the deck as it is now (a PPTX is only for slides)
        const made = await maxFiles(o, c.deck);
        const fresh = await getOutput(userId, id);
        await saveOutput(o.id, { files: { ...fresh.files, ...made }, content: slotPatch(fresh, { stale: { pdf: false, pptx: false } }) });
        const key = String(b.file ?? "") in made ? String(b.file) : (made.pdf ? "pdf" : Object.keys(made)[0]);
        return { url: await signFile(made[key], 600, `${name}.${made[key].endsWith(".png") ? "png" : "pdf"}`) };
      }
      const r = await deckFiles(o, c.deck, undefined, kind);
      const path = kind === "pdf" ? r.pdfPath : r.pptxPath;
      const fresh = await getOutput(userId, id);
      const stale = { ...(((slotOf(fresh) as { stale?: Record<string, boolean> }).stale) ?? {}), [kind]: false };
      await saveOutput(o.id, { files: { ...fresh.files, [kind]: path }, content: slotPatch(fresh, { stale }) });
      return { url: await signFile(path, 600, `${name}.${kind}`) };
    }
  }
  throw new UserError("طلب غير معروف.", 400);
}
