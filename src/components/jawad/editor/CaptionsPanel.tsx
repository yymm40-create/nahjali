"use client";

import { useRef, useState } from "react";
import { CAPTION_STYLES, clipLength, formatTime, type CaptionStyle, type Clip, type Timeline } from "@/lib/editor/model";
import { postJson } from "@/lib/fetch";
import Dialog from "../Dialog";
import Icon from "../Icon";
import { putWithProgress } from "../studio/upload";
import { extractSound, onTimeline, parseSRT, phrases, toSRT, verses, type SpokenWord } from "./captions";
import type { Run } from "./Inspector";
import type { EditorAsset } from "./types";

type Tab = "auto" | "poem" | "srt";
const LANGS = [
  ["ar", "عربي"],
  ["en", "English"],
  ["", "تلقائي"],
] as const;

/** «كابشن»: what is said, written on the video word by word; a poem's verses on its recitation; SRT in and out. */
export default function CaptionsPanel({ open, onClose, projectId, tl, assets, run, flash }: { open: boolean; onClose: () => void; projectId: string; tl: Timeline; assets: Map<string, EditorAsset>; run: Run; flash: (t: string, bad?: boolean) => void }) {
  const [tab, setTab] = useState<Tab>("auto");
  const [lang, setLang] = useState<string>("ar");
  const [style, setStyle] = useState<CaptionStyle>("karaoke");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [poem, setPoem] = useState("");
  const [poemClip, setPoemClip] = useState<string>("");
  const [skip, setSkip] = useState<string[]>([]);
  const srtInput = useRef<HTMLInputElement>(null);

  // clips we can hear (their sound is what gets written)
  const sources: { clip: Clip; asset: EditorAsset }[] = tl.tracks.flatMap((t) =>
    t.muted || t.kind === "text"
      ? []
      : t.clips.flatMap((c) => {
          const a = c.assetId ? assets.get(c.assetId) : null;
          return a && a.kind !== "image" && a.hasAudio && a.url && c.volume > 0 ? [{ clip: c, asset: a }] : [];
        }),
  );
  const chosen = sources.filter((s) => !skip.includes(s.clip.id));
  const minutes = chosen.reduce((m, s) => m + (s.clip.out - s.clip.in) / 60_000, 0);
  const poemSource = sources.find((s) => s.clip.id === poemClip) ?? sources[0];
  const hasText = tl.tracks.some((t) => t.kind === "text" && t.clips.some((c) => c.text?.body.trim()));

  /** The clip's sound, uploaded for one use; returns its path. */
  const upload = async (s: { clip: Clip; asset: EditorAsset }, label: string) => {
    setBusy(`${label}: نجهّز الصوت…`);
    const { blob, format } = await extractSound(s.asset.url!, s.clip.in, s.clip.out, (p) => setBusy(`${label}: نجهّز الصوت ${Math.round(p * 100)}٪`));
    const sign = await postJson<{ path: string; mime: string; signedUrl: string }>(`/api/jawad/editor/projects/${projectId}`, { action: "speech_sign", format });
    await putWithProgress(sign.signedUrl, new File([blob], `sound.${format}`, { type: sign.mime }), sign.mime, (p) => setBusy(`${label}: نرفع الصوت ${Math.round(p * 100)}٪`));
    return sign.path;
  };

  const auto = async () => {
    setError(null);
    const heard: SpokenWord[] = [];
    try {
      for (const [i, s] of chosen.entries()) {
        const label = chosen.length > 1 ? `المقطع ${i + 1} من ${chosen.length}` : "المقطع";
        const ask = (path?: string) =>
          postJson<{ words?: SpokenWord[]; need?: "audio" }>(`/api/jawad/editor/projects/${projectId}`, { action: "transcribe", assetId: s.asset.id, from: s.clip.in, to: s.clip.out, language: lang, path });
        let r = await ask();
        if (r.need) {
          const path = await upload(s, label);
          setBusy(`${label}: نسمع ونكتب…`);
          r = await ask(path);
        }
        heard.push(...onTimeline(s.clip, r.words ?? []));
      }
      if (!heard.length) throw new Error("ما سمعنا كلامًا واضحًا في المقاطع المختارة.");
      const items = phrases(heard, tl.height > tl.width ? 4 : 7);
      run({ type: "add_captions", items, style }, { label: `كابشن تلقائي (${items.length} جملة)` });
      flash(`كتبنا ${heard.length} كلمة في ${items.length} جملة. تقدر تعدّل أي جملة بالضغط عليها.`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
    } finally {
      setBusy(null);
    }
  };

  const syncPoem = async () => {
    if (!poemSource) return;
    setError(null);
    try {
      const path = await upload(poemSource, "القصيدة");
      setBusy("نطابق الأبيات على الإلقاء…");
      const r = await postJson<{ words: SpokenWord[] }>(`/api/jawad/editor/projects/${projectId}`, { action: "align", assetId: poemSource.asset.id, from: poemSource.clip.in, to: poemSource.clip.out, text: poem.trim(), path });
      const timed = onTimeline(poemSource.clip, r.words);
      const items = verses(poem, timed) ?? phrases(timed, 8);
      if (!items.length) throw new Error("ما قدرنا نطابق الأبيات؛ تأكد إنها نفس الكلام المقروء.");
      run({ type: "add_captions", items, style: style === "karaoke" ? "poem" : style, name: "الأبيات" }, { label: `أبيات القصيدة (${items.length})` });
      flash(`زامنّا ${items.length} بيت على الإلقاء.`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
    } finally {
      setBusy(null);
    }
  };

  const exportSRT = () => {
    const blob = new Blob([toSRT(tl)], { type: "application/x-subrip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "captions.srt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const importSRT = async (f: File) => {
    const items = parseSRT(await f.text());
    if (!items.length) return setError("ما لقينا ترجمات في هذا الملف (SRT أو VTT).");
    run({ type: "add_captions", items, style: style === "karaoke" ? "classic" : style, name: f.name.replace(/\.[^.]+$/, "").slice(0, 30) || "ترجمة" }, { label: `ترجمة من ملف (${items.length})` });
    flash(`أضفنا ${items.length} سطر ترجمة.`);
    onClose();
  };

  const styles = (
    <div className="space-y-1.5">
      <span className="text-xs text-jw-muted">الشكل</span>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(CAPTION_STYLES) as CaptionStyle[]).map((k) => {
          const st = CAPTION_STYLES[k].style;
          return (
            <button key={k} type="button" aria-pressed={style === k} onClick={() => setStyle(k)} className={`rounded-lg border px-2.5 py-1.5 text-xs ${style === k ? "border-jw-accent bg-jw-accent/10" : "border-jw-line"}`}>
              <span style={{ color: st.color, background: st.box ?? undefined, fontWeight: st.weight }} className="rounded px-1">
                كلام{" "}
                <span style={{ color: st.highlight ?? st.color }}>جميل</span>
              </span>
              <span className="block text-[10px] text-jw-muted">{CAPTION_STYLES[k].label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} title="الكابشن">
      <div className="space-y-4 p-4">
        <div className="jw-seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "auto"} onClick={() => setTab("auto")}>تلقائي من الكلام</button>
          <button type="button" role="tab" aria-selected={tab === "poem"} onClick={() => setTab("poem")}>مزامنة قصيدة</button>
          <button type="button" role="tab" aria-selected={tab === "srt"} onClick={() => setTab("srt")}>ملف SRT</button>
        </div>

        {tab === "auto" && (
          <div className="space-y-3">
            <p className="text-xs leading-6 text-jw-muted">نسمع الكلام في مقاطعك ونكتبه على الفيديو، كل جملة في وقتها والكلمة اللي تنقال تضيء. يدعم العربي بلهجاته.</p>
            {sources.length ? (
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {sources.map((s) => (
                  <li key={s.clip.id}>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" className="accent-[var(--jw-accent)]" checked={!skip.includes(s.clip.id)} onChange={(e) => setSkip((x) => (e.target.checked ? x.filter((id) => id !== s.clip.id) : [...x, s.clip.id]))} />
                      <span className="min-w-0 flex-1 truncate" dir="auto">{s.asset.name || "مقطع"}</span>
                      <span className="tabular-nums text-jw-muted" dir="ltr">{formatTime(s.clip.start, false)} · {formatTime(clipLength(s.clip), false)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-jw-warn">ما فيه مقاطع فيها صوت في التايملاين.</p>
            )}
            <div className="jw-seg" role="radiogroup" aria-label="اللغة">
              {LANGS.map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={lang === k} onClick={() => setLang(k)}>{label}</button>
              ))}
            </div>
            {styles}
            <button type="button" className="jw-btn jw-btn-primary w-full" disabled={!!busy || !chosen.length} onClick={auto}>
              {busy ? <span className="jw-spinner" /> : <Icon name="sparkles" size={16} />} {busy ?? `أنشئ الكابشن (${Math.ceil(minutes)} دقيقة)`}
            </button>
          </div>
        )}

        {tab === "poem" && (
          <div className="space-y-3">
            <p className="text-xs leading-6 text-jw-muted">الصق أبيات القصيدة (كل بيت في سطر) واختر مقطع الإلقاء: نطابق كل كلمة على وقت قولها، فيطلع كل بيت في لحظته بالضبط.</p>
            {sources.length > 1 && (
              <select className="jw-select w-full text-sm" value={poemSource?.clip.id ?? ""} onChange={(e) => setPoemClip(e.target.value)}>
                {sources.map((s) => (
                  <option key={s.clip.id} value={s.clip.id}>{s.asset.name || "مقطع"} · {formatTime(s.clip.start, false)}</option>
                ))}
              </select>
            )}
            <textarea className="jw-textarea min-h-40 w-full text-sm leading-7" dir="rtl" value={poem} onChange={(e) => setPoem(e.target.value)} placeholder={"قِفا نَبكِ مِن ذِكرى حَبيبٍ وَمَنزِلِ\nبِسِقطِ اللِوى بَينَ الدَخولِ فَحَومَلِ"} />
            {styles}
            <button type="button" className="jw-btn jw-btn-primary w-full" disabled={!!busy || !poem.trim() || !poemSource} onClick={syncPoem}>
              {busy ? <span className="jw-spinner" /> : "📜"} {busy ?? "زامن الأبيات"}
            </button>
          </div>
        )}

        {tab === "srt" && (
          <div className="space-y-3">
            <button type="button" className="jw-btn w-full" disabled={!hasText} onClick={exportSRT}>
              <Icon name="download" size={16} /> نزّل الكابشن ملف SRT (لليوتيوب وغيره)
            </button>
            <input ref={srtInput} type="file" accept=".srt,.vtt,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && importSRT(e.target.files[0])} />
            {styles}
            <button type="button" className="jw-btn w-full" onClick={() => srtInput.current?.click()}>
              <Icon name="upload" size={16} /> ارفع ملف ترجمة (SRT أو VTT)
            </button>
          </div>
        )}

        {error && <p className="error-box text-sm">{error}</p>}
        <p className="text-[11px] text-jw-faint">مجاني حاليًا، حتى {120} دقيقة تفريغ في اليوم.</p>
      </div>
    </Dialog>
  );
}
