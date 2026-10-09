"use client";

import { useRef, useState } from "react";
import { blobBase64, canTalk, record, SILENT_PEAK, type RecordingHandle } from "@/components/jawad/editor/talk";
import { postJson } from "@/lib/fetch";

/**
 * The microphone of a robot's chat: press to record, press again to stop; what was said is written (ElevenLabs Scribe) and
 * handed to `onText` to be put in the message box. The recording goes with the request and is never stored.
 */
export default function MicButton({ onText, onError, disabled = false, className = "", style }: { onText: (text: string) => void; onError?: (message: string) => void; disabled?: boolean; className?: string; style?: React.CSSProperties }) {
  const [state, setState] = useState<"idle" | "recording" | "writing">("idle");
  const [level, setLevel] = useState(0);
  const handle = useRef<RecordingHandle | null>(null);
  const fail = (m: string) => (onError ? onError(m) : alert(m));

  if (typeof window !== "undefined" && !canTalk()) return null;

  async function toggle() {
    if (state === "recording") {
      handle.current?.stop();
      return;
    }
    if (state !== "idle") return;
    try {
      const h = await record({ onLevel: setLevel });
      handle.current = h;
      setState("recording");
      const rec = await h.done;
      handle.current = null;
      if (!rec) return setState("idle");
      if (rec.meter && rec.peak < SILENT_PEAK) {
        setState("idle");
        return fail("ما سمعت صوت في التسجيل. تأكد إن المايك الصحيح مختار وقرّب منه.");
      }
      setState("writing");
      const out = await postJson<{ text: string }>("/api/voice", { audio: await blobBase64(rec.blob), mime: rec.mime });
      if (out.text.trim()) onText(out.text.trim());
    } catch (e) {
      fail(e instanceof Error ? e.message : "تعذّر تسجيل الصوت.");
    } finally {
      setState("idle");
      setLevel(0);
    }
  }

  const rec = state === "recording";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || state === "writing"}
      aria-label={rec ? "أوقف التسجيل" : state === "writing" ? "يكتب كلامك…" : "سجّل رسالة بصوتك"}
      title={rec ? "اضغط للإيقاف" : "سجّل بصوتك"}
      className={className}
      style={{
        border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
        borderRadius: 12,
        background: rec ? "#dc2626" : "transparent",
        color: rec ? "#fff" : "inherit",
        minWidth: 42,
        minHeight: 42,
        cursor: "pointer",
        boxShadow: rec ? `0 0 0 ${Math.round(level * 8)}px rgba(220,38,38,.25)` : undefined,
        ...style,
      }}
    >
      {state === "writing" ? "…" : rec ? "⏹" : "🎤"}
    </button>
  );
}
