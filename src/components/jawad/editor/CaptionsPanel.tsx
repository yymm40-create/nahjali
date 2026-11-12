"use client";

import { useEffect, useRef, useState } from "react";
import { CAPTION_STYLES, clipLength, formatTime, type CaptionStyle, type Timeline } from "@/lib/editor/model";
import DockFrame from "./DockFrame";
import Icon from "../Icon";
import { parseSRT, toSRT } from "./captions";
import { captionSources, poemCaptions, spokenCaptions, translateQuote, translateRun } from "./captions-make";
import { captionLines, captionTracks, langOf, TRANSLATE_LANGS, translatedStyle, translateUnits, TRANSLATE_BLOCK, type TranslateLang } from "@/lib/editor/caption-translate";
import Riyal from "@/components/Riyal";
import type { Run } from "./Inspector";
import type { EditorAsset } from "./types";
import { track } from "@/lib/feature-track";

type Tab = "auto" | "poem" | "translate" | "srt";
const LANGS = [
  ["ar", "عربي"],
  ["en", "English"],
  ["", "تلقائي"],
] as const;

/** «كابشن»: what is said, written on the video word by word; a poem's verses on its recitation; SRT in and out. */
export default function CaptionsPanel({ dock, open, onClose, projectId, tl, assets, run, flash }: { /** the editor's right column (a computer) */ dock?: HTMLElement | null; open: boolean; onClose: () => void; projectId: string; tl: Timeline; assets: Map<string, EditorAsset>; run: Run; flash: (t: string, bad?: boolean) => void }) {
  const [tab, setTab] = useState<Tab>("auto");
  const [lang, setLang] = useState<string>("ar");
  const [style, setStyle] = useState<CaptionStyle>("karaoke");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [poem, setPoem] = useState("");
  const [poemClip, setPoemClip] = useState<string>("");
  const [skip, setSkip] = useState<string[]>([]);
  const srtInput = useRef<HTMLInputElement>(null);
  // «ترجم الكابشن»: which caption track, into which language, and the price waiting for a yes
  const [fromTrack, setFromTrack] = useState("");
  const [toLang, setToLang] = useState<TranslateLang>("en");
  const [ask, setAsk] = useState<number | null>(null);
  // «نزّل SRT»: one caption track (a translation is its own file), or all of them together
  const [srtTrack, setSrtTrack] = useState("");
  useEffect(() => {
    if (open) track("editor.captions");
  }, [open]);

  // clips we can hear (their sound is what gets written)
  const sources = captionSources(tl, assets);
  const chosen = sources.filter((s) => !skip.includes(s.clip.id));
  const minutes = chosen.reduce((m, s) => m + (s.clip.out - s.clip.in) / 60_000, 0);
  const poemSource = sources.find((s) => s.clip.id === poemClip) ?? sources[0];
  const hasText = tl.tracks.some((t) => t.kind === "text" && t.clips.some((c) => c.text?.body.trim()));
  const capTracks = captionTracks(tl);
  const fromId = capTracks.some((t) => t.id === fromTrack) ? fromTrack : (capTracks[0]?.id ?? "");
  const lines = fromId ? captionLines(tl, fromId) : [];
  const srtId = capTracks.some((t) => t.id === srtTrack) ? srtTrack : "";

  /** The lines translated at `coins` (the price shown); a price that went up is shown again for a yes. */
  const translate = async (coins: number) => {
    setError(null);
    setAsk(null);
    const lang = langOf(toLang);
    setBusy(`نترجم ${lines.length} جملة إلى ${lang.label}…`);
    try {
      const r = await translateRun(projectId, lines, toLang, coins);
      if ("price" in r) return setAsk(r.price);
      const name = `${capTracks.find((t) => t.id === fromId)?.name ?? "كابشن"} · ${lang.label}`.slice(0, 40);
      run({ type: "add_captions", items: r.lines, style: translatedStyle(r.lines), name }, { label: `ترجمة الكابشن إلى ${lang.label} (${r.lines.length})` });
      track("editor.caption_translate");
      flash(`ترجمنا ${r.lines.length} جملة إلى ${lang.label} في مسار جديد بنفس التوقيت. الأصل باقي؛ اخفِ أي واحد منهم من رأس المسار، ونزّل الترجمة SRT من تبويب «ملف SRT».`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّرت الترجمة.");
    } finally {
      setBusy(null);
    }
  };
  /** «ترجم»: the price first; free goes straight on, a price waits for «أكّد». */
  const quoteThenAsk = async () => {
    setError(null);
    setBusy("نحسب السعر…");
    try {
      const coins = await translateQuote(projectId, lines, toLang);
      setBusy(null);
      if (coins > 0) setAsk(coins);
      else await translate(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر حساب السعر.");
      setBusy(null);
    }
  };

  const auto = async () => {
    setError(null);
    try {
      const { items, words } = await spokenCaptions(projectId, tl, chosen, lang, setBusy, style === "pop2" ? 2 : undefined);
      run({ type: "add_captions", items, style }, { label: `كابشن تلقائي (${items.length} جملة)` });
      flash(`كتبنا ${words} كلمة في ${items.length} جملة. تقدر تعدّل أي جملة بالضغط عليها.`);
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
      const items = await poemCaptions(projectId, poemSource, poem, setBusy);
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
    const blob = new Blob([toSRT(tl, srtId || undefined)], { type: "application/x-subrip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(srtId && capTracks.find((t) => t.id === srtId)?.name.replace(/[\\/:*?"<>|]+/g, "-")) || "captions"}.srt`;
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
    <DockFrame dock={dock} open={open} onClose={() => !busy && onClose()} title="الكابشن">
      <div className="space-y-4 p-4">
        <div className="jw-seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "auto"} onClick={() => setTab("auto")}>تلقائي من الكلام</button>
          <button type="button" role="tab" aria-selected={tab === "poem"} onClick={() => setTab("poem")}>مزامنة قصيدة</button>
          <button type="button" role="tab" aria-selected={tab === "translate"} onClick={() => setTab("translate")}>ترجمة</button>
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

        {tab === "translate" && (
          <div className="space-y-3">
            <p className="text-xs leading-6 text-jw-muted">نترجم كابشن مسار للغة ثانية في مسار جديد بنفس توقيت كل جملة (والكلمة اللي تنقال تضيء في وقتها تقريبًا). الأصل يبقى؛ تقدر تنزّل الترجمة ملف SRT.</p>
            {capTracks.length ? (
              <>
                {capTracks.length > 1 && (
                  <select className="jw-select w-full text-sm" value={fromId} onChange={(e) => { setFromTrack(e.target.value); setAsk(null); }} aria-label="مسار الكابشن">
                    {capTracks.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} · {t.clips.filter((c) => c.text?.body.trim()).length} جملة</option>
                    ))}
                  </select>
                )}
                <div className="space-y-1.5">
                  <span className="text-xs text-jw-muted">ترجمه إلى</span>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="لغة الترجمة">
                    {TRANSLATE_LANGS.map((l) => (
                      <button key={l.id} type="button" role="radio" aria-checked={toLang === l.id} dir="auto" onClick={() => { setToLang(l.id); setAsk(null); }} className={`jw-chip !px-2.5 !py-1 !text-xs ${toLang === l.id ? "!border-jw-accent !text-jw-ink" : ""}`}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
                {ask != null ? (
                  <div className="space-y-2 rounded-xl border border-jw-accent/50 bg-jw-accent/5 p-2.5 text-xs leading-5">
                    <p>
                      ترجمة {lines.length} جملة إلى {langOf(toLang).label}: <b className="text-jw-ink"><Riyal halalas={ask} size={13} /></b>
                      <span className="block text-jw-muted">السعر لكل {TRANSLATE_BLOCK} جملة ({translateUnits(lines.length)}×)، وإذا ما نجحت يرجع لك كامل.</span>
                    </p>
                    <div className="flex gap-1.5">
                      <button type="button" className="jw-btn jw-btn-primary flex-1 text-xs" disabled={!!busy} onClick={() => void translate(ask)}>
                        أكّد وترجم
                      </button>
                      <button type="button" className="jw-btn jw-btn-quiet text-xs" onClick={() => setAsk(null)}>إلغاء</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="jw-btn jw-btn-primary w-full" disabled={!!busy || !lines.length} onClick={quoteThenAsk}>
                    {busy ? <span className="jw-spinner" /> : "🌐"} {busy ?? `ترجم الكابشن (${lines.length} جملة)`}
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs text-jw-warn">ما فيه كابشن للحين؛ سوّه من «تلقائي من الكلام» أو ارفع ملف SRT أول.</p>
            )}
          </div>
        )}

        {tab === "srt" && (
          <div className="space-y-3">
            {capTracks.length > 1 && (
              <select className="jw-select w-full text-sm" value={srtId} onChange={(e) => setSrtTrack(e.target.value)} aria-label="أي مسار ينزل">
                <option value="">كل مسارات الكابشن مع بعض</option>
                {capTracks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
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
        {tab !== "translate" && <p className="text-[11px] text-jw-faint">مجاني حاليًا، حتى {120} دقيقة تفريغ في اليوم.</p>}
      </div>
    </DockFrame>
  );
}
