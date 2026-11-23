"use client";

import { api, postJson } from "@/lib/fetch";
import { sheetOf } from "@/components/jawad/content/media-prep";

/**
 * «🔗 رابط يوتيوب»: the video of a link, downloaded (/api/film/youtube) and laid out as one timed sheet of frames for
 * «سجاد» to look at — the person's upload id of that sheet, or null when only its words can be heard (no download, or
 * the day's limit). `onStep` says what is happening.
 */
export async function prepareLinkFrames(url: string, onStep: (s: string) => void): Promise<string | null> {
  try {
    const start = await postJson<{ enabled: boolean; key?: string }>("/api/film/youtube", { url });
    if (!start.enabled || !start.key) return null;
    onStep("⬇️ أنزّل الفيديو من يوتيوب…");
    const until = Date.now() + 16 * 60_000;
    for (;;) {
      const s = await api<{ state: string; files?: { kind: string; name: string; url: string | null }[] }>(`/api/film/youtube?key=${encodeURIComponent(start.key)}`);
      if (s.state === "failed") return null;
      if (s.state === "ready") {
        const video = (s.files ?? []).find((f) => f.kind === "video");
        if (!video?.url) return null;
        onStep("🎞️ أطلّع صور الفيديو…");
        return (await sheetOf(video.url, video.name))?.id ?? null;
      }
      if (Date.now() > until) return null;
      await new Promise((r) => setTimeout(r, 4000));
    }
  } catch {
    /* the download is not available: سجاد still hears the video's words through the link */
    return null;
  }
}
