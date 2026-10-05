"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { checkMediaFile, uploadMedia } from "@/lib/mahdi/client/media";
import { STORY_BACKGROUNDS, type StoryStyle } from "@/lib/mahdi/social";
import Icon from "../Icon";
import { useMahdi } from "../Provider";
import { QuoteCard } from "./PostCard";

const C = t.social.stories.camera;
const STYLES = Object.keys(STORY_BACKGROUNDS) as StoryStyle[];
type Facing = "environment" | "user";

/**
 * «أضف قصة»: the camera opens straight away (the back camera first) with the shutter, a switch between the cameras
 * and, below, a small square that opens the person's own files. A photo is then shown with an optional line of
 * text and published for 24 hours. «Aa» writes a text story instead. Without a camera (or permission), the files and
 * the device's own camera are offered.
 */
export default function StoryCamera({ open, onClose, onPublished }: { open: boolean; onClose: () => void; onPublished?: () => void }) {
  return open ? <CameraDialog onClose={onClose} onPublished={onPublished} /> : null;
}

function CameraDialog({ onClose, onPublished }: { onClose: () => void; onPublished?: () => void }) {
  const { toast } = useMahdi();
  const ref = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const native = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"camera" | "text">("camera");
  const [facing, setFacing] = useState<Facing>("environment");
  const [live, setLive] = useState(false);
  const [camError, setCamError] = useState("");
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);
  const [caption, setCaption] = useState("");
  const [text, setText] = useState("");
  const [style, setStyle] = useState<StoryStyle>("gold");
  const [busy, setBusy] = useState<number | null | false>(false);
  const [error, setError] = useState("");
  const supported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  // The camera runs only while it is on screen (not on the photo or the text story), and stops on leaving
  const filming = mode === "camera" && !shot && supported;
  useEffect(() => {
    if (!filming) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((tr) => tr.stop());
        stream = s;
        setCamError("");
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
        setLive(true);
      })
      .catch((e: Error) => setCamError(e.name === "NotAllowedError" || e.name === "SecurityError" ? C.denied : C.noCamera));
    return () => {
      stopped = true;
      stream?.getTracks().forEach((tr) => tr.stop());
      setLive(false);
    };
  }, [filming, facing]);

  useEffect(() => () => {
    if (shot) URL.revokeObjectURL(shot.url);
  }, [shot]);

  async function takePhoto(f: File | undefined) {
    if (!f) return;
    const problem = await checkMediaFile(f, "image");
    if (problem) return setError(problem);
    setError("");
    setShot({ file: f, url: URL.createObjectURL(f) });
  }

  function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, 1920 / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // The front camera is shown as in a mirror; the photo keeps what the person saw
    if (facing === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, w, h);
    canvas.toBlob((b) => b && takePhoto(new File([b], "story.jpg", { type: "image/jpeg" })), "image/jpeg", 0.9);
  }

  async function publish() {
    setError("");
    if (mode === "text" && !text.trim()) return setError(t.social.post.needQuote);
    setBusy(mode === "text" ? null : 0);
    try {
      if (mode === "text") {
        await mahdiFetch("/api/mahdi/social/stories", { method: "POST", json: { kind: "quote", text, style } });
      } else {
        const media = await uploadMedia(shot!.file, "image", (pct) => setBusy(pct));
        setBusy(null);
        await mahdiFetch("/api/mahdi/social/stories", { method: "POST", json: { kind: "photo", media, text: caption } });
      }
      toast(t.social.stories.published);
      onPublished?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const sending = busy !== false;
  const round = "grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur";

  return (
    <dialog
      ref={ref}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white"
      aria-label={C.title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="relative mx-auto flex h-full max-w-[520px] flex-col">
        {/* top: close, and «Aa» (text story) or back to the camera */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
          <button type="button" className={round} onClick={onClose} aria-label={t.social.stories.close}>
            <Icon name="close" size={22} />
          </button>
          {!shot && (
            <button type="button" className={`${round} w-auto px-4 font-semibold`} onClick={() => setMode(mode === "text" ? "camera" : "text")} aria-pressed={mode === "text"}>
              {mode === "text" ? <><Icon name="camera" size={20} /><span className="sr-only">{C.back}</span></> : <span aria-label={C.text}>Aa</span>}
            </button>
          )}
        </div>

        {/* the middle: the camera, the photo, or the text story */}
        <div className="relative grid flex-1 place-items-center overflow-hidden">
          {mode === "text" ? (
            <div className="grid size-full place-items-center p-6 pt-20" style={{ background: STORY_BACKGROUNDS[style] }}>
              <label className="w-full max-w-sm">
                <span className="sr-only">{C.textPlaceholder}</span>
                {text.trim() ? (
                  <div className="space-y-3">
                    <QuoteCard text={text.trim()} />
                    <textarea className="m-field min-h-20 bg-black/40 text-white" maxLength={500} dir="auto" value={text} onChange={(e) => setText(e.target.value)} />
                  </div>
                ) : (
                  <textarea autoFocus className="m-field min-h-40 bg-black/40 text-center text-xl text-white" maxLength={500} dir="auto" placeholder={C.textPlaceholder} value={text} onChange={(e) => setText(e.target.value)} />
                )}
              </label>
            </div>
          ) : shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot.url} alt="" className="max-h-full w-full object-contain" />
          ) : supported && !camError ? (
            <>
              <video ref={video} muted playsInline autoPlay className="size-full object-cover" style={facing === "user" ? { transform: "scaleX(-1)" } : undefined} />
              {!live && <p className="absolute inset-x-0 top-1/2 text-center text-sm text-white/80" role="status">{C.starting}</p>}
            </>
          ) : (
            <div className="space-y-4 p-8 text-center">
              <Icon name="camera" size={44} />
              <p className="leading-relaxed text-white/85" role="alert">{camError || C.noCamera}</p>
              <div className="grid gap-2">
                <button type="button" className="m-btn m-btn-primary" onClick={() => files.current?.click()}>
                  <Icon name="image" size={18} /> {C.pick}
                </button>
                <button type="button" className="m-btn border border-white/30 bg-white/10 text-white" onClick={() => native.current?.click()}>
                  <Icon name="camera" size={18} /> {C.native}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* bottom: files · shutter · switch camera — or the line of text and «انشر» */}
        <div className="space-y-3 p-4" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          {error && <p className="rounded-xl bg-red-900/70 p-2 text-center text-sm" role="alert">{error}</p>}
          {mode === "text" ? (
            <>
              <div className="flex items-center justify-center gap-3" role="radiogroup" aria-label={C.styles}>
                {STYLES.map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={style === k} aria-label={k} className="size-9 rounded-full border-2" style={{ background: STORY_BACKGROUNDS[k], borderColor: style === k ? "var(--m-gold)" : "rgba(255,255,255,0.35)" }} onClick={() => setStyle(k)} />
                ))}
              </div>
              <button type="button" className="m-btn m-btn-primary w-full" disabled={sending || !text.trim()} onClick={publish}>
                <Icon name="send" size={18} /> {sending ? t.social.post.publishing(null) : C.publish}
              </button>
            </>
          ) : shot ? (
            <>
              <input className="m-field bg-black/50 text-white" maxLength={200} dir="auto" placeholder={C.captionPlaceholder} value={caption} onChange={(e) => setCaption(e.target.value)} />
              <div className="grid grid-cols-[auto_1fr] gap-2">
                <button type="button" className="m-btn border border-white/30 bg-white/10 text-white" disabled={sending} onClick={() => setShot(null)}>
                  {C.retake}
                </button>
                <button type="button" className="m-btn m-btn-primary" disabled={sending} onClick={publish}>
                  <Icon name="send" size={18} /> {sending ? t.social.post.publishing(busy as number | null) : C.publish}
                </button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-3 items-center">
              {/* RTL: the files square sits on the right, the switch on the left */}
              <button type="button" className="flex flex-col items-center gap-1 justify-self-start text-xs" onClick={() => files.current?.click()} aria-label={C.pick}>
                <span className="grid size-12 place-items-center rounded-xl border-2 border-white/80 bg-white/10">
                  <Icon name="image" size={22} />
                </span>
                {C.files}
              </button>
              <button
                type="button"
                className="grid size-[74px] place-items-center justify-self-center rounded-full border-4 border-white/90 disabled:opacity-40"
                disabled={!live}
                onClick={capture}
                aria-label={C.shutter}
              >
                <span className="size-[58px] rounded-full bg-white" />
              </button>
              <button type="button" className={`${round} justify-self-end`} disabled={!supported || Boolean(camError)} onClick={() => setFacing(facing === "user" ? "environment" : "user")} aria-label={C.flip}>
                <Icon name="flip" size={22} />
              </button>
            </div>
          )}
        </div>
      </div>
      <input
        ref={files}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          takePhoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={native}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          takePhoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </dialog>
  );
}
