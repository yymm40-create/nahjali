// «حيدرة كت» — what is worth decoding. A timeline of many cameras stacked on one another (a poem shot 32 times) shows
// ONE of them at a time: the top clip fills the frame and everything under it is never seen. The preview used to
// decode every one of them anyway — thirty videos playing at once is what made the editor freeze. This says, without
// guessing, when a clip hides all that is under it, so only what is seen is decoded and drawn.
// Pure, and careful: anything that could let the layer under show through (a smaller or moved picture, opacity, a
// blend, a crop, a key, a cut-out, an effect, an entrance, a transparent file) means "does not cover".

import type { Clip, Track } from "./model";

/** What is known of a clip's file. */
export interface CoverAsset {
  kind: "video" | "audio" | "image";
  width?: number | null;
  height?: number | null;
  name?: string;
}

/** Files that may carry transparency (a picture; a WebM made with alpha). */
const MAY_BE_CLEAR = /\.(webm|png|gif|webp|avif|svg)$/i;

/** True when this clip, drawn plain (no transition running), fills the whole frame with an opaque picture. */
export function coversFrame(frame: { width: number; height: number }, clip: Clip, asset: CoverAsset | undefined): boolean {
  if (!asset || asset.kind !== "video" || !asset.width || !asset.height) return false;
  if (MAY_BE_CLEAR.test(asset.name ?? "")) return false;
  if (clip.text || clip.motion || clip.seq || clip.anim || clip.crop || clip.key || clip.bg) return false;
  if (clip.keys.length || clip.fx.length || clip.shape !== "rect" || (clip.blend && clip.blend !== "normal")) return false;
  const t = clip.transform;
  if (t.opacity < 1 || t.rotate !== 0 || t.x !== 0.5 || t.y !== 0.5 || t.scale < 1) return false;
  // «cover» fills the frame; «contain» does only when the picture has the frame's own shape
  return clip.fit === "cover" || Math.abs(asset.width / asset.height - frame.width / frame.height) < 0.002;
}

/**
 * «S» and «H» on the tracks, worked out into what plays. «H» (off): the track is not there for now — not seen, not
 * heard. «S» (solo) on picture tracks: only the soloed ones are seen; on sound tracks: only the soloed ones are
 * heard (the sound of every other track goes quiet, the pictures' own sound too). Pictures and sound are soloed apart:
 * a soloed camera does not silence the poem. Returns the same list when nothing is soloed or off.
 */
export function liveTracks(tracks: Track[]): Track[] {
  const soloPicture = tracks.some((t) => t.kind === "video" && t.solo && !t.off);
  const soloSound = tracks.some((t) => t.kind === "audio" && t.solo && !t.off);
  if (!soloPicture && !soloSound && !tracks.some((t) => t.off)) return tracks;
  return tracks.map((t) => {
    const hidden = t.hidden || !!t.off || (soloPicture && t.kind === "video" && !t.solo);
    const muted = t.muted || !!t.off || (soloSound && !(t.kind === "audio" && t.solo));
    return hidden === t.hidden && muted === t.muted ? t : { ...t, hidden, muted };
  });
}
