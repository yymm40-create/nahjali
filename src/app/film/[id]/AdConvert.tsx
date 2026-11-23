"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";
import { useClaudeModel } from "@/components/robots/claude-model";
import { isYoutubeLink, storyFromLink, storyFromUpload, type StoryVideo } from "@/lib/film/story-link";
import StoryVideoUpload from "../StoryVideoUpload";
import { prepareLinkFrames } from "../prepare-link";

/**
 * «📣 خلّه إعلان» (config/film-ad.ts): a project made before (the screenwriter not yet handed over) becomes an ad — the
 * brand's pictures go in «🏷️ صور براندك» under it — optionally on a reference ad (a YouTube link or a video from the
 * device): سجاد looks at it and hears it, and the director follows its shots, camera and rhythm. On an ad, the same card
 * changes (or adds) its reference ad.
 */
export default function AdConvert({ projectId, ad, reference }: { projectId: string; ad: boolean; reference: string }) {
  const router = useRouter();
  const [claude] = useClaudeModel();
  const [way, setWay] = useState<"link" | "upload">("link");
  const [url, setUrl] = useState("");
  const [video, setVideo] = useState<StoryVideo | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function go(withReference: boolean) {
    setError("");
    try {
      let body: Record<string, unknown> = { model: claude.id };
      if (withReference) {
        if (way === "link") {
          if (!isYoutubeLink(url)) throw new Error("حط رابط فيديو يوتيوب صحيح. المتاح الحين روابط يوتيوب بس.");
          setBusy("⬇️ أجهّز الفيديو…");
          const sheetId = await prepareLinkFrames(url, setBusy);
          body = { ...body, story: storyFromLink(url, ""), youtube: { sheetId } };
        } else {
          if (!video) throw new Error("ارفع فيديو الإعلان المرجعي أول.");
          body = { ...body, story: storyFromUpload(video, "") };
        }
        setBusy("👂 سجاد يشوف الإعلان المرجعي ويسمعه…");
      } else setBusy("⏳ أحوّله…");
      await postJson(`/api/film/projects/${projectId}/ad`, body);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-lg font-extrabold">{ad ? "📣 هذا إعلان" : "📣 هذا إعلان؟"}</h2>
      <p className="text-sm font-bold text-muted">
        {ad
          ? reference
            ? `المخرج يمشي على أسلوب الإعلان المرجعي (${reference}).`
            : "ما فيه إعلان مرجعي. تقدر تحط واحد والمخرج يقلّد لقطاته وكاميرته وإيقاعه على براندك."
          : "حوّله لمسار الإعلان: ترفع صور براندك تحت (الشعار، المنتج، الألوان)، وصانع الشيت يحطها على الخريطة كما هي، ولو عندك إعلان تحبه المخرج يمشي على أسلوبه. ما ينحذف شي من شغلك."}
      </p>
      {!open ? (
        <button type="button" className="btn btn-primary w-full" onClick={() => setOpen(true)}>
          {ad ? (reference ? "🔁 غيّر الإعلان المرجعي" : "🔁 حط إعلان مرجعي") : "📣 خلّه إعلان"}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="الإعلان المرجعي">
            {([["link", "🔗", "رابط يوتيوب"], ["upload", "📤", "ارفع فيديو"]] as const).map(([w, icon, label]) => (
              <button key={w} type="button" aria-pressed={way === w} onClick={() => setWay(w)} className={`rounded-2xl border-2 p-3 text-start ${way === w ? "border-[var(--film-blue)] bg-[var(--film-blue)]/10" : "border-line"}`}>
                <span className="block text-2xl" aria-hidden>{icon}</span>
                <b className="block text-sm">{label}</b>
              </button>
            ))}
          </div>
          {way === "link" ? (
            <input className="field" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://www.youtube.com/watch?v=…" disabled={Boolean(busy)} />
          ) : (
            <StoryVideoUpload video={video} onVideo={setVideo} ad />
          )}
          <button type="button" className="btn btn-primary w-full" disabled={Boolean(busy) || (way === "link" ? !url : !video)} onClick={() => void go(true)}>
            {busy || (ad ? "🔁 خلّ المخرج يمشي على هالإعلان" : "📣 خلّه إعلان على أسلوب هالإعلان")}
          </button>
          {!ad && (
            <button type="button" className="btn btn-ghost w-full" disabled={Boolean(busy)} onClick={() => void go(false)}>
              خلّه إعلان بدون إعلان مرجعي
            </button>
          )}
        </div>
      )}
      {error && <p className="error-box">{error}</p>}
    </section>
  );
}
