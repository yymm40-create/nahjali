import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireContentUser } from "@/lib/content/access";
import { producedLinks } from "@/lib/content/files";
import { contentSpent } from "@/lib/content/spent";
import { codeSlideFailed, produce, produceFromCode, saveSlideProgram } from "@/lib/content/produce";
import { isAdmin } from "@config/site";
import { sfxLibrary } from "@/lib/editor/sfx-library";
import { CUE_SFX } from "@/lib/editor/scene/skill";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * «صانع المحتوى» · the produce step: draws the next slides of the carousel «محمد باقر» ordered (GPT Image 2), a few at
 * a time — the page calls it again while `running`. `retry` (slide numbers, or "failed") draws those slides again.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireContentUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; retry?: unknown; n?: unknown; png?: unknown; pngUpload?: unknown; rounds?: unknown; scores?: unknown; video?: unknown; codeFailed?: unknown; stage?: unknown; program?: unknown; fonts?: unknown; approvePictures?: unknown; redoPicture?: unknown; note?: unknown; deferSlide?: unknown; exclude?: unknown; saveProgram?: { n?: unknown; code?: unknown; fonts?: unknown; size?: unknown }; soundTime?: unknown };
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  if (!chatId) throw new UserError("محادثة غير صحيحة.", 400);
  const retry = b.retry === "failed" ? ("failed" as const) : Array.isArray(b.retry) ? b.retry.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 40).slice(0, 40) : undefined;
  // «⏱️ وقت الصوت»: the person types the time of a slide's sound («من ٠:١٢ إلى ٠:٢٠»)
  const st = b.soundTime && typeof b.soundTime === "object" ? (b.soundTime as { n?: unknown; from?: unknown; to?: unknown }) : null;
  const soundTime = st && Number.isInteger(Number(st.n)) && Number(st.from) >= 0 && Number(st.to) > Number(st.from) && Number(st.to) - Number(st.from) <= 60 ? { n: Number(st.n), from: Number(st.from), to: Number(st.to) } : undefined;
  try {
    // a motion slide's program that runs, kept (a refresh of the page goes on from it)
    if (b.saveProgram && typeof b.saveProgram === "object") return NextResponse.json(await saveSlideProgram(user.id, chatId, b.saveProgram));
    // «Claude Code»: the page draws a slide itself and sends the picture back (otherwise the answer may carry the next slide's brief)
    const r = typeof b.codeFailed === "string" ? await codeSlideFailed(user.id, chatId, b) : typeof b.png === "string" || typeof b.pngUpload === "string" ? await produceFromCode(user.id, chatId, b) : await produce(user.id, chatId, { ...(soundTime ? { soundTime } : {}), retry, owner: isAdmin(user.email), email: user.email, origin: new URL(req.url).origin, approvePictures: b.approvePictures === true, ...(Array.isArray(b.exclude) ? { exclude: b.exclude.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 10) } : {}), ...(Number.isInteger(Number(b.deferSlide)) && Number(b.deferSlide) > 0 ? { deferSlide: Number(b.deferSlide) } : {}), ...(Number.isInteger(Number(b.redoPicture)) && Number(b.redoPicture) > 0 ? { redoPicture: { n: Number(b.redoPicture), note: typeof b.note === "string" ? b.note : "" } } : {}) });
    const [links, downloads, spent] = await Promise.all([producedLinks(user.id, chatId), producedLinks(user.id, chatId, true), contentSpent(user.id, chatId)]);
    // a motion slide to make: the library's sound effects (their links), for the cues of his scene
    const sfx = r.code?.motion ? Object.fromEntries((await sfxLibrary().catch(() => ({ items: [] as { id: string; url: string | null }[] }))).items.filter((i) => i.url && CUE_SFX.includes(i.id)).map((i) => [i.id, i.url!])) : undefined;
    return NextResponse.json({
      ...r,
      // «أُخذ منك في هذي المحادثة»: the whole conversation now (باقر's replies, the pictures, «حيدرا ماكس»'s code)
      ...(spent !== null ? { spent } : {}),
      ...(r.code && sfx ? { code: { ...r.code, sfx } } : {}),
      slides: r.slides.map((s) => ({ ...s, url: links.get(s.fileId) ?? null, download: downloads.get(s.fileId) ?? null, ...(s.video ? { videoUrl: links.get(s.video) ?? null, videoDownload: downloads.get(s.video) ?? null } : {}) })),
      failed: r.failed.map(({ n, reason, detail, text }) => ({ n, reason, detail, text })),
    });
  } catch (e) {
    if (e instanceof UserError) throw e;
    if (e instanceof Error && e.message === "chat not found") throw new UserError("ما لقينا هذي المحادثة.", 404);
    console.error("content produce", e);
    throw new UserError("ما قدرنا ننتج الشرائح الحين؛ جرّب مرة ثانية.", 502);
  }
});
