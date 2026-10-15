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
  // audio: no generic list — each voice engine has its own (VOICE_TAGS below), and engines without tags get none
  audio: [],
};

/**
 * ElevenLabs' audio tags, between [ ] (Eleven v4 reads them as directions, never says them): the feeling of the line,
 * then the sounds of the voice. A feeling goes at the start of the text (it colours what follows); a sound goes where
 * it is pressed — at the end, to move by hand.
 */
const ELEVEN_TAGS: { group: string; at: "start" | "end"; tags: [string, string][] }[] = [
  {
    group: "المشاعر",
    at: "start",
    tags: [["calm", "😌 هادئ"], ["cheerful", "😊 مرح"], ["happy", "😄 سعيد"], ["excited", "📣 حماس"], ["sad", "😢 حزين"], ["angry", "😠 غاضب"], ["fearful", "😨 خوف"], ["nervous", "😬 متوتر"], ["serious", "🧐 جدّي"], ["tender", "🤍 حنون"], ["curious", "🤔 فضول"], ["sarcastic", "😏 سخرية"], ["proud", "🦁 فخر"], ["storytelling tone", "📖 حكواتي"]],
  },
  {
    group: "الأداء والأصوات",
    at: "end",
    tags: [["whispers", "🤫 همس"], ["shouts", "📢 صراخ"], ["laughs", "😂 ضحك"], ["giggles", "🤭 ضحكة خفيفة"], ["crying", "😭 بكاء"], ["sighs", "😮‍💨 تنهيدة"], ["exhales", "💨 زفرة"], ["gasps", "😲 شهقة"], ["clears throat", "تنحنح"], ["pause", "⏸️ وقفة"], ["slowly", "🐢 ببطء"], ["quickly", "⚡ بسرعة"]],
  },
];

/** MiniMax's sounds, written in the line between ( ) where they happen. */
const MINIMAX_TAGS: { group: string; at: "start" | "end"; tags: [string, string][] }[] = [
  { group: "أصوات (MiniMax)", at: "end", tags: [["laughs", "😂 ضحكة"], ["sighs", "😮‍💨 تنهيدة"], ["gasps", "😲 شهقة"], ["sniffs", "🥲 شهقة بكاء"], ["groans", "😣 أنين"], ["coughs", "🤧 كحة"], ["clears throat", "تنحنح"], ["yawns", "🥱 تثاؤب"]] },
];

/** The tags of a voice engine (none for an engine that reads plain text, like GPT-4o mini TTS, or for sounds and music). */
export const voiceTags = (generatorId: string | undefined) => (generatorId === "elevenlabs-eleven-v4" ? { list: ELEVEN_TAGS, open: "[", close: "]" } : generatorId?.startsWith("minimax-speech") ? { list: MINIMAX_TAGS, open: "(", close: ")" } : null);

type Recognizer = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };
const recognizer = (): Recognizer | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  const R = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return R ? new R() : null;
};

/** Under the prompt: speak instead of typing (Arabic), and ready looks to add with one tap. */
export default function PromptHelpers({ kind, prompt, onPrompt, disabled, generatorId }: { kind: "image" | "video" | "audio"; prompt: string; onPrompt: (text: string) => void; disabled?: boolean; generatorId?: string }) {
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

  const tags = voiceTags(generatorId);
  // a feeling at the start (it replaces a feeling already there), a sound at the end; pressing it again takes it out
  const addTag = (tag: string, at: "start" | "end") => {
    const text = prompt.trim();
    if (text.includes(tag)) return onPrompt(text.replace(tag, "").replace(/\s{2,}/g, " ").trim());
    if (at === "end") return onPrompt(text ? `${text} ${tag}` : tag);
    const feelings = (tags?.list.find((g) => g.at === "start")?.tags ?? []).map(([v]) => `${tags!.open}${v}${tags!.close}`);
    const rest = feelings.reduce((t, f) => (t.startsWith(f) ? t.slice(f.length).trim() : t), text);
    onPrompt(rest ? `${tag} ${rest}` : tag);
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
        {PRESETS[kind].length > 0 && <span className="text-[11px] text-jw-faint">أضف شكلًا بضغطة:</span>}
        {PRESETS[kind].map((p) => (
          <button key={p.label} type="button" className={`jw-chip !px-2.5 !py-1 !text-xs transition-colors hover:!border-jw-accent-line ${prompt.includes(p.text) ? "!border-jw-accent !text-jw-ink" : ""}`} onClick={() => add(p.text)} disabled={disabled}>
            {p.label}
          </button>
        ))}
      </div>
      {kind === "audio" && tags && (
        <div className="space-y-1.5 rounded-xl border border-jw-line bg-jw-surface-2 p-2.5" aria-label="وسوم الصوت">
          {tags.list.map((g) => (
            <div key={g.group} className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-jw-muted">{g.group} {tags.open} {tags.close}:</span>
              {g.tags.map(([v, label]) => {
                const tag = `${tags.open}${v}${tags.close}`;
                return (
                  <button key={v} type="button" title={tag} className={`jw-chip !px-2.5 !py-1 !text-xs transition-colors hover:!border-jw-accent-line ${prompt.includes(tag) ? "!border-jw-accent !text-jw-ink" : ""}`} onClick={() => addTag(tag, g.at)} disabled={disabled}>
                    {label}
                  </button>
                );
              })}
            </div>
          ))}
          <p className="text-[10px] text-jw-faint">المشاعر تنحط أول الكلام وتلوّن اللي بعدها؛ الأصوات تنحط آخره، وتقدر تنقلها لمكانها بين الكلمات. الوسم ما ينقرا، يوجّه الأداء بس.</p>
        </div>
      )}
    </div>
  );
}
