"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { postJson } from "@/lib/fetch";
import { probeFile, uploadReference } from "@/components/jawad/studio/upload";
import { AD_REF_VIDEO_MAX_SEC } from "@config/film-ad";

/**
 * «📼 فيديو المرجع مع التوليد» (an ad, any step): the reference ad's own clip — the part to copy, 15 s at most (what
 * Wan 3.0 takes) — kept with the project and sent with every Wan 3.0 generation, which recreates it shot for shot on
 * the brand. Its seconds are charged with the video.
 */
export default function AdReferenceVideo({ projectId, current }: { projectId: string; current: { seconds: number; name: string } | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [shown, setShown] = useState(current);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const probe = await probeFile(file, "video");
      const sec = (probe.durationMs ?? 0) / 1000;
      if (sec > AD_REF_VIDEO_MAX_SEC + 0.2) throw new Error(`الفيديو ${sec.toFixed(1)} ثانية، والمولّد يقبل لين ${AD_REF_VIDEO_MAX_SEC} ثانية. قصّه للقطعة اللي تبي تقلّدها وارفعه.`);
      setBusy("⬆️ أرفع الفيديو…");
      const up = await uploadReference(file, "video");
      setBusy("💾 أحفظه مع المشروع…");
      const r = await postJson<{ seconds: number }>(`/api/film/projects/${projectId}/ad`, { videoFileId: up.id });
      setShown({ seconds: r.seconds, name: file.name });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setError("");
    try {
      await postJson(`/api/film/projects/${projectId}/ad`, { removeVideo: true });
      setShown(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-lg font-extrabold">📼 فيديو الإعلان المرجعي مع التوليد</h2>
      <p className="text-sm font-bold text-muted">
        القطعة اللي تبي تقلّدها من الإعلان (لين {AD_REF_VIDEO_MAX_SEC} ثانية). تنرسل نفسها مع كل توليد بـ Wan 3.0، والمولّد يقلّدها لقطة بلقطة (نفس اللقطات والكاميرا والتسريع والتبطيء) على براندك. ثوانيها تنحسب مع سعر الفيديو.
      </p>
      {shown ? (
        <div className="flex items-center gap-2 rounded-2xl border-2 border-[var(--film-blue)] bg-[var(--film-blue)]/10 p-3">
          <span className="text-2xl" aria-hidden>📼</span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm" dir="auto">{shown.name || "الإعلان المرجعي"}</b>
            <small className="text-xs font-bold text-muted">✓ {shown.seconds} ثانية · ينرسل مع Wan 3.0</small>
          </span>
          <button type="button" className="btn text-xs" disabled={Boolean(busy)} onClick={() => input.current?.click()}>غيّره</button>
          <button type="button" className="btn text-xs" disabled={Boolean(busy)} onClick={() => void remove()}>شيله</button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost w-full" disabled={Boolean(busy)} onClick={() => input.current?.click()}>
          {busy || "＋ ارفع القطعة (MP4/MOV)"}
        </button>
      )}
      {busy && shown && <p className="text-xs font-bold text-muted">{busy}</p>}
      <input ref={input} type="file" accept="video/mp4,video/quicktime,.mp4,.mov" hidden onChange={(e) => void choose(e.target.files?.[0])} />
      {error && <p className="error-box">{error}</p>}
    </section>
  );
}
