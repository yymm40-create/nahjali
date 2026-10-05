"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "../Icon";

// Ready looks to tap instead of typing (the leading tools' preset grids): each adds a few words to the prompt
const PRESETS: Record<"image" | "video" | "audio", { label: string; text: string }[]> = {
  image: [
    { label: "📷 واقعي", text: "photorealistic, natural light, 50mm lens" },
    { label: "🎨 كرتون", text: "clean 2D cartoon style, bold outlines, flat colors" },
    { label: "🧸 ثلاثي الأبعاد", text: "3D rendered, soft studio lighting, Pixar-like" },
    { label: "🖌️ ألوان مائية", text: "watercolor painting, soft edges, paper texture" },
    { label: "✒️ خط عربي", text: "Arabic calligraphy art, elegant, golden ink" },
    { label: "🕌 إسلامي", text: "Islamic geometric patterns, arabesque, deep blue and gold" },
    { label: "🌅 غروب", text: "golden hour, warm sunset glow, long shadows" },
    { label: "🌙 ليلي", text: "night scene, moonlight, cool tones, soft glow" },
    { label: "🎞️ سينمائي", text: "cinematic, dramatic lighting, shallow depth of field" },
    { label: "✨ بسيط", text: "minimalist, plain background, lots of empty space" },
  ],
  video: [
    { label: "🎥 لقطة قريبة", text: "close-up shot" },
    { label: "🏞️ لقطة واسعة", text: "wide establishing shot" },
    { label: "🔄 دوران الكاميرا", text: "slow orbit around the subject" },
    { label: "➡️ تتبع", text: "tracking shot following the subject" },
    { label: "🐢 حركة بطيئة", text: "slow motion" },
    { label: "⏱️ تايم لابس", text: "time-lapse" },
    { label: "🌅 غروب", text: "golden hour, warm light" },
    { label: "🎞️ سينمائي", text: "cinematic lighting, film grain" },
  ],
  audio: [
    { label: "😊 مرح", text: "[cheerful]" },
    { label: "😌 هادئ", text: "[calm, warm]" },
    { label: "🤫 همس", text: "[whispers]" },
    { label: "😄 ضحكة", text: "[laughs]" },
    { label: "📣 حماسي", text: "[excited]" },
    { label: "📖 حكواتي", text: "[storytelling tone]" },
  ],
};

type Recognizer = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };
const recognizer = (): Recognizer | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  const R = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return R ? new R() : null;
};

/** Under the prompt: speak instead of typing (Arabic), and ready looks to add with one tap. */
export default function PromptHelpers({ kind, prompt, onPrompt, disabled }: { kind: "image" | "video" | "audio"; prompt: string; onPrompt: (text: string) => void; disabled?: boolean }) {
  const [canSpeak, setCanSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognizer | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setCanSpeak(Boolean(recognizer())), 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => () => rec.current?.stop(), []);

  const toggle = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = recognizer();
    if (!r) return;
    r.lang = "ar-SA";
    r.interimResults = false;
    r.continuous = false;
    const before = prompt;
    r.onresult = (e) => {
      const said = Array.from(e.results, (x) => x[0]?.transcript ?? "").join(" ").trim();
      if (said) onPrompt(`${before}${before && !/\s$/.test(before) ? " " : ""}${said}`);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  const add = (text: string) => {
    if (prompt.includes(text)) return;
    const sep = kind === "audio" ? " " : ", ";
    onPrompt(prompt.trim() ? `${prompt.trim()}${sep}${text}` : text);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {canSpeak && (
          <button type="button" className={`jw-chip !px-2.5 !py-1 !text-xs ${listening ? "!border-jw-danger !text-jw-danger" : ""}`} onClick={toggle} disabled={disabled} aria-pressed={listening} title="قل وصفك بصوتك، ونكتبه لك">
            <Icon name="mic" size={13} /> {listening ? "نسمعك… اضغط للإيقاف" : "تكلّم بدل الكتابة"}
          </button>
        )}
        <span className="text-[11px] text-jw-faint">{kind === "audio" ? "أضف نبرة:" : "أضف شكلًا بضغطة:"}</span>
        {PRESETS[kind].map((p) => (
          <button key={p.label} type="button" className={`jw-chip !px-2.5 !py-1 !text-xs transition-colors hover:!border-jw-accent-line ${prompt.includes(p.text) ? "!border-jw-accent !text-jw-ink" : ""}`} onClick={() => add(p.text)} disabled={disabled}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
