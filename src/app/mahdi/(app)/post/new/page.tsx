"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { checkMediaFile, uploadMedia } from "@/lib/mahdi/client/media";
import type { MediaPostKind } from "@/lib/mahdi/social";
import Icon, { type IconName } from "@/components/mahdi/Icon";
import JoinPrompt from "@/components/mahdi/JoinPrompt";
import { useMahdi } from "@/components/mahdi/Provider";
import { QuoteCard } from "@/components/mahdi/social/PostCard";

const P = t.social.post;
const KINDS: { kind: MediaPostKind; icon: IconName }[] = [
  { kind: "photo", icon: "image" },
  { kind: "quote", icon: "quote" },
  { kind: "video", icon: "video" },
];

/** «منشور جديد»: a photo, a quote, or a video of up to 30 seconds, with a caption. */
export default function NewPostPage() {
  const router = useRouter();
  const { state, toast } = useMahdi();
  const [story, setStory] = useState(useSearchParams().get("story") === "1");
  const [kind, setKind] = useState<MediaPostKind>("photo");
  const [file, setFile] = useState<{ file: File; url: string } | null>(null);
  const [caption, setCaption] = useState("");
  const [quote, setQuote] = useState({ text: "", by: "" });
  const [busy, setBusy] = useState<number | null | false>(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (file) URL.revokeObjectURL(file.url);
  }, [file]);

  if (!state.snap.privacy.community) return <JoinPrompt />;

  async function pick(f: File | undefined) {
    if (!f) return;
    const problem = await checkMediaFile(f, kind === "video" ? "video" : "image");
    if (problem) return setError(problem);
    setError("");
    setFile({ file: f, url: URL.createObjectURL(f) });
  }

  async function publish() {
    setError("");
    if (kind === "quote" && !quote.text.trim()) return setError(P.needQuote);
    if (kind !== "quote" && !file) return setError(P.needMedia);
    setBusy(kind === "quote" ? null : 0);
    try {
      const media = kind === "quote" ? undefined : await uploadMedia(file!.file, kind === "video" ? "video" : "image", (pct) => setBusy(pct));
      setBusy(null);
      if (story) {
        await mahdiFetch("/api/mahdi/social/stories", { method: "POST", json: { kind, media, text: kind === "quote" ? quote.text : caption } });
        toast(t.social.stories.published);
        router.push("/mahdi/community");
        return;
      }
      await mahdiFetch("/api/mahdi/community/posts", { method: "POST", json: { kind, caption, media, quote: kind === "quote" ? quote : undefined } });
      toast(P.published);
      router.push(state.snap.username ? `/mahdi/u/${encodeURIComponent(state.snap.username)}` : "/mahdi/community");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href="/mahdi/community" className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> {t.community.title}
      </Link>
      <h1 className="m-display text-3xl">{story ? t.social.stories.new : P.title}</h1>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={P.title}>
        <button type="button" role="radio" aria-checked={!story} className="m-option min-h-11 text-sm font-semibold" onClick={() => setStory(false)}>{P.title}</button>
        <button type="button" role="radio" aria-checked={story} className="m-option min-h-11 text-sm font-semibold" onClick={() => setStory(true)}>{t.social.stories.new}</button>
      </div>

      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={P.title}>
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            role="radio"
            aria-checked={kind === k.kind}
            className="m-option flex min-h-16 flex-col items-center justify-center gap-1 px-2 text-sm font-semibold"
            onClick={() => {
              setKind(k.kind);
              setFile(null);
              setError("");
            }}
          >
            <Icon name={k.icon} /> {P.kinds[k.kind]}
          </button>
        ))}
      </div>

      <section className="m-card space-y-4 p-5">
        {kind === "quote" ? (
          <>
            <label className="block">
              <span className="m-label">{P.quoteText}</span>
              <textarea className="m-field min-h-28" maxLength={500} dir="auto" placeholder={P.quotePlaceholder} value={quote.text} onChange={(e) => setQuote({ ...quote, text: e.target.value })} />
            </label>
            <label className="block">
              <span className="m-label">{P.quoteBy}</span>
              <input className="m-field" maxLength={80} dir="auto" value={quote.by} onChange={(e) => setQuote({ ...quote, by: e.target.value })} />
            </label>
            {quote.text.trim() && <QuoteCard text={quote.text.trim()} by={quote.by.trim()} />}
          </>
        ) : (
          <>
            {file ? (
              <div className="space-y-2">
                {kind === "video" ? (
                  <video src={file.url} controls playsInline className="max-h-[50vh] w-full rounded-2xl bg-black" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.url} alt="" className="max-h-[50vh] w-full rounded-2xl bg-black object-contain" />
                )}
                <button type="button" className="m-btn m-btn-ghost m-btn-sm" disabled={busy !== false} onClick={() => input.current?.click()}>
                  <Icon name="edit" size={16} /> {P.change}
                </button>
              </div>
            ) : (
              <button type="button" className="m-option flex min-h-40 w-full flex-col items-center justify-center gap-2 text-sm font-semibold" onClick={() => input.current?.click()}>
                <Icon name={kind === "video" ? "video" : "image"} size={32} /> {kind === "video" ? P.pickVideo : P.pickPhoto}
              </button>
            )}
            <input
              ref={input}
              type="file"
              accept={kind === "video" ? "video/mp4,video/quicktime,.mp4,.mov" : "image/*"}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </>
        )}
        {!(story && kind === "quote") && (
          <label className="block">
            <span className="m-label">{P.caption}</span>
            <textarea className="m-field" rows={story ? 2 : 3} maxLength={story ? 200 : 1000} dir="auto" value={caption} onChange={(e) => setCaption(e.target.value)} />
          </label>
        )}
        <p className="m-hint">
          {state.snap.privacy.privateAccount ? P.audiencePrivate : P.audiencePublic}
          {story && ` ${t.social.stories.expires}`}
        </p>
        <p className="m-note text-sm">{t.social.rules}</p>
        {error && <p className="m-error" role="alert">{error}</p>}
        <button type="button" className="m-btn m-btn-primary w-full" disabled={busy !== false} onClick={publish}>
          <Icon name="send" size={18} /> {busy === false ? P.publish : P.publishing(busy)}
        </button>
      </section>
    </div>
  );
}
