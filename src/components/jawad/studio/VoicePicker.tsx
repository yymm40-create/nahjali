"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import SmartCoin from "@/components/SmartCoin";
import { LIBRARY_ADDON } from "@config/coins";
import Dialog from "../Dialog";
import Icon from "../Icon";
import { probeFile, putWithProgress } from "./upload";
import Riyal from "@/components/Riyal";

export interface Voice {
  id: string;
  value: string;
  name: string;
  description: string;
  origin: "design" | "clone" | "ready";
  previewUrl: string | null;
  provider?: "elevenlabs" | "minimax" | "jawad";
}
interface Library {
  mine: Voice[];
  ready: Voice[];
  /** MiniMax's ready voices (when its key is set) */
  minimax?: Voice[];
  providers?: { elevenlabs: boolean; minimax: boolean; jawad?: boolean };
  readyError: string | null;
  limit: number;
  migrated: boolean;
  /** «المكتبة» (an add-on): saving and using one's own voices. */
  library: { active: boolean; migrated: boolean };
}
interface Draft {
  id: string;
  status: string;
  previews: { index: number; url: string | null; durationSec: number | null }[];
  coins: number;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
async function post<T>(body: unknown): Promise<T> {
  const res = await fetch("/api/jawad/voices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(j.error || "تعذّر تنفيذ الطلب.");
  return j;
}

/** One small play/stop button for a voice sample (only one plays at a time). */
export function Play({ url, label }: { url: string | null; label: string }) {
  const [on, setOn] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  if (!url) return <span className="size-9" />;
  return (
    <button
      type="button"
      className="jw-btn jw-btn-quiet jw-btn-icon shrink-0"
      aria-label={on ? `أوقف ${label}` : `استمع إلى ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        if (on) {
          audio.current?.pause();
          return;
        }
        document.querySelectorAll<HTMLAudioElement>("audio[data-jw-sample]").forEach((a) => a.pause());
        audio.current ??= Object.assign(new Audio(url), {});
        audio.current.dataset.jwSample = "";
        audio.current.onpause = () => setOn(false);
        audio.current.onended = () => setOn(false);
        audio.current.currentTime = 0;
        audio.current.play().then(() => setOn(true)).catch(() => setOn(false));
      }}
    >
      <Icon name={on ? "stop" : "play"} size={16} />
    </button>
  );
}

/**
 * The voice of Eleven v4: the person's own voices (designed or copied), then ElevenLabs' ready voices. «صمّم صوتًا»
 * and «من تسجيل» open the voice studio; a saved voice is chosen at once.
 */
export default function VoicePicker({ value, onChange, coins, provider = "elevenlabs" }: { value: string; onChange: (v: string) => void; coins: { design: number | null; clone: number | null; cloneMinimax?: number | null; cloneJawad?: number | null }; provider?: "elevenlabs" | "minimax" | "jawad" }) {
  const [lib, setLib] = useState<Library | null>(null);
  const [error, setError] = useState("");
  const [studio, setStudio] = useState<"design" | "clone" | null>(null);
  const [showReady, setShowReady] = useState(false);
  const [showMinimax, setShowMinimax] = useState(provider === "minimax");

  const load = useCallback(() => {
    fetch("/api/jawad/voices", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as Library & { error?: string };
        if (!r.ok) throw new Error(j.error || "تعذّر تحميل الأصوات.");
        setLib(j);
        setError("");
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const all = [...(lib?.mine ?? []), ...(lib?.ready ?? []), ...(lib?.minimax ?? [])];
  const current = all.find((v) => v.value === value);
  // a generator speaks only its provider's voices
  const mine = (lib?.mine ?? []).filter((v) => (v.provider ?? "elevenlabs") === provider);
  const minimaxOnly = provider === "minimax" || provider === "jawad";

  return (
    <div className="space-y-2">
      <span className="jw-label" id="jw-voice-label">الصوت</span>
      {error && <p className="text-xs text-jw-danger" role="alert">{error}</p>}
      {!lib && !error && <p className="jw-skeleton h-16 rounded-xl" aria-busy="true" />}
      {lib && (
        <div role="radiogroup" aria-labelledby="jw-voice-label" className="space-y-2">
          {current && !mine.some((v) => v.value === value) && !showReady && !showMinimax && <Row v={current} on onPick={onChange} />}
          {mine.length > 0 && (
            <>
              <p className="text-[11px] font-semibold text-jw-faint">أصواتي{provider === "minimax" ? " في MiniMax" : provider === "jawad" ? " في صوت الجواد" : ` (${mine.length}/${lib.limit})`}{lib.library.active ? "" : " · مقفلة"}</p>
              {mine.map((v) => (
                <Row key={v.id} v={v} on={v.value === value} onPick={onChange} onDeleted={load} mine locked={!lib.library.active} />
              ))}
            </>
          )}
          {!lib.migrated || !lib.library.migrated ? (
            <p className="rounded-lg border border-jw-warn/40 bg-jw-warn/10 p-2 text-[11px] text-jw-warn">«صمّم صوتك الخاص» يحتاج ملف قاعدة البيانات 0025 في Supabase (SQL Editor ← Run).</p>
          ) : lib.library.active ? (
            <div className={`grid gap-2 ${minimaxOnly ? "" : "grid-cols-2"}`}>
              {!minimaxOnly && (
                <button type="button" className="jw-btn" onClick={() => setStudio("design")}>
                  <Icon name="wand" size={16} /> صمّم صوتًا
                </button>
              )}
              <button type="button" className="jw-btn" onClick={() => setStudio("clone")}>
                <Icon name="mic" size={16} /> بصمة صوتك{provider === "minimax" ? " (MiniMax، بلا حد)" : provider === "jawad" ? " (صوت الجواد، مجانًا وبلا حد)" : ""}
              </button>
            </div>
          ) : (
            <LibraryLock what="صمّم صوتك الخاص من الوصف، أو احفظ بصمة صوتك أنت" />
          )}
          {!minimaxOnly && (
            <>
              <button type="button" className="jw-btn jw-btn-quiet w-full justify-between" aria-expanded={showReady} onClick={() => setShowReady(!showReady)}>
                <span>أصوات ElevenLabs الجاهزة {lib.ready.length ? `(${lib.ready.length})` : ""}</span>
                <Icon name="chevronDown" size={16} className={showReady ? "rotate-180" : ""} />
              </button>
              {showReady && (
                <div className="jw-scroll max-h-72 space-y-1.5 overflow-y-auto pe-1">
                  {lib.readyError && <p className="text-xs text-jw-danger">{lib.readyError}</p>}
                  {lib.ready.map((v) => (
                    <Row key={v.id} v={v} on={v.value === value} onPick={onChange} />
                  ))}
                </div>
              )}
            </>
          )}
          {provider === "minimax" && (lib.minimax?.length ?? 0) > 0 && (
            <>
              <button type="button" className="jw-btn jw-btn-quiet w-full justify-between" aria-expanded={showMinimax} onClick={() => setShowMinimax(!showMinimax)}>
                <span>أصوات MiniMax الجاهزة ({lib.minimax!.length})</span>
                <Icon name="chevronDown" size={16} className={showMinimax ? "rotate-180" : ""} />
              </button>
              {showMinimax && (
                <div className="jw-scroll max-h-72 space-y-1.5 overflow-y-auto pe-1">
                  {lib.minimax!.map((v) => (
                    <Row key={v.id} v={v} on={v.value === value} onPick={onChange} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {studio && (
        <VoiceStudio
        mode={studio}
        coins={coins}
        provider={provider}
        onClose={() => setStudio(null)}
        onSaved={(v) => {
          setStudio(null);
          setLib((l) => (l ? { ...l, mine: [v, ...l.mine] } : l));
          onChange(v.value);
        }}
        />
      )}
    </div>
  );
}

/** «المكتبة» is closed for this person: what it opens, and where to subscribe. */
export function LibraryLock({ what }: { what: string }) {
  return (
    <Link href="/jawad-ai/library" className="flex items-center gap-3 rounded-xl border border-dashed border-jw-accent/50 bg-jw-accent/5 p-3 text-start text-sm hover:bg-jw-accent/10">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-jw-accent/15 text-jw-accent"><Icon name="lock" size={16} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{what}</span>
        <span className="block text-[11px] text-jw-muted">ضمن «{LIBRARY_ADDON.name}»<span className="hide-in-app"> · إضافة بـ <SmartCoin size={12} className="inline align-middle" />{LIBRARY_ADDON.monthlySar} شهريًا</span></span>
      </span>
      <Icon name="chevronLeft" size={16} className="text-jw-faint" />
    </Link>
  );
}

function Row({ v, on, onPick, mine = false, locked = false, onDeleted }: { v: Voice; on: boolean; onPick: (value: string) => void; mine?: boolean; locked?: boolean; onDeleted?: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${on ? "border-jw-accent bg-jw-accent/10" : "border-jw-line bg-jw-bg-2"} ${locked ? "opacity-60" : ""}`}>
      <Play url={v.previewUrl} label={v.name} />
      <button type="button" role="radio" aria-checked={on} aria-disabled={locked} title={locked ? "مقفل: يحتاج اشتراك «المكتبة»" : undefined} className="min-w-0 flex-1 text-start" onClick={() => !locked && onPick(v.value)}>
        <span className="block truncate text-sm font-semibold">{v.name}</span>
        {(v.description || v.origin !== "ready") && (
          <span className="block truncate text-[11px] text-jw-faint" dir="auto">
            {v.origin === "design" ? "مصمّم بالوصف" : v.origin === "clone" ? `منسوخ من تسجيل${v.provider === "minimax" ? " · MiniMax" : v.provider === "jawad" ? " · صوت الجواد" : ""}` : v.description}
          </span>
        )}
      </button>
      {mine && (
        <button
          type="button"
          className="jw-btn jw-btn-quiet jw-btn-icon"
          disabled={busy}
          aria-label={`احذف ${v.name}`}
          onClick={async () => {
            if (!confirm(`حذف الصوت «${v.name}» من مكتبتك؟`)) return;
            setBusy(true);
            try {
              await post({ action: "delete", id: v.id });
              onDeleted?.();
            } catch (e) {
              alert((e as Error).message);
            }
            setBusy(false);
          }}
        >
          <Icon name="trash" size={15} />
        </button>
      )}
    </div>
  );
}

/** Uploads one recording through the studio's own upload path; returns its id once the server has checked it. */
async function uploadRecording(file: File, onProgress: (p: number) => void) {
  const probe = await probeFile(file, "audio");
  const res = await fetch("/api/jawad/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "audio", mime: probe.mime, bytes: file.size, fileName: file.name }) });
  const signed = (await res.json().catch(() => ({}))) as { id?: string; signedUrl?: string; error?: string };
  if (!res.ok || !signed.id || !signed.signedUrl) throw new Error(signed.error || "تعذّر بدء الرفع.");
  await putWithProgress(signed.signedUrl, file, probe.mime, onProgress);
  const c = await fetch("/api/jawad/uploads/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: signed.id }) });
  const conf = (await c.json().catch(() => ({}))) as { upload?: { id: string; status: string; error: string | null; durationMs: number | null }; error?: string };
  if (!c.ok || !conf.upload) throw new Error(conf.error || "تعذّر فحص الملف.");
  if (conf.upload.status !== "ready") throw new Error(conf.upload.error || "الملف مرفوض.");
  return { id: conf.upload.id, durationMs: conf.upload.durationMs };
}

/** A recording as a 16-bit mono WAV (the server takes MP3 or WAV; the browser records in its own format). */
async function toWav(blob: Blob, rate = 44_100): Promise<Blob> {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const x = (await off.startRendering()).getChannelData(0);
    const b = new ArrayBuffer(44 + x.length * 2);
    const v = new DataView(b);
    const str = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, "RIFF");
    v.setUint32(4, 36 + x.length * 2, true);
    str(8, "WAVE");
    str(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    str(36, "data");
    v.setUint32(40, x.length * 2, true);
    for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 0x7fff, true);
    return new Blob([b], { type: "audio/wav" });
  } finally {
    void ctx.close();
  }
}

/** «سجّل الآن»: records from the microphone (up to `maxSec`) and hands back a WAV file. */
function MicButton({ maxSec, disabled, onFile, onError }: { maxSec: number; disabled: boolean; onFile: (f: File) => void; onError: (m: string) => void }) {
  const [rec, setRec] = useState<{ mr: MediaRecorder; started: number } | null>(null);
  const [sec, setSec] = useState(0);
  const chunks = useRef<Blob[]>([]);
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - rec.started) / 1000);
      setSec(s);
      if (s >= maxSec && rec.mr.state === "recording") rec.mr.stop();
    }, 250);
    return () => clearInterval(t);
  }, [rec, maxSec]);
  useEffect(() => () => rec?.mr.stream.getTracks().forEach((t) => t.stop()), [rec]);

  async function start() {
    onError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return onError("متصفحك لا يسجّل من الميكروفون؛ ارفع ملفًا بدلًا منه.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 } });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        try {
          const wav = await toWav(new Blob(chunks.current, { type: mr.mimeType }));
          onFile(new File([wav], "تسجيلي.wav", { type: "audio/wav" }));
        } catch {
          onError("تعذّر تجهيز التسجيل؛ جرّب مرة ثانية أو ارفع ملفًا.");
        }
      };
      mr.start(500);
      setSec(0);
      setRec({ mr, started: Date.now() });
    } catch {
      onError("ما قدرنا نفتح الميكروفون. اسمح للموقع باستخدامه من إعدادات المتصفح، أو ارفع ملفًا.");
    }
  }

  const mmss = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  return rec ? (
    <button type="button" className="jw-btn w-full !border-jw-danger/60 text-jw-danger" onClick={() => rec.mr.stop()} aria-live="polite">
      <span className="size-2.5 animate-pulse rounded-full bg-jw-danger" aria-hidden /> يسجّل <span dir="ltr" className="tabular-nums">{mmss}</span> · اضغط للإيقاف
    </button>
  ) : (
    <button type="button" className="jw-btn w-full" disabled={disabled} onClick={start}>
      <Icon name="mic" size={16} /> سجّل الآن بصوتك
    </button>
  );
}

function RecordingField({ label, hint, value, onChange, maxSec }: { label: string; hint: string; value: { id: string; name: string; sec: number } | null; onChange: (v: { id: string; name: string; sec: number } | null) => void; maxSec: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  async function send(f: File) {
    setError("");
    setProgress(0);
    try {
      const r = await uploadRecording(f, setProgress);
      onChange({ id: r.id, name: f.name, sec: Math.round((r.durationMs ?? 0) / 1000) });
    } catch (err) {
      setError((err as Error).message);
    }
    setProgress(null);
  }
  return (
    <div>
      <span className="jw-label">{label}</span>
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-jw-line bg-jw-bg-2 px-3 py-2 text-sm">
          <Icon name="audio" size={16} />
          <span className="min-w-0 flex-1 truncate" dir="auto">{value.name}</span>
          <span className="tabular-nums text-jw-faint" dir="ltr">{value.sec}s</span>
          <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" aria-label="أزل التسجيل" onClick={() => onChange(null)}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ) : progress !== null ? (
        <p className="jw-btn w-full" role="status">يرفع… {Math.round(progress * 100)}٪</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <MicButton maxSec={maxSec} disabled={false} onFile={send} onError={setError} />
          <button type="button" className="jw-btn w-full" onClick={() => input.current?.click()}>
            <Icon name="upload" size={16} /> ارفع ملفًا (MP3 أو WAV)
          </button>
        </div>
      )}
      <p className="mt-1 text-[11px] text-jw-faint">{hint}</p>
      {error && <p className="mt-1 text-xs text-jw-danger" role="alert">{error}</p>}
      <input
        ref={input}
        type="file"
        accept="audio/mpeg,audio/wav,.mp3,.wav"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void send(f);
        }}
      />
    </div>
  );
}

/**
 * The voice studio: «صمّم بالوصف» (three previews from a description, optionally leaning on a reference recording:
 * «يستوحي منه» or «يتعلّم منه»), or «من تسجيل» (the very voice of a recording, with the owner of the voice's consent).
 */
export function VoiceStudio({ mode, coins, provider = "elevenlabs", onClose, onSaved }: { mode: "design" | "clone"; coins: { design: number | null; clone: number | null; cloneMinimax?: number | null; cloneJawad?: number | null }; provider?: "elevenlabs" | "minimax" | "jawad"; onClose: () => void; onSaved: (v: Voice) => void }) {
  const [tab, setTab] = useState<"design" | "clone">(provider === "minimax" || provider === "jawad" ? "clone" : mode);
  // where «بصمة صوتك» is kept: the site's own engine (free, no limit), MiniMax (no slot limit) or ElevenLabs (a slot)
  const [where, setWhere] = useState<"elevenlabs" | "minimax" | "jawad">(provider);
  const minimaxOn = coins.cloneMinimax !== undefined;
  const jawadOn = coins.cloneJawad !== undefined;
  const [description, setDescription] = useState("");
  const [text, setText] = useState("");
  const [reference, setReference] = useState<{ id: string; name: string; sec: number } | null>(null);
  const [use, setUse] = useState<"inspire" | "learn">("inspire");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [noise, setNoise] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shown = tab;

  async function design() {
    setBusy(true);
    setError("");
    try {
      const r = await post<{ draft: Draft }>({ action: "design", key: uid(), description, text: text || undefined, referenceId: reference?.id, referenceUse: use });
      setDraft(r.draft);
      setPick(0);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }
  async function save() {
    if (!draft || pick === null) return;
    setBusy(true);
    setError("");
    try {
      const r = await post<{ voice: Voice }>({ action: "save", draftId: draft.id, index: pick, name });
      onSaved(r.voice);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }
  async function clone() {
    if (!reference) return;
    setBusy(true);
    setError("");
    try {
      const r = await post<{ voice: Voice }>({ action: "clone", key: uid(), uploadId: reference.id, name, consent, removeNoise: noise, provider: where });
      onSaved(r.voice);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  // Why the button can't be pressed yet (said under it, never a silent grey button)
  const d = description.trim().length;
  const t = text.trim().length;
  const designWhy =
    coins.design === null ? "سعر التصميم لم يُحدد بعد في لوحة الإدارة." : d < 20 ? `صف الصوت في ٢٠ حرفًا على الأقل (الآن ${d}): الجنس، العمر، اللهجة، النبرة، الإيقاع.` : t > 0 && t < 100 ? `نص العينات ١٠٠ حرف على الأقل (الآن ${t})، أو اتركه فارغًا.` : null;
  const clonePrice = where === "minimax" ? (coins.cloneMinimax ?? null) : where === "jawad" ? (coins.cloneJawad ?? null) : coins.clone;
  const cloneWhy = clonePrice === null ? "سعر الحفظ لم يُحدد بعد في لوحة الإدارة." : !reference ? "سجّل بصوتك أو ارفع تسجيلًا أولًا." : where !== "elevenlabs" && reference.sec < 10 ? `${where === "minimax" ? "MiniMax" : "صوت الجواد"} يحتاج تسجيل ١٠ ثوانٍ على الأقل.` : !name.trim() ? "سمِّ الصوت." : !consent ? "أكّد أن الصوت صوتك أو أن صاحبه أذن لك." : null;

  const price = (n: number | null) =>
    n === null ? "السعر غير محدد بعد" : n === 0 ? "" : (
      <span className="inline-flex items-center gap-1">
        · <Riyal halalas={n} size={14} />
      </span>
    );

  return (
    <Dialog open onClose={onClose} title="استوديو الأصوات">
      <div className="space-y-4 p-4">
        <div className="jw-seg" role="tablist" aria-label="طريقة الصوت">
          <button type="button" role="tab" aria-selected={shown === "design"} disabled={provider === "minimax" || provider === "jawad"} onClick={() => setTab("design")}>
            <Icon name="wand" size={15} /> صمّم بالوصف
          </button>
          <button type="button" role="tab" aria-selected={shown === "clone"} onClick={() => setTab("clone")}>
            <Icon name="mic" size={15} /> بصمة صوتك
          </button>
        </div>

        {shown === "design" ? (
          draft ? (
            <div className="space-y-3">
              <p className="text-sm">اختر العينة الأقرب لما تريد، وسمِّ الصوت لتحفظه في مكتبتك:</p>
              <div role="radiogroup" aria-label="العينات" className="space-y-2">
                {draft.previews.map((p) => (
                  <div key={p.index} className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${pick === p.index ? "border-jw-accent bg-jw-accent/10" : "border-jw-line bg-jw-bg-2"}`}>
                    <Play url={p.url} label={`العينة ${p.index + 1}`} />
                    <button type="button" role="radio" aria-checked={pick === p.index} className="flex-1 text-start text-sm font-semibold" onClick={() => setPick(p.index)}>
                      العينة {p.index + 1} {p.durationSec ? <span className="text-jw-faint" dir="ltr">· {Math.round(p.durationSec)}s</span> : null}
                    </button>
                  </div>
                ))}
              </div>
              <label className="block">
                <span className="jw-label">اسم الصوت</span>
                <input className="jw-input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: الراوي الهادئ" dir="auto" />
              </label>
              <div className="flex gap-2">
                <button type="button" className="jw-btn jw-btn-primary flex-1" disabled={busy || pick === null || !name.trim()} onClick={save}>
                  <Icon name="check" size={16} /> {busy ? "يحفظ…" : "احفظه في مكتبتي"}
                </button>
                <button
                  type="button"
                  className="jw-btn"
                  disabled={busy}
                  onClick={() => setDraft(null)}
                >
                  <Icon name="retry" size={16} /> عينات أخرى
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="jw-label">صف الصوت ({description.trim().length}/1000)</span>
                <textarea className="jw-textarea min-h-28" maxLength={1000} dir="auto" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="مثال: رجل خليجي في الأربعين، صوت عميق ودافئ، يتكلم بهدوء ووقار، إيقاع متوسط، مناسب للسرد الوثائقي." />
              </label>
              <label className="block">
                <span className="jw-label">نص العينات (اختياري، ١٠٠–١٠٠٠ حرف)</span>
                <textarea className="jw-textarea min-h-20" maxLength={1000} dir="auto" value={text} onChange={(e) => setText(e.target.value)} placeholder="اتركه فارغًا ليكتب المولد نصًا مناسبًا للوصف." />
              </label>
              <RecordingField label="تسجيل مرجعي (اختياري)" hint="يُبنى الصوت عليه مع الوصف (حتى ٦٠ ثانية). لحفظ صوتك نفسه استخدم «بصمة صوتك»." value={reference} onChange={setReference} maxSec={58} />
              {reference && (
                <div className="jw-seg" role="radiogroup" aria-label="طريقة استخدام المرجع">
                  <button type="button" role="radio" aria-checked={use === "inspire"} onClick={() => setUse("inspire")}>
                    يستوحي منه <span className="text-[10px] text-jw-faint">الوصف أولًا</span>
                  </button>
                  <button type="button" role="radio" aria-checked={use === "learn"} onClick={() => setUse("learn")}>
                    يتعلّم منه <span className="text-[10px] text-jw-faint">قريب من التسجيل</span>
                  </button>
                </div>
              )}
              <button type="button" className="jw-btn jw-btn-primary w-full" disabled={busy || Boolean(designWhy)} aria-describedby="jw-design-why" onClick={design}>
                <Icon name="sparkles" size={16} /> {busy ? "يصمّم… (قرابة نصف دقيقة)" : <>صمّم ٣ عينات {price(coins.design)}</>}
              </button>
              {designWhy && !busy && <p id="jw-design-why" className="text-[11px] text-jw-muted">{designWhy}</p>}
            </div>
          )
        ) : (
          <div className="space-y-3">
            {(minimaxOn || jawadOn) && provider === "elevenlabs" && (
              <div className="jw-seg" role="radiogroup" aria-label="وين ينحفظ الصوت">
                {jawadOn && (
                  <button type="button" role="radio" aria-checked={where === "jawad"} onClick={() => setWhere("jawad")}>
                    صوت الجواد <span className="text-[10px] text-jw-faint">محرك الموقع · مجاني · ١٠ ث فأكثر</span>
                  </button>
                )}
                <button type="button" role="radio" aria-checked={where === "elevenlabs"} onClick={() => setWhere("elevenlabs")}>
                  ElevenLabs <span className="text-[10px] text-jw-faint">خانة في الحساب</span>
                </button>
                {minimaxOn && (
                  <button type="button" role="radio" aria-checked={where === "minimax"} onClick={() => setWhere("minimax")}>
                    MiniMax <span className="text-[10px] text-jw-faint">بلا حد · ١٠ ث فأكثر</span>
                  </button>
                )}
              </div>
            )}
            <RecordingField label="بصمة صوتك" hint="سجّل بصوتك الطبيعي في مكان هادئ (من ٣٠ ثانية إلى دقيقتين أفضل): اقرأ أي نص بنبرتك المعتادة. أو ارفع تسجيلًا نظيفًا لصوت واحد بلا موسيقى." value={reference} onChange={setReference} maxSec={170} />
            <label className="block">
              <span className="jw-label">اسم الصوت</span>
              <input className="jw-input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: صوتي" dir="auto" />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 size-4 accent-[var(--jw-accent)]" checked={noise} onChange={(e) => setNoise(e.target.checked)} />
              <span>أزل ضوضاء الخلفية <span className="block text-[11px] text-jw-faint">فقط إذا كان في التسجيل ضوضاء؛ قد يضعف التسجيل النظيف.</span></span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-jw-line bg-jw-bg-2 p-3 text-sm">
              <input type="checkbox" className="mt-1 size-4 accent-[var(--jw-accent)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>أقرّ أن هذا الصوت صوتي، أو أن صاحبه أذن لي صراحةً باستخدامه. نسخ صوت أحد دون إذنه ممنوع.</span>
            </label>
            <button type="button" className="jw-btn jw-btn-primary w-full" disabled={busy || Boolean(cloneWhy)} aria-describedby="jw-clone-why" onClick={clone}>
              <Icon name="mic" size={16} /> {busy ? "يحفظ صوتك…" : <>احفظ صوتي في مكتبتي{where === "minimax" ? " (MiniMax)" : where === "jawad" ? " (صوت الجواد)" : ""} {price(clonePrice)}</>}
            </button>
            {cloneWhy && !busy && <p id="jw-clone-why" className="text-[11px] text-jw-muted">{cloneWhy}</p>}
          </div>
        )}
        {error && <p className="text-sm text-jw-danger" role="alert">{error}</p>}
        <p className="text-[11px] text-jw-faint">الأصوات تُحفظ في مكتبتك لتختارها في الكلام وفي صانع الأفلام؛ كل صوت يتكلم عند المحرك اللي انحفظ فيه (صوت الجواد أو ElevenLabs أو MiniMax). أخبر مستمعيك أن الصوت مولّد بالذكاء الاصطناعي.</p>
      </div>
    </Dialog>
  );
}
