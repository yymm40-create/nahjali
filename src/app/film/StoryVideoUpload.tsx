"use client";

import { useState } from "react";
import { probeFile, putWithProgress } from "@/components/jawad/studio/upload";
import { frameSheet, putImage } from "@/components/jawad/content/media-prep";
import type { StoryVideo } from "@/lib/film/story-link";

/**
 * «📤 ارفع فيديو» (a new film's story given as a video from the device): the video goes up as the person's own upload
 * (with progress), and its frames are laid out as one timed picture from the file itself (no second download) and put
 * up too — «سجاد» looks at that picture and hears the video's words (lib/film/intake) before he builds on it.
 */
export default function StoryVideoUpload({ video, onVideo, lesson }: { video: StoryVideo | null; onVideo: (v: StoryVideo | null) => void; lesson?: boolean }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function choose(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const probe = await probeFile(file, "video");
      setBusy("⬆️ أرفع الفيديو… 0٪");
      const post = async <T,>(url: string, data: unknown) => {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as T & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "تعذّر رفع الفيديو.");
        return body;
      };
      const signed = await post<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: "video", mime: probe.mime, bytes: file.size, fileName: file.name });
      await putWithProgress(signed.signedUrl, file, probe.mime, (p) => setBusy(`⬆️ أرفع الفيديو… ${Math.round(p * 100)}٪`));
      setBusy("🔎 أفحص الفيديو…");
      const conf = await post<{ upload: { id: string; status: string; error: string | null } }>("/api/jawad/uploads/confirm", { id: signed.id });
      if (conf.upload?.status !== "ready") throw new Error(conf.upload?.error ?? "تعذّر فحص الفيديو.");
      // its frames, from the file on the device (a sheet that can't be made: سجاد still hears its words)
      setBusy("🎞️ أطلّع صور الفيديو…");
      let sheetId: string | null = null;
      const local = URL.createObjectURL(file);
      try {
        sheetId = (await putImage(await frameSheet(local), `لقطات من ${file.name.replace(/\.[a-z0-9]+$/i, "")}.jpg`.slice(0, 190))).id;
      } catch {
        sheetId = null;
      } finally {
        URL.revokeObjectURL(local);
      }
      onVideo({ name: file.name, videoId: conf.upload.id, sheetId });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-2">
      {video ? (
        <div className="flex items-center gap-2 rounded-2xl border-2 border-[var(--film-blue)] bg-[var(--film-blue)]/10 p-3">
          <span className="text-2xl" aria-hidden>🎬</span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm" dir="auto">{video.name}</b>
            <small className="text-xs font-bold text-muted">{video.sheetId ? "✓ انرفع، وصوره جاهزة لسجاد" : "✓ انرفع (سجاد بيسمع كلامه، وصوره ما انقرت في متصفحك)"}</small>
          </span>
          <button type="button" className="btn text-xs" onClick={() => onVideo(null)} disabled={!!busy}>غيّره</button>
        </div>
      ) : (
        <label className={`block cursor-pointer rounded-2xl border-2 border-dashed border-line p-5 text-center ${busy ? "opacity-70" : ""}`}>
          <input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" className="sr-only" disabled={!!busy} onChange={(e) => void choose(e.target.files?.[0])} />
          <span className="block text-3xl" aria-hidden>📤</span>
          <b className="block text-sm">{busy || "اختر فيديو من جهازك"}</b>
          {!busy && <small className="text-xs font-bold text-muted">MP4 أو MOV، لين ٢٠٠ ميجا</small>}
        </label>
      )}
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      <p className="text-xs leading-6 text-muted">سجاد يشوف صور الفيديو ويسمع كلامه، ويقول لك وش فهم منه قبل ما يبني عليه {lesson ? "الدرس" : "فيلمك"}.</p>
    </div>
  );
}
