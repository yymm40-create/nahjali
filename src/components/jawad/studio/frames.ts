/**
 * Frames of a video at given times, as JPEG data URLs, taken in the browser. `size` limits the width (or, with
 * `by: "side"`, the longest side); null keeps the video's own size. `onFrame` reports how many are done.
 */
export async function grabFrames(url: string, times: number[], size: number | null, quality: number, o: { by?: "width" | "side"; onFrame?: (done: number) => void } = {}) {
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  await new Promise<void>((res, rej) => {
    v.onloadeddata = () => res();
    v.onerror = () => rej(new Error("load"));
  });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const out: string[] = [];
  for (const t of times) {
    await new Promise<void>((res, rej) => {
      v.onseeked = () => res();
      v.onerror = () => rej(new Error("seek"));
      v.currentTime = Math.max(0, Math.min(t, v.duration - 0.04));
    });
    const scale = size ? Math.min(1, size / (o.by === "side" ? Math.max(v.videoWidth, v.videoHeight) : v.videoWidth)) : 1;
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    out.push(canvas.toDataURL("image/jpeg", quality));
    o.onFrame?.(out.length);
  }
  v.removeAttribute("src");
  v.load();
  return out;
}
