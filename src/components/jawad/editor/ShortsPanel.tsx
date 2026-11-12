"use client";

// «طلّع مقاطع قصيرة» (the OpusClip way) and «ابحث في الكلام», one window in the right column (a dialog on a phone).
// Shorts: a long file's written words are read by حيدرا ماكس (the price first; its words need writing first, at
// «كابشن»'s price) and the standalone moments come back with a title, an estimated score, its reasons and one tip;
// each is previewed (the playhead jumps there, or a small player when the file isn't on the timeline) and «سوّه مقطع»
// makes it a new timeline — 9:16 following the face, with captions from the words already written (free).
// Search: every place some words are said across the files whose words are written (free); «ضيفه» puts that sentence
// at the playhead.

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { formatTime, type Timeline } from "@/lib/editor/model";
import type { AssetSpeech } from "@/lib/editor/transcript";
import { placeRange, rangeClip, readLengths, REASON_KINDS, searchSpeech, SHORT_COUNT, SHORT_LEN, shortCommands, whereOnTimeline, wordsInShort, type Hit, type Moment } from "@/lib/editor/shorts";
import { coinStr } from "@config/coins";
import { postJson } from "@/lib/fetch";
import { track } from "@/lib/feature-track";
import DockFrame from "./DockFrame";
import Icon from "../Icon";
import { spokenWords } from "./captions-make";
import { phrases } from "./captions";
import { reframeCandidates, reframeClips, stillThere } from "./reframe-run";
import { SHORTS_EVENT, type ShortsAsk, type ShortsTab } from "./shorts-ask";
import type { Run } from "./Inspector";
import type { PlayerLike } from "./Timeline";
import type { EditorAsset } from "./types";

const LANGS = [
  ["ar", "عربي"],
  ["en", "English"],
  ["", "تلقائي"],
] as const;
const CAPTION_LOOKS = [
  ["karaoke", "كلمة كلمة"],
  ["pop2", "كلمتين كلمتين"],
  ["classic", "عادي"],
] as const;
type Look = (typeof CAPTION_LOOKS)[number][0];

interface Quote {
  coins: number;
  minutes: number;
  need: "transcript" | null;
  kept: { at: string; min: number; max: number; moments: Moment[] } | null;
}

const secs = (ms: number) => `${Math.round(ms / 1000)} ث`;
const tone = (score: number) => (score >= 80 ? "bg-jw-ok/20 text-jw-ok" : score >= 60 ? "bg-jw-accent/20 text-jw-accent" : "bg-jw-warn/20 text-jw-warn");

export default function ShortsPanel({ dock, open, onOpen, onClose, projectId, tl, assets, run, flash, player, readOnly }: { dock?: HTMLElement | null; open: boolean; onOpen: () => void; onClose: () => void; projectId: string; tl: Timeline; assets: Map<string, EditorAsset>; run: Run; flash: (t: string, bad?: boolean) => void; player: PlayerLike | null; readOnly: boolean }) {
  const [tab, setTab] = useState<ShortsTab>("shorts");
  const [speech, setSpeech] = useState<Record<string, AssetSpeech> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const tlRef = useRef(tl);
  const assetsRef = useRef(assets);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    tlRef.current = tl;
    assetsRef.current = assets;
    onOpenRef.current = onOpen;
  }, [tl, assets, onOpen]);

  // the files with sound, longest first (a short comes from a long one)
  const files = useMemo(() => [...assets.values()].filter((a) => a.status === "ready" && a.kind !== "image" && a.hasAudio && a.url).sort((x, y) => (y.durationMs ?? 0) - (x.durationMs ?? 0)), [assets]);

  // ───────── the written words of every file (free) ─────────
  const loadSpeech = useCallback(async () => {
    try {
      const r = await postJson<{ speech: Record<string, AssetSpeech> }>(`/api/jawad/editor/projects/${projectId}`, { action: "transcripts", clips: [] });
      setSpeech(r.speech);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ما قدرنا نجيب الكلام المكتوب.");
    }
  }, [projectId]);
  // read again each time the window opens (words may have been written meanwhile in «النص» or «الكابشن»)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void loadSpeech(), 0);
    return () => clearTimeout(t);
  }, [open, loadSpeech]);

  // ───────── shorts: the file, the range, the price ─────────
  const [assetId, setAssetId] = useState<string | null>(null);
  const [len, setLen] = useState<{ min: number; max: number }>({ min: SHORT_LEN.min, max: SHORT_LEN.max });
  const [count, setCount] = useState<number>(SHORT_COUNT.default);
  const [lang, setLang] = useState<string>("ar");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [moments, setMoments] = useState<{ list: Moment[]; old: boolean } | null>(null);
  const file = (assetId ? assets.get(assetId) : null) ?? files[0] ?? null;
  const [listenPrice, setListenPrice] = useState<number | null>(null);

  // ───────── search ─────────
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const tracked = useRef("");

  // asked from elsewhere (the library's search box, حيدرا ماكس)
  useEffect(() => {
    const on = (e: Event) => {
      const a = (e as CustomEvent<ShortsAsk>).detail;
      if (!a) return;
      setTab(a.tab);
      if (a.assetId && assetsRef.current.has(a.assetId)) setAssetId(a.assetId);
      if (a.min || a.max) setLen(readLengths(a.min ?? SHORT_LEN.min, a.max ?? SHORT_LEN.max));
      if (typeof a.query === "string") setQuery(a.query);
      onOpenRef.current();
    };
    window.addEventListener(SHORTS_EVENT, on);
    return () => window.removeEventListener(SHORTS_EVENT, on);
  }, []);

  const fileId = file?.id ?? null;
  const askQuote = useCallback(async () => {
    if (!fileId) return;
    setError(null);
    try {
      const q = await postJson<Quote>(`/api/jawad/editor/projects/${projectId}`, { action: "shorts", quote: true, assetId: fileId });
      setQuote(q);
      setMoments(q.kept?.moments.length ? { list: q.kept.moments, old: true } : null);
      if (q.need) {
        const f = assetsRef.current.get(fileId);
        const r = await postJson<{ price: number }>(`/api/jawad/editor/projects/${projectId}`, { action: "transcripts", clips: [{ assetId: fileId, from: 0, to: f?.durationMs ?? 0 }] });
        setListenPrice(r.price);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
    }
  }, [fileId, projectId]);
  useEffect(() => {
    if (!open || tab !== "shorts" || !fileId) return;
    const t = setTimeout(() => {
      setQuote(null);
      setMoments(null);
      void askQuote();
    }, 0);
    return () => clearTimeout(t);
  }, [open, tab, fileId, askQuote]);

  /** «اكتب الكلام»: the whole file listened to (its price shown on the button), then the price of the shorts asked again. */
  const listen = async () => {
    if (!file) return;
    setError(null);
    try {
      await spokenWords(projectId, { clip: rangeClip(file.id, 0, file.durationMs ?? 0), asset: file }, lang, "الفيديو", setBusy);
      await loadSpeech();
      await askQuote();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
    } finally {
      setBusy(null);
    }
  };

  /** «طلّع المقاطع» at the price shown (a higher one is shown and asked again). */
  const find = async () => {
    if (!file || !quote) return;
    setError(null);
    setBusy("حيدرا ماكس يقرأ الفيديو ويدوّر على أقوى اللحظات…");
    try {
      const res = await fetch(`/api/jawad/editor/projects/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "shorts", assetId: file.id, min: len.min, max: len.max, count, lang: lang || undefined, expectedCoins: quote.coins }),
      }).catch(() => null);
      if (!res) throw new Error("ما وصلنا للخادم؛ تأكد من النت وجرّب مرة ثانية (ما انخصم شي).");
      const r = (await res.json().catch(() => ({}))) as { moments?: Moment[]; code?: string; coins?: number; error?: string };
      if (res.status === 409 && r.code === "price_changed" && typeof r.coins === "number") {
        setQuote({ ...quote, coins: r.coins });
        throw new Error(`السعر صار ${coinStr(r.coins)}؛ اضغط مرة ثانية إذا موافق.`);
      }
      if (!res.ok || !Array.isArray(r.moments)) throw new Error(r.error ?? `تعذّر (${res.status}).`);
      setMoments({ list: r.moments, old: false });
      track("editor.shorts_find");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
    } finally {
      setBusy(null);
    }
  };

  // ───────── preview: the playhead jumps there, or a small player when the file isn't on the timeline ─────────
  const [peek, setPeek] = useState<{ assetId: string; s: number; e: number } | null>(null);
  const preview = (id: string, s: number, e: number, at = s) => {
    const on = whereOnTimeline(tlRef.current, id, at);
    if (on != null && player) {
      setPeek(null);
      player.seek(on);
      flash(`المؤشر راح لـ ${formatTime(on, false)} — شغّل وشوف.`);
      return;
    }
    setPeek({ assetId: id, s, e });
  };
  const peekFile = peek ? assets.get(peek.assetId) : null;

  // ───────── «سوّه مقطع» ─────────
  const [making, setMaking] = useState<string | null>(null);
  const [vertical, setVertical] = useState(true);
  const [captions, setCaptions] = useState(true);
  const [look, setLook] = useState<Look>("karaoke");
  const abort = useRef<AbortController | null>(null);
  const make = async (m: Moment) => {
    const a = assets.get(m.assetId);
    if (!a || readOnly) return;
    const tall = vertical && a.kind === "video";
    const words = speech?.[m.assetId]?.words ?? [];
    const items = captions ? phrases(wordsInShort(words, m.s, m.e), look === "pop2" ? 2 : tall || tl.height > tl.width ? 4 : 7) : null;
    const made = run(shortCommands(m, { ratio: tall ? "9:16" : null, captions: items, style: look }), { label: `مقطع قصير: ${m.title.slice(0, 30)}` }) as { timeline: Timeline } | null;
    if (!made) return;
    track("editor.shorts_make");
    setMaking(null);
    if (!tall) return flash(`سوّيت «${m.title}» في تسلسل جديد.`);
    const picked = reframeCandidates(made.timeline, assets);
    if (!picked.length) return flash(`سوّيت «${m.title}» في تسلسل جديد.`);
    abort.current = new AbortController();
    try {
      const r = await reframeClips(made.timeline, picked, (text) => setBusy(text), abort.current.signal);
      const cmds = stillThere(tlRef.current, r.commands);
      if (cmds.length) run(cmds, { label: "اتبع الوجه" });
      if (cmds.length) track("editor.auto_reframe");
      flash(r.noFace.length ? `سوّيت «${m.title}»؛ ما لقيت وجه أتبعه فخليت الصورة في النص.` : `سوّيت «${m.title}» طولي والكاميرا تتبع الوجه.`);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") flash(e instanceof Error ? e.message : "ما قدرنا نتبع الوجه؛ المقطع انسوّى بدونه.", true);
    } finally {
      abort.current = null;
      setBusy(null);
    }
  };

  // ───────── search results ─────────
  const order = useMemo(() => files.map((f) => f.id), [files]);
  const durations = useMemo(() => Object.fromEntries(files.map((f) => [f.id, f.durationMs])), [files]);
  const hits: Hit[] = useMemo(() => (speech && tab === "search" ? searchSpeech(speech, deferred, { order, durations }) : []), [speech, tab, deferred, order, durations]);
  const unwritten = files.filter((f) => !speech?.[f.id]?.words.length).length;
  const hitFiles = new Set(hits.map((h) => h.assetId)).size;
  const noteSearch = () => {
    const q = query.trim();
    if (q && tracked.current !== q) {
      tracked.current = q;
      track("editor.speech_search");
    }
  };
  const add = (h: Hit) => {
    const r = run(placeRange(h.assetId, h.s, h.e, player?.ms ?? 0), { label: `أضفت «${h.match.slice(0, 24)}»` });
    if (r) track("editor.speech_search_add");
  };

  const needText = quote?.need === "transcript";
  const short = file && (file.durationMs ?? 0) < len.min * 2000;

  return (
    <DockFrame dock={dock} open={open} onClose={() => (abort.current?.abort(), !busy && onClose())} title={tab === "shorts" ? "مقاطع قصيرة" : "ابحث في الكلام"}>
      <div className="space-y-3 p-4">
        <div className="jw-seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "shorts"} onClick={() => setTab("shorts")}>
            ✂️ طلّع مقاطع قصيرة
          </button>
          <button type="button" role="tab" aria-selected={tab === "search"} onClick={() => setTab("search")}>
            🔎 ابحث في الكلام
          </button>
        </div>

        {peek && peekFile?.url && (
          <div className="sticky top-0 z-10 space-y-1 rounded-xl bg-jw-surface/95 p-1.5 backdrop-blur">
            {peekFile.kind === "video" ? (
              <video
                key={`${peek.assetId}:${peek.s}`}
                src={peekFile.url}
                controls
                autoPlay
                playsInline
                className="max-h-56 w-full rounded-lg bg-black"
                onLoadedMetadata={(e) => (e.currentTarget.currentTime = peek.s / 1000)}
                onTimeUpdate={(e) => e.currentTarget.currentTime >= peek.e / 1000 && e.currentTarget.pause()}
              />
            ) : (
              <audio key={`${peek.assetId}:${peek.s}`} src={peekFile.url} controls autoPlay className="w-full" onLoadedMetadata={(e) => (e.currentTarget.currentTime = peek.s / 1000)} onTimeUpdate={(e) => e.currentTarget.currentTime >= peek.e / 1000 && e.currentTarget.pause()} />
            )}
            <div className="flex items-center justify-between text-[11px] text-jw-muted">
              <span>الملف مو في التايملاين المفتوح؛ هذي معاينة الجزء ({secs(peek.e - peek.s)})</span>
              <button type="button" className="jw-btn jw-btn-quiet !min-h-7 text-[11px]" onClick={() => setPeek(null)}>
                إغلاق
              </button>
            </div>
          </div>
        )}

        {tab === "shorts" ? (
          <>
            <p className="text-xs leading-6 text-jw-muted">من فيديو طويل (بودكاست، درس، لقاء) يطلّع لك حيدرا ماكس أقوى اللحظات اللي تنفع ريلز لحالها، كل وحدة بعنوان ودرجة وسببها ونصيحة. البداية والنهاية على آخر الجملة، ما تنقطع كلمة.</p>
            {!files.length ? (
              <p className="text-xs text-jw-warn">ما فيه فيديو أو صوت فيه كلام في مكتبة المشروع. ارفع الفيديو الطويل أول.</p>
            ) : (
              <div className="space-y-2.5 rounded-xl border border-jw-line p-2.5">
                <label className="block space-y-1 text-xs">
                  <span className="text-jw-muted">الفيديو الطويل</span>
                  <select className="jw-input w-full text-xs" value={file?.id ?? ""} disabled={!!busy} onChange={(e) => setAssetId(e.target.value)}>
                    {files.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} · {formatTime(f.durationMs ?? 0, false)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap items-end gap-2 text-xs">
                  <label className="space-y-1">
                    <span className="block text-jw-muted">طول المقطع من (ث)</span>
                    <input type="number" inputMode="numeric" className="jw-input w-20 text-xs" min={SHORT_LEN.floor} max={SHORT_LEN.ceil} value={len.min} onChange={(e) => setLen((l) => ({ ...l, min: Number(e.target.value) }))} onBlur={() => setLen((l) => readLengths(l.min, l.max))} />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-jw-muted">إلى (ث)</span>
                    <input type="number" inputMode="numeric" className="jw-input w-20 text-xs" min={SHORT_LEN.floor} max={SHORT_LEN.ceil} value={len.max} onChange={(e) => setLen((l) => ({ ...l, max: Number(e.target.value) }))} onBlur={() => setLen((l) => readLengths(l.min, l.max))} />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-jw-muted">كم مقطع (لين)</span>
                    <select className="jw-input w-20 text-xs" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                      {Array.from({ length: SHORT_COUNT.max - SHORT_COUNT.min + 1 }, (_, i) => SHORT_COUNT.min + i).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="jw-seg" role="radiogroup" aria-label="اللغة">
                  {LANGS.map(([k, label]) => (
                    <button key={k} type="button" role="radio" aria-checked={lang === k} onClick={() => setLang(k)}>
                      {label}
                    </button>
                  ))}
                </div>

                {!quote && !error && (
                  <p className="flex items-center gap-2 text-xs text-jw-muted">
                    <span className="jw-spinner" /> نشوف الملف…
                  </p>
                )}
                {short && <p className="text-[11px] text-jw-warn">هذا الملف قصير على هالطول؛ المقاطع القصيرة تطلع من فيديو أطول.</p>}
                {quote && needText && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] leading-5 text-jw-muted">لازم نكتب كلام الفيديو كامل أول (نفس سماع «الكابشن»، وينحفظ مع الملف فما يتكرر سعره، وبعدها البحث والكابشن منه مجانًا).</p>
                    <button type="button" className="jw-btn jw-btn-primary w-full" disabled={!!busy || readOnly} onClick={listen}>
                      {busy ? <span className="jw-spinner" /> : <Icon name="sparkles" size={16} />} {busy ?? `اكتب الكلام (${quote.minutes} دقيقة) · ${listenPrice ? coinStr(listenPrice) : "مجاني"}`}
                    </button>
                  </div>
                )}
                {quote && !needText && (
                  <button type="button" className="jw-btn jw-btn-primary w-full" disabled={!!busy || readOnly || !!short} onClick={find}>
                    {busy ? <span className="jw-spinner" /> : <Icon name="scissors" size={16} />} {busy ?? `${moments ? "طلّع من جديد" : "طلّع المقاطع"} · ${quote.coins ? coinStr(quote.coins) : "مجاني"}`}
                  </button>
                )}
              </div>
            )}

            {moments && (
              <div className="space-y-2">
                <p className="rounded-lg bg-jw-surface-2 p-2 text-[11px] leading-5 text-jw-muted">
                  ⚠️ الدرجة تقدير من حيدرا ماكس لقوة المقطع، مو وعد بالمشاهدات. {moments.old ? "هذي المقاطع من آخر مرة (بدون سعر)." : ""}
                </p>
                <ol className="space-y-2">
                  {moments.list.map((m) => (
                    <li key={m.id} className="space-y-1.5 rounded-xl border border-jw-line p-2.5">
                      <div className="flex items-start gap-2">
                        <span className={`shrink-0 rounded-lg px-2 py-1 text-sm font-bold tabular-nums ${tone(m.score)}`} title="درجة تقديرية من ٩٩">
                          {m.score}
                        </span>
                        <div className="min-w-0 flex-1">
                          <b className="block text-sm leading-6" dir="auto">
                            {m.title}
                          </b>
                          <span className="text-[11px] tabular-nums text-jw-faint" dir="ltr">
                            {formatTime(m.s, false)} – {formatTime(m.e, false)} · {secs(m.e - m.s)}
                          </span>
                        </div>
                      </div>
                      <ul className="flex flex-wrap gap-1">
                        {m.reasons.map((r, i) => (
                          <li key={i} className="rounded-full bg-jw-surface-2 px-2 py-0.5 text-[11px] leading-5">
                            <b className="text-jw-muted">{REASON_KINDS[r.kind]}:</b> <span dir="auto">{r.text}</span>
                          </li>
                        ))}
                      </ul>
                      {m.tip && (
                        <p className="text-[11px] leading-5 text-jw-ink" dir="auto">
                          💡 {m.tip}
                        </p>
                      )}
                      {m.text && (
                        <p className="line-clamp-2 text-[11px] leading-5 text-jw-faint" dir="auto">
                          «{m.text}»
                        </p>
                      )}
                      <div className="flex gap-1.5">
                        <button type="button" className="jw-btn !min-h-8 flex-1 text-xs" onClick={() => preview(m.assetId, m.s, m.e)}>
                          <Icon name="play" size={14} /> عاين
                        </button>
                        <button type="button" className="jw-btn jw-btn-primary !min-h-8 flex-1 text-xs" disabled={readOnly || !!busy} onClick={() => setMaking((x) => (x === m.id ? null : m.id))}>
                          <Icon name="scissors" size={14} /> سوّه مقطع
                        </button>
                      </div>
                      {making === m.id && (
                        <div className="space-y-2 rounded-lg bg-jw-surface-2/70 p-2 text-xs">
                          {assets.get(m.assetId)?.kind === "video" && (
                            <label className="flex items-center gap-2">
                              <input type="checkbox" className="accent-[var(--jw-accent)]" checked={vertical} onChange={(e) => setVertical(e.target.checked)} />
                              طولي 9:16 والكاميرا تتبع الوجه («اتبع الوجه»، مجاني)
                            </label>
                          )}
                          <label className="flex items-center gap-2">
                            <input type="checkbox" className="accent-[var(--jw-accent)]" checked={captions} onChange={(e) => setCaptions(e.target.checked)} />
                            كابشن · مجاني (الكلام مكتوب من قبل)
                          </label>
                          {captions && (
                            <div className="jw-seg" role="radiogroup" aria-label="شكل الكابشن">
                              {CAPTION_LOOKS.map(([k, label]) => (
                                <button key={k} type="button" role="radio" aria-checked={look === k} onClick={() => setLook(k)}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}
                          <p className="text-[11px] leading-5 text-jw-muted">ينفتح في تسلسل جديد باسم المقطع، والتايملاين الأصلي يبقى مثل ما هو (من تبويبات التسلسلات تحت).</p>
                          <button type="button" className="jw-btn jw-btn-primary w-full !min-h-8 text-xs" disabled={readOnly || !!busy} onClick={() => void make(m)}>
                            سوّه
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        ) : (
          <>
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                noteSearch();
              }}
            >
              <input className="jw-input min-w-0 flex-1 text-sm" dir="auto" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="اكتب كلمة أو جملة قالها…" aria-label="ابحث في الكلام" />
            </form>
            <p className="text-[11px] leading-5 text-jw-muted">يدوّر في كلام كل الملفات المكتوب كلامها (مجاني): «أ» و«ا» واحد، «ة» و«ه» واحد، «ى» و«ي» واحد، وجزء الكلمة يكفي.</p>
            {!speech && !error && (
              <p className="flex items-center gap-2 text-xs text-jw-muted">
                <span className="jw-spinner" /> نجيب الكلام المكتوب…
              </p>
            )}
            {speech && unwritten > 0 && <p className="text-[11px] text-jw-warn">{unwritten === 1 ? "ملف واحد ما انكتب كلامه" : `${unwritten} ملفات ما انكتب كلامها`} فما يدخل البحث — اكتبه من «النص» أو «الكابشن» أو «طلّع مقاطع قصيرة».</p>}
            {speech && deferred.trim().length >= 2 && (
              <p className="text-xs font-bold">{hits.length ? `${hits.length}${hits.length >= 200 ? "+" : ""} مكان في ${hitFiles} ${hitFiles > 1 ? "ملفات" : "ملف"}` : "ما لقينا هالكلام."}</p>
            )}
            <ul className="space-y-1.5">
              {hits.map((h) => (
                <li key={`${h.assetId}:${h.a}`} className="rounded-xl border border-jw-line p-2">
                  <button type="button" className="block w-full text-start" onClick={() => (noteSearch(), preview(h.assetId, h.s, h.e, h.at))} title="عاين">
                    <span className="flex items-center gap-1.5 text-[11px] text-jw-faint">
                      <span className="min-w-0 flex-1 truncate" dir="auto">
                        {assets.get(h.assetId)?.name ?? "ملف"}
                      </span>
                      <span className="tabular-nums" dir="ltr">
                        {formatTime(h.at, false)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-6" dir="auto">
                      {h.before} <mark className="rounded bg-jw-accent/25 px-0.5 text-jw-ink">{h.match}</mark> {h.after}
                    </span>
                  </button>
                  <div className="mt-1 flex gap-1.5">
                    <button type="button" className="jw-btn jw-btn-quiet !min-h-7 flex-1 text-[11px]" onClick={() => (noteSearch(), preview(h.assetId, h.s, h.e, h.at))}>
                      <Icon name="play" size={12} /> عاين
                    </button>
                    <button type="button" className="jw-btn !min-h-7 flex-1 text-[11px]" disabled={readOnly} onClick={() => add(h)} title="يحط الجملة كاملة عند المؤشر">
                      <Icon name="plus" size={12} /> ضيفه ({secs(h.e - h.s)})
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {error && <p className="error-box text-sm">{error}</p>}
      </div>
    </DockFrame>
  );
}
