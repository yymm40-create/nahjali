// «الطالب الذكي» · «🎨 محرر العرض»: what the editor asks of a designed deck — the deck with its pictures (short links),
// saving the person's edits (every slide sanitized again on the server), a new picture they add, and the PDF / PPTX
// made from the deck as it is now (free: no AI in it). Server only.

import { UserError } from "@/lib/api";
import { defaultDesign, type Design } from "@config/jawad/student";
import { getOutput, putFile, saveOutput, signFile, type Output } from "./db";
import type { SlidePlan } from "./model";
import { deckContent, deckFiles } from "./deck-make";
import { deckImages, readDeck } from "@/lib/slides/format";

const designOf = (o: Output): Design => (o.settings.design as Design) ?? defaultDesign("editorial");
const NOT_DECK = "هذا العرض ما انصمم بمصمم العروض.";

function mine(o: Output) {
  if (o.kind !== "slides" || o.settings.render !== "design" || !o.plan) throw new UserError(NOT_DECK, 400);
  const c = deckContent(o, o.plan as SlidePlan, designOf(o));
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
  const stale = ((o.content ?? {}) as { stale?: Record<string, boolean> }).stale ?? {};
  return { id: o.id, projectId: o.project_id, title: o.title, status: o.status, deck: c.deck, images, stale, files: Object.keys(o.files ?? {}) };
}

export async function deckAction(userId: string, id: string, b: Record<string, unknown>) {
  const o = await getOutput(userId, id);
  const c = mine(o);
  const content = (o.content ?? {}) as Record<string, unknown>;
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
      await saveOutput(o.id, { content: { ...content, deck, unchecked: [], manual: Boolean(content.manual) || changedOrder || slides.some((s) => s.edited), stale: { pdf: true, pptx: true } } });
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
      const r = await deckFiles(o, c.deck, undefined, kind);
      const path = kind === "pdf" ? r.pdfPath : r.pptxPath;
      const stale = { ...((content.stale as Record<string, boolean>) ?? {}), [kind]: false };
      const fresh = await getOutput(userId, id);
      await saveOutput(o.id, { files: { ...fresh.files, [kind]: path }, content: { ...((fresh.content ?? {}) as Record<string, unknown>), stale } });
      return { url: await signFile(path, 600, `${(o.title || "عرض").replace(/[\\/:*?"<>|]/g, "")}.${kind}`) };
    }
  }
  throw new UserError("طلب غير معروف.", 400);
}
