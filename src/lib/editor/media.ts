// «الممنتج الذكي» — what a media file really is, from its first bytes (never its name). Pure: the browser uses it
// before uploading, the server again on the stored file. Wider than JAWAD AI's references: WebM, M4A, OGG, FLAC, AAC.

import { sniff } from "@/lib/jawad/media";
import type { AssetKind } from "./model";

export interface EditorSniff {
  /** the container; a WebM or MP4 may hold only sound, so the kind is settled with the decoder's answer */
  container: "mp4" | "mov" | "webm" | "png" | "jpeg" | "webp" | "mp3" | "wav" | "m4a" | "ogg" | "flac" | "aac";
  kinds: AssetKind[];
}

const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len));

export function editorSniff(b: Uint8Array): EditorSniff | null {
  if (b.length < 12) return null;
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { container: "webm", kinds: ["video", "audio"] };
  if (ascii(b, 0, 4) === "OggS") return { container: "ogg", kinds: ["audio"] };
  if (ascii(b, 0, 4) === "fLaC") return { container: "flac", kinds: ["audio"] };
  if (ascii(b, 4, 4) === "ftyp" && /^(M4A |M4B |M4P |F4A )$/.test(ascii(b, 8, 4))) return { container: "m4a", kinds: ["audio"] };
  // ADTS AAC (layer bits 00, which the MP3 check below rules out)
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return { container: "aac", kinds: ["audio"] };
  const s = sniff(b);
  if (!s) return null;
  switch (s.mime) {
    case "video/mp4":
      return { container: "mp4", kinds: ["video", "audio"] };
    case "video/quicktime":
      return { container: "mov", kinds: ["video"] };
    case "image/png":
      return { container: "png", kinds: ["image"] };
    case "image/jpeg":
      return { container: "jpeg", kinds: ["image"] };
    case "image/webp":
      return { container: "webp", kinds: ["image"] };
    case "audio/mpeg":
      return { container: "mp3", kinds: ["audio"] };
    case "audio/wav":
      return { container: "wav", kinds: ["audio"] };
  }
  return null;
}

/** The type we store a file with (the bucket's list) and its extension. */
export function storedType(container: EditorSniff["container"], kind: AssetKind): { mime: string; ext: string } {
  switch (container) {
    case "mp4":
      return kind === "audio" ? { mime: "audio/mp4", ext: "m4a" } : { mime: "video/mp4", ext: "mp4" };
    case "webm":
      return kind === "audio" ? { mime: "audio/webm", ext: "webm" } : { mime: "video/webm", ext: "webm" };
    case "mov":
      return { mime: "video/quicktime", ext: "mov" };
    case "png":
      return { mime: "image/png", ext: "png" };
    case "jpeg":
      return { mime: "image/jpeg", ext: "jpg" };
    case "webp":
      return { mime: "image/webp", ext: "webp" };
    case "mp3":
      return { mime: "audio/mpeg", ext: "mp3" };
    case "wav":
      return { mime: "audio/wav", ext: "wav" };
    case "m4a":
      return { mime: "audio/mp4", ext: "m4a" };
    case "ogg":
      return { mime: "audio/ogg", ext: "ogg" };
    case "flac":
      return { mime: "audio/flac", ext: "flac" };
    case "aac":
      return { mime: "audio/aac", ext: "aac" };
  }
}

/** Every type the editor's bucket takes (the same list as migration 0030). */
export const EDITOR_MIMES = new Set([
  "video/mp4", "video/quicktime", "video/webm",
  "audio/mpeg", "audio/wav", "audio/aac", "audio/mp4", "audio/ogg", "audio/webm", "audio/flac",
  "image/png", "image/jpeg", "image/webp",
]);

export const KIND_AR: Record<AssetKind, string> = { video: "فيديو", audio: "صوت", image: "صورة" };
