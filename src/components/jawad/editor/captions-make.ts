// Captions made from the clips' own sound — the «كابشن» panel and «حيدرة» use the same steps: each clip's sound cut out
// and sent (only when the server can't read the file itself), written word by word (ElevenLabs Scribe), placed on the
// timeline; or a poem's verses timed on its recitation.

import type { Clip, Timeline } from "@/lib/editor/model";
import { postJson } from "@/lib/fetch";
import { putWithProgress } from "../studio/upload";
import { extractSound, onTimeline, phrases, verses, type CaptionItem, type SpokenWord } from "./captions";
import type { EditorAsset } from "./types";

export type CaptionSource = { clip: Clip; asset: EditorAsset };

/** The clips that can be heard (their sound is what gets written). */
export function captionSources(tl: Timeline, assets: Map<string, EditorAsset>): CaptionSource[] {
  return tl.tracks.flatMap((t) =>
    t.muted || t.kind === "text"
      ? []
      : t.clips.flatMap((c) => {
          const a = c.assetId ? assets.get(c.assetId) : null;
          return a && a.kind !== "image" && a.hasAudio && a.url && c.volume > 0 ? [{ clip: c, asset: a }] : [];
        }),
  );
}

/** A clip's sound, uploaded for one use: its path. */
async function uploadSound(projectId: string, s: CaptionSource, label: string, onStep: (t: string) => void) {
  onStep(`${label}: نجهّز الصوت…`);
  const { blob, format } = await extractSound(s.asset.url!, s.clip.in, s.clip.out, (p) => onStep(`${label}: نجهّز الصوت ${Math.round(p * 100)}٪`));
  const sign = await postJson<{ path: string; mime: string; signedUrl: string }>(`/api/jawad/editor/projects/${projectId}`, { action: "speech_sign", format });
  await putWithProgress(sign.signedUrl, new File([blob], `sound.${format}`, { type: sign.mime }), sign.mime, (p) => onStep(`${label}: نرفع الصوت ${Math.round(p * 100)}٪`));
  return sign.path;
}

/** What is said in the clips, as caption lines on the timeline (shorter lines in a tall video). */
export async function spokenCaptions(projectId: string, tl: Timeline, sources: CaptionSource[], lang: string, onStep: (t: string) => void): Promise<{ items: CaptionItem[]; words: number }> {
  const heard: SpokenWord[] = [];
  for (const [i, s] of sources.entries()) {
    const label = sources.length > 1 ? `المقطع ${i + 1} من ${sources.length}` : "المقطع";
    const ask = (path?: string) => postJson<{ words?: SpokenWord[]; need?: "audio" }>(`/api/jawad/editor/projects/${projectId}`, { action: "transcribe", assetId: s.asset.id, from: s.clip.in, to: s.clip.out, language: lang, path });
    onStep(`${label}: نسمع ونكتب…`);
    let r = await ask();
    if (r.need) {
      const path = await uploadSound(projectId, s, label, onStep);
      onStep(`${label}: نسمع ونكتب…`);
      r = await ask(path);
    }
    heard.push(...onTimeline(s.clip, r.words ?? []));
  }
  if (!heard.length) throw new Error("ما سمعنا كلامًا واضحًا في المقاطع المختارة.");
  return { items: phrases(heard, tl.height > tl.width ? 4 : 7), words: heard.length };
}

/** A poem's verses (one per line) timed on its recitation in a clip. */
export async function poemCaptions(projectId: string, s: CaptionSource, poem: string, onStep: (t: string) => void): Promise<CaptionItem[]> {
  const path = await uploadSound(projectId, s, "القصيدة", onStep);
  onStep("نطابق الأبيات على الإلقاء…");
  const r = await postJson<{ words: SpokenWord[] }>(`/api/jawad/editor/projects/${projectId}`, { action: "align", assetId: s.asset.id, from: s.clip.in, to: s.clip.out, text: poem.trim(), path });
  const timed = onTimeline(s.clip, r.words);
  const items = verses(poem, timed) ?? phrases(timed, 8);
  if (!items.length) throw new Error("ما قدرنا نطابق الأبيات؛ تأكد إنها نفس الكلام المقروء.");
  return items;
}
