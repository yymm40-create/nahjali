"use client";

// «من فكرة لمسودة» (CapCut's «AI video maker»): one window in the right column (a dialog on a phone). The idea or a
// script, a length, a shape, a language, a voice, a style and a visual route — each route with its estimated total
// before anything runs. «حيدرا ماكس» writes the plan (its own small price, shown on the button and given back if it
// fails); the person edits every line, adds or deletes scenes and sees the price follow; on «وافق وابدأ» the parts are
// made as ordinary JAWAD AI jobs and the draft is built on the timeline as one change (draft-run.ts).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { coinStr } from "@config/coins";
import { FILM_STYLES, STYLE_FAMILIES } from "@config/film-styles";
import { track } from "@/lib/feature-track";
import {
  DRAFT_CAPTIONS,
  DRAFT_LANGS,
  DRAFT_LENGTHS,
  DRAFT_LIMITS,
  DRAFT_MOTIONS,
  DRAFT_RATIOS,
  DRAFT_ROUTES,
  DRAFT_VOICES,
  emptyScene,
  fitDurations,
  hasVoice,
  NO_VOICE,
  partLabel,
  planSeconds,
  priceGroups,
  readOptions,
  ROUTE_ORDER,
  sceneRange,
  sceneState,
  runSummary,
  type DraftLength,
  type DraftMotion,
  type DraftOptions,
  type DraftPlan,
  type DraftRoute,
  type PricedPart,
} from "@/lib/editor/draft";
import { isFont } from "@/lib/editor/fonts";
import type { Timeline } from "@/lib/editor/model";
import DockFrame from "./DockFrame";
import Icon from "../Icon";
import { DRAFT_EVENT, type DraftAsk } from "./draft-ask";
import { useDraftRun } from "./draft-run";
import type { EditorAsset } from "./types";

interface Quote {
  planCoins: number;
  routes: Record<DraftRoute, { coins: number; scenes: number; error: string | null }>;
  voices: string[];
  brand: { colors: string[]; fonts: string[] } | null;
}
interface Priced {
  parts: PricedPart[];
  total: number;
  issues: string[];
  error: string | null;
}

const RATIO_LABEL: Record<string, string> = { "9:16": "طولي", "16:9": "عرضي", "1:1": "مربع", "4:5": "منشور" };
const STATE_TEXT = { ready: ["جاهز", "bg-jw-ok/20 text-jw-ok"], working: ["يتجهز…", "bg-jw-accent/20 text-jw-accent"], queued: ["في الدور", "bg-jw-surface-2 text-jw-muted"], failed: ["ما نجح", "bg-jw-danger/20 text-jw-danger"], none: ["موشن بالكود", "bg-jw-surface-2 text-jw-muted"] } as const;
const price = (c: number) => (c ? coinStr(c) : "مجاني");

/** What is being written before it is approved (kept on this device: the plan was paid for). */
interface Writing {
  idea: string;
  opts: DraftOptions;
  plan: DraftPlan | null;
}
const writingKey = (projectId: string) => `jw-editor-draftplan-${projectId}`;
const DEFAULT_OPTS = readOptions({ styleId: "pixar-classic" });
function loadWriting(projectId: string): Writing | null {
  try {
    const v = JSON.parse(localStorage.getItem(writingKey(projectId)) ?? "null");
    return v && typeof v.idea === "string" && v.opts ? { idea: v.idea, opts: readOptions(v.opts), plan: v.plan ?? null } : null;
  } catch {
    return null;
  }
}

export default function DraftPanel({ dock, open, onOpen, onClose, projectId, tl, run, onAssets, flash, readOnly }: { dock?: HTMLElement | null; open: boolean; onOpen: () => void; onClose: () => void; projectId: string; tl: Timeline; run: (c: import("@/lib/editor/commands").Command[], opts: { label: string; by?: "haidara" }) => unknown; onAssets: (a: EditorAsset[]) => void; flash: (t: string, bad?: boolean) => void; readOnly: boolean }) {
  const runner = useDraftRun({ projectId, tl, run, onAssets, flash, readOnly });
  const [w, setW] = useState<Writing>({ idea: "", opts: DEFAULT_OPTS, plan: null });
  const [editing, setEditing] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [priced, setPriced] = useState<Priced | null>(null);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  // what was being written here last time comes back
  useEffect(() => {
    const t = setTimeout(() => {
      const k = loadWriting(projectId);
      if (k) {
        setW(k);
        setEditing(!!k.plan);
      }
      loaded.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, [projectId]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(writingKey(projectId), JSON.stringify(w));
    } catch {}
  }, [w, projectId]);

  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);
  useEffect(() => {
    const on = (e: Event) => {
      const a = (e as CustomEvent<DraftAsk>).detail ?? {};
      if (a.idea || a.seconds || a.ratio || a.lang) {
        setW((x) => ({ ...x, idea: a.idea?.trim() ? a.idea.slice(0, DRAFT_LIMITS.idea) : x.idea, opts: readOptions({ ...x.opts, ...(a.seconds ? { seconds: a.seconds } : {}), ...(a.ratio ? { ratio: a.ratio } : {}), ...(a.lang ? { lang: a.lang } : {}) }) }));
        if (a.idea?.trim()) setEditing(false);
      }
      track("editor.draft_open");
      onOpenRef.current();
    };
    window.addEventListener(DRAFT_EVENT, on);
    return () => window.removeEventListener(DRAFT_EVENT, on);
  }, []);

  const o = w.opts;
  const setOpt = (patch: Partial<DraftOptions>) => setW((x) => ({ ...x, opts: { ...x.opts, ...patch } }));

  // each route's price for these choices (before anything is written)
  const quoteBody = useMemo(() => JSON.stringify({ action: "draft_quote", seconds: o.seconds, ratio: o.ratio, lang: o.lang, voice: o.voice, music: o.music }), [o.seconds, o.ratio, o.lang, o.voice, o.music]);
  useEffect(() => {
    if (!open || runner.state) return;
    let live = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/jawad/editor/projects/${projectId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: quoteBody });
        const b = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok) setError(b.error ?? "تعذّر حساب السعر.");
        else setQuote(b as Quote);
      } catch {
        if (live) setError("تعذّر الاتصال.");
      }
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [open, quoteBody, projectId, runner.state]);

  // the plan priced again as it is edited
  const priceBody = useMemo(() => JSON.stringify({ action: "draft_price", ...o, plan: w.plan }), [w.plan, o]);
  useEffect(() => {
    if (!open || !editing || !w.plan || runner.state) return;
    let live = true;
    const t0 = setTimeout(() => setStale(true), 0);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/jawad/editor/projects/${projectId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: priceBody });
        const b = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok) setError(b.error ?? "تعذّر حساب السعر.");
        else {
          setPriced(b as Priced);
          setStale(false);
        }
      } catch {
        if (live) setError("تعذّر الاتصال.");
      }
    }, 700);
    return () => {
      live = false;
      clearTimeout(t0);
      clearTimeout(t);
    };
  }, [open, editing, priceBody, projectId, runner.state, w.plan]);

  const look = useMemo(() => ({ colors: quote?.brand?.colors ?? [], font: quote?.brand?.fonts.find((f) => isFont(f)) ?? null }), [quote]);

  const writePlan = async () => {
    if (!quote) return;
    setBusy("حيدرا ماكس يكتب الخطة…");
    setError(null);
    try {
      const r = await fetch(`/api/jawad/editor/projects/${projectId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "draft_plan", idea: w.idea, ...o, expectedCoins: quote.planCoins }) });
      const b = await r.json().catch(() => ({}));
      if (r.status === 409 && b.code === "price_changed") {
        setQuote({ ...quote, planCoins: Number(b.coins) || quote.planCoins });
        throw new Error(b.error);
      }
      if (!r.ok) throw new Error(b.error ?? "تعذّر.");
      track("editor.draft_plan");
      setW((x) => ({ ...x, plan: b.plan as DraftPlan }));
      setPriced(null);
      setEditing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
    } finally {
      setBusy(null);
    }
  };

  const setPlan = useCallback((fn: (p: DraftPlan) => DraftPlan) => setW((x) => (x.plan ? { ...x, plan: fn(x.plan) } : x)), []);
  const setScene = (i: number, patch: Partial<DraftPlan["scenes"][number]>) => setPlan((p) => ({ ...p, scenes: p.scenes.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));

  const approve = () => {
    if (!w.plan || !priced || stale || priced.issues.length || priced.error) return;
    runner.begin({ plan: w.plan, opts: o, look, parts: priced.parts.map((p) => ({ ...p, state: "queued", attempt: 0, jobId: null })) });
    setW((x) => ({ ...x, plan: null }));
    setEditing(false);
    setPriced(null);
  };

  const styleName = FILM_STYLES.find((s) => s.id === o.styleId)?.name;
  const range = sceneRange(o.seconds, o.route);
  const groups = priced ? priceGroups(priced.parts) : null;
  const r = runner.state;

  return (
    <DockFrame dock={dock} open={open} onClose={() => !busy && onClose()} title="من فكرة لمسودة">
      <div className="space-y-3 p-4">
        {error && (
          <p className="error-box text-xs" role="alert">
            {error}
          </p>
        )}

        {r ? (
          <RunView r={r} readOnly={readOnly} onRetry={runner.retry} onStop={runner.stop} onClear={runner.clear} onRebuild={runner.rebuild} />
        ) : !editing || !w.plan ? (
          <>
            <p className="text-xs leading-6 text-jw-muted">اكتب فكرتك أو الصق السكربت، وحيدرا ماكس يكتب لك خطة المشاهد. تعدّلها وتشوف سعرها، وما يتصنع شي لين توافق.</p>
            <label className="block space-y-1 text-xs">
              <span className="font-bold">الفكرة أو السكربت</span>
              <textarea className="jw-input min-h-28 w-full text-sm leading-6" dir="auto" maxLength={DRAFT_LIMITS.idea} value={w.idea} onChange={(e) => setW((x) => ({ ...x, idea: e.target.value }))} placeholder="مثال: ليش لازم نشرب ماء كفاية؟ ٣ أسباب بسيطة… أو الصق السكربت كامل" />
            </label>

            <Seg label="الطول" value={String(o.seconds)} items={DRAFT_LENGTHS.map((s) => [String(s), `${s} ث`])} onPick={(v) => setOpt({ seconds: Number(v) as DraftLength })} />
            <Seg label="الشكل" value={o.ratio} items={DRAFT_RATIOS.map((x) => [x, RATIO_LABEL[x]])} onPick={(v) => setOpt({ ratio: v as DraftOptions["ratio"] })} />
            <Seg label="اللغة" value={o.lang} items={Object.entries(DRAFT_LANGS)} onPick={(v) => setOpt({ lang: v as DraftOptions["lang"] })} />

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="space-y-1">
                <span className="block text-jw-muted">الصوت</span>
                <select className="jw-input w-full text-xs" value={o.voice} onChange={(e) => setOpt({ voice: e.target.value })}>
                  {DRAFT_VOICES.filter(([v]) => v !== NO_VOICE).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                  {!!quote?.voices.length && (
                    <optgroup label="أصواتي">
                      {quote.voices.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value={NO_VOICE}>بدون تعليق صوتي</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="block text-jw-muted">الستايل</span>
                <select className="jw-input w-full text-xs" value={o.styleId} onChange={(e) => setOpt({ styleId: e.target.value })}>
                  <option value="">بدون ستايل</option>
                  {STYLE_FAMILIES.map((f) => (
                    <optgroup key={f.id} label={f.name}>
                      {FILM_STYLES.filter((s) => s.family === f.id).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" className="accent-[var(--jw-accent)]" checked={o.music} onChange={(e) => setOpt({ music: e.target.checked })} />
              موسيقى خلفية (تنخفض تحت الكلام)
            </label>
            <Seg label="الكابشن" value={o.captions} items={DRAFT_CAPTIONS} onPick={(v) => setOpt({ captions: v as DraftOptions["captions"] })} />
            {quote?.brand && <BrandNote colors={quote.brand.colors} />}

            <fieldset className="space-y-1.5">
              <legend className="text-xs font-bold">طريقة الصورة (الأرخص أول)</legend>
              {ROUTE_ORDER.map((k) => (
                <RouteCard key={k} route={k} on={o.route === k} q={quote?.routes[k]} onPick={() => setOpt({ route: k })} />
              ))}
              <p className="text-[10px] leading-5 text-jw-faint">السعر تقريبي لطول {o.seconds} ثانية؛ الدقيق يطلع بعد الخطة وقبل ما يبدأ أي شي.</p>
            </fieldset>

            <button type="button" className="jw-btn jw-btn-primary w-full" disabled={readOnly || !!busy || !quote || w.idea.trim().length < 3} onClick={writePlan}>
              {busy ? <span className="jw-spinner" /> : <Icon name="wand" size={16} />} {busy ?? `اكتب الخطة · ${quote ? price(quote.planCoins) : "…"}`}
            </button>
            {w.plan && (
              <button type="button" className="jw-btn w-full text-xs" onClick={() => setEditing(true)}>
                كمّل على الخطة اللي كتبتها
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button type="button" className="jw-btn jw-btn-quiet !min-h-8 text-xs" onClick={() => setEditing(false)} disabled={!!busy}>
                <span aria-hidden>→</span> الفكرة
              </button>
              <span className="min-w-0 flex-1 truncate text-[11px] text-jw-muted">
                {DRAFT_ROUTES[o.route].icon} {DRAFT_ROUTES[o.route].label} · {o.ratio} · {o.seconds} ث{styleName ? ` · ${styleName}` : ""}
              </span>
            </div>
            <label className="block space-y-1 text-xs">
              <span className="text-jw-muted">العنوان</span>
              <input className="jw-input w-full text-sm" dir="auto" maxLength={DRAFT_LIMITS.title} value={w.plan.title} onChange={(e) => setPlan((p) => ({ ...p, title: e.target.value }))} />
            </label>

            <div className="flex items-center gap-2 rounded-xl bg-jw-surface-2 p-2 text-xs">
              <span className={`flex-1 tabular-nums ${Math.abs(planSeconds(w.plan) - o.seconds) > o.seconds * 0.1 ? "text-jw-danger" : "text-jw-muted"}`}>
                المجموع {planSeconds(w.plan)} ث من {o.seconds} ث · {w.plan.scenes.length} مشهد ({range.min}–{range.max})
              </span>
              <button type="button" className="jw-btn !min-h-7 text-[11px]" onClick={() => setPlan((p) => fitDurations(p, o.seconds, o.route))}>
                وزّع المدد
              </button>
            </div>

            <ol className="space-y-2">
              {w.plan.scenes.map((s, i) => (
                <li key={i} className="space-y-1.5 rounded-xl border border-jw-line p-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <b className="flex-1">المشهد {i + 1}</b>
                    <label className="flex items-center gap-1 text-jw-muted">
                      <input type="number" inputMode="decimal" step={0.5} min={DRAFT_ROUTES[o.route].minSec} max={DRAFT_ROUTES[o.route].maxSec} className="jw-input w-16 text-xs" value={s.seconds} onChange={(e) => setScene(i, { seconds: Math.max(0.5, Number(e.target.value) || 0) })} aria-label={`مدة المشهد ${i + 1} بالثواني`} />
                      ث
                    </label>
                    <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon !min-h-7" disabled={w.plan!.scenes.length <= 1} onClick={() => setPlan((p) => ({ ...p, scenes: p.scenes.filter((_, k) => k !== i) }))} aria-label={`احذف المشهد ${i + 1}`} title="احذف المشهد">
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                  {hasVoice(o) || o.captions !== "none" ? (
                    <textarea className="jw-input min-h-14 w-full text-xs leading-5" dir="auto" maxLength={DRAFT_LIMITS.narration} value={s.narration} onChange={(e) => setScene(i, { narration: e.target.value })} placeholder={hasVoice(o) ? "اللي ينقال بالصوت" : "الكابشن"} aria-label={`كلام المشهد ${i + 1}`} />
                  ) : null}
                  <input className="jw-input w-full text-xs" dir="auto" maxLength={DRAFT_LIMITS.onScreen} value={s.onScreen} onChange={(e) => setScene(i, { onScreen: e.target.value })} placeholder="اللي ينكتب كبير على الشاشة" aria-label={`كلام الشاشة في المشهد ${i + 1}`} />
                  {o.route === "motion" ? (
                    <div className="flex gap-1.5">
                      <select className="jw-input text-xs" value={s.motion} onChange={(e) => setScene(i, { motion: e.target.value as DraftMotion })} aria-label="شكل الموشن">
                        {Object.entries(DRAFT_MOTIONS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {s.motion === "list" && <input className="jw-input min-w-0 flex-1 text-xs" dir="auto" value={s.points.join("، ")} onChange={(e) => setScene(i, { points: e.target.value.split(/[،,]/).map((x) => x.trim()).filter(Boolean).slice(0, DRAFT_LIMITS.points) })} placeholder="البنود، بينها فاصلة" />}
                    </div>
                  ) : (
                    <textarea className="jw-input min-h-12 w-full text-[11px] leading-5" dir="ltr" maxLength={DRAFT_LIMITS.visual} value={s.visual} onChange={(e) => setScene(i, { visual: e.target.value })} placeholder="What is seen (English, for the generator)" aria-label={`وصف اللي ينشاف في المشهد ${i + 1}`} />
                  )}
                  {priced && <SceneCost parts={priced.parts.filter((p) => p.scene === i)} />}
                </li>
              ))}
            </ol>
            <button type="button" className="jw-btn w-full text-xs" disabled={w.plan.scenes.length >= range.max} onClick={() => setPlan((p) => ({ ...p, scenes: [...p.scenes, emptyScene(DRAFT_ROUTES[o.route].avgSec)] }))}>
              <Icon name="plus" size={14} /> أضف مشهد
            </button>
            {o.music && (
              <label className="block space-y-1 text-xs">
                <span className="text-jw-muted">الموسيقى (بالإنجليزي للمولّد)</span>
                <input className="jw-input w-full text-[11px]" dir="ltr" maxLength={DRAFT_LIMITS.music} value={w.plan.music} onChange={(e) => setPlan((p) => ({ ...p, music: e.target.value }))} />
              </label>
            )}
            <Seg label="طريقة الصورة" value={o.route} items={ROUTE_ORDER.map((k) => [k, `${DRAFT_ROUTES[k].icon} ${DRAFT_ROUTES[k].label}`])} onPick={(v) => setOpt({ route: v as DraftRoute })} />
            {o.route === "video" && <p className="rounded-lg bg-jw-warn/15 p-2 text-[11px] leading-5 text-jw-warn">⚠️ الفيديو المولّد أغلى طريق بفرق كبير، وكل مشهد بين ٤ و١٥ ثانية.</p>}

            {priced?.issues.length ? (
              <ul className="space-y-0.5 rounded-lg bg-jw-warn/10 p-2 text-[11px] leading-5 text-jw-warn">
                {priced.issues.map((x, i) => (
                  <li key={i}>• {x}</li>
                ))}
              </ul>
            ) : null}
            {priced?.error && <p className="error-box text-[11px]">{priced.error}</p>}

            <div className="space-y-1 rounded-xl border border-jw-line p-2.5 text-xs">
              {groups ? (
                <>
                  {o.route !== "motion" && <Row k={o.route === "video" ? "الفيديوهات" : "الصور"} v={groups.visuals} />}
                  {hasVoice(o) && <Row k="التعليق الصوتي" v={groups.voice} />}
                  {o.music && <Row k="الموسيقى" v={groups.music} />}
                  <div className="flex items-center justify-between border-t border-jw-line pt-1 font-bold">
                    <span>المجموع</span>
                    <span className="tabular-nums">{stale ? "…" : price(groups.total)}</span>
                  </div>
                </>
              ) : (
                <p className="flex items-center gap-2 text-jw-muted">
                  <span className="jw-spinner" /> نحسب السعر…
                </p>
              )}
              <p className="text-[10px] leading-5 text-jw-faint">كل جزء ينصنع بمولّده العادي وينخصم لحاله، واللي يفشل ترجع نقوده.</p>
            </div>
            <button type="button" className="jw-btn jw-btn-primary w-full" disabled={readOnly || !priced || stale || !!priced.issues.length || !!priced.error} onClick={approve}>
              <Icon name="check" size={16} /> {priced && !stale ? `وافق وابدأ · ${price(priced.total)}` : "نحسب السعر…"}
            </button>
          </>
        )}
      </div>
    </DockFrame>
  );
}

function Seg({ label, value, items, onPick }: { label: string; value: string; items: readonly (readonly [string, string])[]; onPick: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <span className="block text-xs text-jw-muted">{label}</span>
      <div className="jw-seg flex-wrap" role="radiogroup" aria-label={label}>
        {items.map(([k, t]) => (
          <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onPick(k)}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex items-center justify-between text-jw-muted">
      <span>{k}</span>
      <span className="tabular-nums">{price(v)}</span>
    </div>
  );
}

function BrandNote({ colors }: { colors: string[] }) {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-jw-surface-2 p-2 text-[11px] text-jw-muted">
      🎨 هويتك مطبّقة (ألوانها وخطها ونبرتها)
      <span className="flex gap-1" aria-hidden>
        {colors.slice(0, 5).map((c) => (
          <span key={c} className="h-3.5 w-3.5 rounded-full border border-jw-line" style={{ background: c }} />
        ))}
      </span>
    </p>
  );
}

function RouteCard({ route, on, q, onPick }: { route: DraftRoute; on: boolean; q?: { coins: number; scenes: number; error: string | null }; onPick: () => void }) {
  const r = DRAFT_ROUTES[route];
  const dear = route === "video";
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick} className={`flex w-full items-start gap-2 rounded-xl border p-2.5 text-start ${on ? "border-jw-accent bg-jw-accent/10 ring-2 ring-jw-accent" : "border-jw-line"}`}>
      <span className="text-xl" aria-hidden>
        {r.icon}
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex items-center justify-between gap-2">
          <b className="text-sm">{r.label}</b>
          <span className={`shrink-0 text-xs tabular-nums ${dear ? "text-jw-warn" : "text-jw-muted"}`}>{!q ? "…" : q.error ? "غير متاح" : `تقريبًا ${price(q.coins)}`}</span>
        </span>
        <span className="block text-[11px] leading-5 text-jw-muted">{r.hint}</span>
        {dear && <span className="block text-[11px] font-bold text-jw-warn">⚠️ أغلى طريق</span>}
        {q?.error && <span className="block text-[11px] text-jw-danger">{q.error}</span>}
      </span>
    </button>
  );
}

function SceneCost({ parts }: { parts: PricedPart[] }) {
  if (!parts.length) return null;
  return (
    <p className="text-[10px] text-jw-faint">
      {parts.map((p) => `${partLabel(p).replace(/ المشهد \d+$/, "")}: ${p.error ? "غير متاح" : price(p.coins)}`).join(" · ")}
    </p>
  );
}

function RunView({ r, readOnly, onRetry, onStop, onClear, onRebuild }: { r: NonNullable<ReturnType<typeof useDraftRun>["state"]>; readOnly: boolean; onRetry: (keys: string[]) => void; onStop: () => void; onClear: () => void; onRebuild: () => void }) {
  const sum = runSummary(r.parts);
  const failedOf = (scene: number | null) => r.parts.filter((p) => p.scene === scene && (p.state === "failed" || p.state === "stopped"));
  const music = r.parts.find((p) => p.kind === "music");
  const pct = sum.total ? Math.round((sum.done / sum.total) * 100) : 100;
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <b className="block text-sm" dir="auto">
          {r.plan.title || "مسودة"}
        </b>
        <div className="h-2 overflow-hidden rounded-full bg-jw-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-jw-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-jw-muted">
          {r.built ? "انبنت المسودة على التايملاين (تراجع واحد يشيلها)." : r.buildError ? "ما انبنت المسودة بعد." : sum.settled ? (sum.done ? "نبني المسودة…" : "ما نجح أي جزء؛ أعد المشاهد أو ابدأ مسودة جديدة.") : `جاهز ${sum.done} من ${sum.total} — تقدر تكمل شغلك، ولما يخلص كل شي تنبني المسودة على التايملاين.`}
          {sum.failed ? ` · ${sum.failed} ما نجح` : ""}
        </p>
      </div>
      <ol className="space-y-1.5">
        {r.plan.scenes.map((s, i) => {
          const st = sceneState(r.parts, i);
          const failed = failedOf(i);
          const [label, tone] = STATE_TEXT[st];
          return (
            <li key={i} className="space-y-1 rounded-xl border border-jw-line p-2">
              <div className="flex items-center gap-2 text-xs">
                <b className="shrink-0">المشهد {i + 1}</b>
                <span className="min-w-0 flex-1 truncate text-jw-muted" dir="auto">
                  {s.onScreen || s.narration}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${tone}`}>{label}</span>
              </div>
              {failed.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-[10px] leading-4 text-jw-danger">{failed.map((p) => `${partLabel(p)}: ${p.error ?? "ما نجح"}`).join(" · ")}</span>
                  <button type="button" className="jw-btn !min-h-7 shrink-0 text-[11px]" disabled={readOnly} onClick={() => onRetry(failed.map((p) => p.key))}>
                    أعد هالمشهد · {price(failed.reduce((m, p) => m + p.coins, 0))}
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {music && (
          <li className="flex items-center gap-2 rounded-xl border border-jw-line p-2 text-xs">
            <b className="flex-1">🎵 الموسيقى</b>
            {music.state === "failed" || music.state === "stopped" ? (
              <button type="button" className="jw-btn !min-h-7 text-[11px]" disabled={readOnly} onClick={() => onRetry(["m"])}>
                أعد الموسيقى · {price(music.coins)}
              </button>
            ) : (
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${STATE_TEXT[music.state === "ready" || music.state === "placed" ? "ready" : music.state === "queued" ? "queued" : "working"][1]}`}>{STATE_TEXT[music.state === "ready" || music.state === "placed" ? "ready" : music.state === "queued" ? "queued" : "working"][0]}</span>
            )}
          </li>
        )}
      </ol>
      {r.buildError && (
        <div className="space-y-1.5">
          <p className="error-box text-[11px]">{r.buildError}</p>
          <button type="button" className="jw-btn jw-btn-primary w-full text-xs" disabled={readOnly} onClick={onRebuild}>
            جرّب البناء مرة ثانية
          </button>
        </div>
      )}
      {!sum.settled && r.parts.some((p) => p.state === "queued") && (
        <button type="button" className="jw-btn w-full text-xs" disabled={readOnly} onClick={onStop}>
          <Icon name="stop" size={14} /> وقّف الباقي وابنِ باللي جاهز
        </button>
      )}
      {(r.built || (sum.settled && !sum.done)) && (
        <button type="button" className="jw-btn w-full text-xs" disabled={sum.left > 0} onClick={() => confirm("نبدأ مسودة جديدة؟ المسودة اللي على التايملاين تبقى مثل ما هي.") && onClear()}>
          <Icon name="plus" size={14} /> مسودة جديدة
        </button>
      )}
    </div>
  );
}
