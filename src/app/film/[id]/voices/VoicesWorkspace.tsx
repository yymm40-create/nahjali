"use client";

import { useCallback, useEffect, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import Spinner from "@/components/Spinner";
import type { VoiceLine } from "@/lib/film/voices";
import EmotionPicker from "../../EmotionPicker";
import VoiceDesigner from "../../VoiceDesigner";

interface Choice {
  value: string;
  name: string;
  group: "mine" | "ready" | "minimax";
}
interface Audio {
  key: string;
  url: string;
  text: string;
  voice: string;
  durationMs: number | null;
}
interface State {
  ready: boolean;
  lines: VoiceLine[];
  cast: Record<string, string>;
  audios: Audio[];
  voices: Choice[];
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Cast a voice for each speaker, then speak the lines one by one (or all of them). */
export default function VoicesWorkspace({ projectId, initialLines }: { projectId: string; initialLines: VoiceLine[] }) {
  const url = `/api/film/projects/${projectId}/voices`;
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [feel, setFeel] = useState<Record<string, string>>({});

  const load = useCallback(() => api<State>(url).then(setS).catch((e: Error) => setError(e.message)), [url]);
  useEffect(() => {
    load();
  }, [load]);

  const lines = s?.lines ?? initialLines;
  const speakers = [...new Set(lines.map((l) => l.speaker))];
  const audioOf = (key: string) => s?.audios.find((a) => a.key === key);

  async function cast(speaker: string, voice: string) {
    setError("");
    setS((x) => (x ? { ...x, cast: { ...x.cast, [speaker]: voice } } : x));
    try {
      await postJson(url, { action: "cast", speaker, voice });
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  }
  async function speak(keys: string[]) {
    setError("");
    for (const key of keys) {
      setBusy(key);
      try {
        await postJson(url, { action: "speak", key, idempotencyKey: uid(), emotion: feel[key] ?? "" });
        await load();
      } catch (e) {
        setError((e as Error).message);
        break;
      }
    }
    setBusy(null);
  }

  if (!lines.length) {
    return <p className="card p-5 text-center text-sm font-bold text-muted">ما فيه جمل منطوقة في التوليدات المعتمدة بعد. اعتمد توليدات فيها حوار أو تعليق من «المخرج».</p>;
  }
  if (s && !s.ready) return <p className="card p-5 text-center text-sm font-bold text-muted">أصوات ElevenLabs قيد التجهيز (مفتاح الخادم).</p>;

  const missing = speakers.filter((sp) => !s?.cast[sp]);
  const groups = [...new Set(lines.map((l) => l.genId))];

  return (
    <div className="space-y-5">
      <section className="card space-y-3 p-5" aria-label="الشخصيات وأصواتها">
        <h2 className="text-lg font-extrabold">الشخصيات وأصواتها</h2>
        {!s && <Spinner />}
        {s && (
          <ul className="space-y-2">
            {speakers.map((sp) => (
              <li key={sp} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-extrabold">{sp}</span>
                <select className="field min-h-10 w-full max-w-xs text-sm" aria-label={`صوت ${sp}`} value={s.cast[sp] ?? ""} onChange={(e) => cast(sp, e.target.value)}>
                  <option value="" disabled>اختر صوتًا…</option>
                  {s.voices.some((v) => v.group === "mine") && (
                    <optgroup label="أصواتي">
                      {s.voices.filter((v) => v.group === "mine").map((v) => <option key={v.value} value={v.value}>{v.name}</option>)}
                    </optgroup>
                  )}
                  <optgroup label="أصوات ElevenLabs الجاهزة">
                    {s.voices.filter((v) => v.group === "ready").map((v) => <option key={v.value} value={v.value}>{v.name}</option>)}
                  </optgroup>
                  {s.voices.some((v) => v.group === "minimax") && (
                    <optgroup label="أصوات MiniMax الجاهزة">
                      {s.voices.filter((v) => v.group === "minimax").map((v) => <option key={v.value} value={v.value}>{v.name}</option>)}
                    </optgroup>
                  )}
                </select>
                <VoiceDesigner projectId={projectId} speaker={sp} disabled={Boolean(busy)} onCast={async (value) => { await cast(sp, value); await load(); }} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs font-bold text-muted">
          تريد صوتًا خاصًا؟ صمّمه بالوصف أو انسخه من تسجيل في <a className="underline" href="/jawad-ai/audio" target="_blank" rel="noopener">استوديو الصوت</a>، ثم ارجع هنا واختره.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-muted">{lines.length} جملة · {s?.audios.length ?? 0} جاهزة</p>
        <button
          type="button"
          className="btn btn-primary min-h-10 px-4 text-sm"
          disabled={Boolean(busy) || !s || missing.length > 0}
          onClick={() => speak(lines.filter((l) => !audioOf(l.key)).map((l) => l.key))}
          title={missing.length ? `اختر صوتًا لـ${missing.join("، ")}` : undefined}
        >
          {busy ? "يولّد…" : "ولّد كل الجمل الناقصة"}
        </button>
      </div>
      {error && <p className="error-box" role="alert">{error}</p>}

      {groups.map((g) => (
        <section key={g} className="card space-y-3 p-4" aria-label={lines.find((l) => l.genId === g)?.genName || g}>
          <h2 className="font-extrabold">{lines.find((l) => l.genId === g)?.genName || g}</h2>
          <ol className="space-y-3">
            {lines.filter((l) => l.genId === g).map((l) => {
              const a = audioOf(l.key);
              const stale = a && a.text !== l.line;
              return (
                <li key={l.key} className="space-y-2 rounded-2xl border border-line p-3" data-line={l.key}>
                  <p className="text-sm"><span className="font-extrabold">{l.speaker}:</span> <span dir="rtl">{l.line}</span></p>
                  <EmotionPicker value={feel[l.key] ?? ""} onChange={(v) => setFeel({ ...feel, [l.key]: v })} disabled={Boolean(busy)} />
                  {a?.url && <audio controls preload="none" src={a.url} className="w-full" />}
                  {stale && <p className="text-xs font-bold text-muted">تغيّرت الجملة بعد توليد صوتها؛ ولّدها من جديد.</p>}
                  <button type="button" className="btn btn-secondary min-h-10 px-4 text-sm" disabled={Boolean(busy) || !s?.cast[l.speaker]} onClick={() => speak([l.key])}>
                    {busy === l.key ? "يولّد…" : a ? "ولّد من جديد" : "ولّد الصوت"}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
