// The page's side of making things for the edit (hook pictures, music, split sound): ask the server, get back new
// library files. Placing them is src/lib/editor/make.ts.

import { postJson } from "@/lib/fetch";
import { soundFile } from "./audio";
import type { EditorAsset } from "./types";

const url = (projectId: string) => `/api/jawad/editor/projects/${projectId}`;

export const makeHookAsset = (projectId: string, text: string, style = "", designed: { prompt: string; background: "transparent" | "scene"; aspect: string } | null = null) =>
  postJson<{ asset: EditorAsset }>(url(projectId), { action: "make_hook", text, style, ...(designed ?? {}) }).then((r) => r.asset);
export const makeSfxAsset = (projectId: string, prompt: string, seconds: number, name: string) => postJson<{ asset: EditorAsset }>(url(projectId), { action: "make_sfx", prompt, seconds, name }).then((r) => r.asset);

export const makeMusicAsset = (projectId: string, prompt: string, lengthMs: number) => postJson<{ asset: EditorAsset }>(url(projectId), { action: "make_music", prompt, lengthMs }).then((r) => r.asset);

/** A clip's sound (its part of the file, full quality WAV) sent up and split into talking / music / effects. */
export async function separateAsset(projectId: string, a: EditorAsset, fromMs: number, toMs: number) {
  if (!a.url) throw new Error("الملف غير متاح.");
  const wav = await soundFile(a.url, fromMs, toMs);
  const s = await postJson<{ path: string; mime: string; signedUrl: string }>(url(projectId), { action: "speech_sign", format: "wav" });
  const put = await fetch(s.signedUrl, { method: "PUT", headers: { "content-type": s.mime, "x-upsert": "true" }, body: wav });
  if (!put.ok) throw new Error("ما قدرنا نرفع الصوت؛ جرّب مرة ثانية.");
  return postJson<{ assets: EditorAsset[]; full: boolean }>(url(projectId), { action: "separate", path: s.path, from: fromMs, to: toMs, name: a.name });
}
