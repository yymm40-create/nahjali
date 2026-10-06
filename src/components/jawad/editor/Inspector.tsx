"use client";

import { useEffect, useState } from "react";
import type { Sensitivity } from "@/lib/editor/scenes";
import type { SceneProgress } from "./scene-detect";
import {
  clipEnd,
  clipLength,
  CAPTION_STYLES,
  COLOR_PRESETS,
  findClip,
  formatTime,
  ANIM_MS,
  ANIMS,
  hasSoundFx,
  NEUTRAL_COLOR,
  NO_SOUND_FX,
  SOUND_EFFECTS,
  RATIOS,
  ratioOf,
  sourceTime,
  transformAt,
  type Anim,
  type AnimKind,
  type CaptionStyle,
  type Clip,
  type ColorPreset,
  type SoundEffect,
  type SoundFx,
  type Track,
  type Ratio,
  type TextStyle,
  type Timeline,
  type Transform,
} from "@/lib/editor/model";
import type { ClipPatch, Command } from "@/lib/editor/commands";
import Icon from "../Icon";
import { soundFile } from "./audio";
import FontPicker from "./FontPicker";
import FxPanel from "./FxPanel";
import TransitionPanel from "./TransitionPanel";
import { TR_CATS, TR_LIST, type TrCat } from "@/lib/editor/transitions";
import { clipSound } from "./voice";
import { detectBeats, peaksOf } from "./peaks";
import type { PlayerLike } from "./Timeline";
import type { EditorAsset } from "./types";

export type Run = (cmd: Command | Command[], opts?: { label?: string; coalesce?: string }) => unknown;
export type InspectorTab = "basic" | "motion" | "anim" | "fx" | "color" | "backdrop" | "transition" | "sound";

const COLORS = ["#ffffff", "#000000", "#b8f53d", "#facc15", "#f43f5e", "#22d3ee", "#a78bfa", "#fb923c"];
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const PIP: { label: string; t: Partial<Transform> }[] = [
  { label: "يملأ الإطار", t: { x: 0.5, y: 0.5, scale: 1 } },
  { label: "↖ زاوية", t: { x: 0.25, y: 0.2, scale: 0.36 } },
  { label: "↗ زاوية", t: { x: 0.75, y: 0.2, scale: 0.36 } },
  { label: "↙ زاوية", t: { x: 0.25, y: 0.8, scale: 0.36 } },
  { label: "↘ زاوية", t: { x: 0.75, y: 0.8, scale: 0.36 } },
  { label: "النص الأعلى", t: { x: 0.5, y: 0.25, scale: 0.5 } },
  { label: "النص الأسفل", t: { x: 0.5, y: 0.75, scale: 0.5 } },
];

function Slider({ label, value, min, max, step, onChange, format, disabled, ltr }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string; disabled?: boolean; ltr?: boolean }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center justify-between text-xs text-jw-muted">
        <span>{label}</span>
        <span className="tabular-nums text-jw-ink" dir="ltr">{format ? format(value) : value}</span>
      </span>
      <input type="range" dir={ltr ? "ltr" : undefined} className="w-full accent-[var(--jw-accent)]" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/** The playhead's time, refreshed a few times a second (for «نقطة حركة هنا»). */
function usePlayhead(player: PlayerLike | null) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!player) return;
    let last = 0;
    const t = setTimeout(() => setMs(player.ms), 0);
    const off = player.subscribe((m, playing) => {
      const now = performance.now();
      if (playing && now - last < 250) return;
      last = now;
      setMs(m);
    });
    return () => {
      clearTimeout(t);
      off();
    };
  }, [player]);
  return ms;
}

/** What can be changed about the selected clip (or the project, when nothing is selected). */
export default function Inspector({
  tl,
  selected,
  assets,
  run,
  readOnly,
  player,
  tab,
  onTab,
  flash,
  rail = false,
  projectView = false,
  thumbs,
  onSeparate,
  onSceneCut,
}: {
  tl: Timeline;
  selected: string[];
  assets: Map<string, EditorAsset>;
  run: Run;
  readOnly: boolean;
  player: PlayerLike | null;
  tab: InspectorTab;
  onTab: (t: InspectorTab) => void;
  flash: (text: string, bad?: boolean) => void;
  /** the sections are chosen from the side rail (no tabs here) */
  rail?: boolean;
  /** show the project's settings whatever is selected */
  projectView?: boolean;
  /** small pictures of the files (the effects' previews) */
  thumbs?: Record<string, string | null>;
  /** splits a clip's sound into talking / music / effects tracks */
  onSeparate?: (clipId: string) => Promise<void>;
  /** «التقطيع الذكي»: cuts a video clip where its shot changes; resolves with how many cuts were made */
  onSceneCut?: SceneCutRun;
}) {
  const playhead = usePlayhead(player);
  const [beatBusy, setBeatBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [separating, setSeparating] = useState(false);
  const found = selected.length === 1 ? findClip(tl, selected[0]) : null;

  if (!found || projectView) {
    const ratio = ratioOf(tl);
    return (
      <div className="space-y-4 p-3">
        {rail && !projectView && <p className="rounded-xl bg-jw-accent/10 p-2.5 text-xs leading-5 text-jw-ink">👆 اختر مقطعًا في التايملاين أو على المعاينة، وتطلع إعداداته هنا.</p>}
        <h3 className="text-sm font-semibold">المشروع</h3>
        {selected.length > 1 && <p className="text-xs text-jw-muted">محدد {selected.length} مقاطع: تقدر تحذفها أو تقصها مرة وحدة.</p>}
        <div className="space-y-1.5">
          <span className="text-xs text-jw-muted">المقاس</span>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(RATIOS) as Ratio[]).map((r) => (
              <button key={r} type="button" disabled={readOnly} aria-pressed={ratio === r} className={`rounded-lg border px-2 py-2 text-start text-xs ${ratio === r ? "border-jw-accent bg-jw-accent/10" : "border-jw-line hover:border-jw-line-strong"}`} onClick={() => run({ type: "set_ratio", ratio: r })}>
                <b dir="ltr">{r}</b>
                <span className="block text-[10px] text-jw-muted">{RATIOS[r].label}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center justify-between gap-2 text-xs text-jw-muted">
          لون الخلفية
          <input type="color" disabled={readOnly} value={tl.background} onChange={(e) => run({ type: "set_background", color: e.target.value }, { coalesce: "bg" })} className="h-8 w-12 cursor-pointer rounded border border-jw-line bg-transparent" />
        </label>
        <label className="flex items-start gap-2 text-xs">
          <input type="checkbox" disabled={readOnly} checked={tl.magnetic} onChange={(e) => run({ type: "set_magnetic", on: e.target.checked })} className="mt-0.5 accent-[var(--jw-accent)]" />
          <span>
            <b>المغناطيس</b>
            <span className="block text-jw-muted">المقاطع في المسار الرئيسي تلتصق ببعض بدون فراغات (مثل CapCut).</span>
          </span>
        </label>
        <div className="space-y-1.5 border-t border-jw-line pt-3">
          <span className="text-xs text-jw-muted">انتقال لكل قصّات المسار الرئيسي</span>
          <select className="jw-input !min-h-9 w-full text-sm" disabled={readOnly} value="" aria-label="انتقال لكل القصّات" onChange={(e) => e.target.value && run({ type: "transition_all", kind: e.target.value === "none" ? null : e.target.value })}>
            <option value="">اختر انتقالًا (١٠٠)…</option>
            <option value="none">بدون انتقالات</option>
            {(Object.keys(TR_CATS) as TrCat[]).map((c) => (
              <optgroup key={c} label={TR_CATS[c]}>
                {TR_LIST.filter((t) => t.cat === c).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {tl.markers.length > 0 && (
          <button type="button" disabled={readOnly} className="jw-btn jw-btn-quiet w-full text-xs" onClick={() => run({ type: "set_markers", markers: [], mode: "clear" })}>
            شيل علامات الإيقاع ({tl.markers.length})
          </button>
        )}
        <p className="rounded-lg bg-jw-surface-2 p-2 text-[11px] leading-5 text-jw-muted">
          اختصارات: <b>مسافة</b> تشغيل · <b>S</b> قص · <b>Delete</b> حذف · <b>Ctrl+Z</b> تراجع · <b>Ctrl+D</b> تكرار · الأسهم إطار إطار.
        </p>
      </div>
    );
  }

  const { clip, track, index } = found;
  const a = clip.assetId ? assets.get(clip.assetId) : null;
  const locked = readOnly || track.locked;
  const set = (patch: ClipPatch, key: string) => run({ type: "update_clip", clipId: clip.id, patch }, { coalesce: `${clip.id}:${key}` });
  const text = clip.text;
  // a video's sound taken out onto a sound track is only sound
  const onSound = track.kind === "audio";
  const visual = !!text || (a ? a.kind !== "audio" && !onSound : false);
  const sound = !!a && a.kind !== "image" && a.hasAudio;
  // the texts of one track change together (captions); one set apart («own») changes alone
  const group = !!text && track.clips.length > 1;
  const together = group && !clip.own;
  const setText = (p: Partial<TextStyle>, key: string) =>
    together && !("body" in p) ? run({ type: "style_track", trackId: track.id, text: p }, { coalesce: `${track.id}:group:${key}` }) : set({ text: p }, `text:${key}`);
  const saveSound = async () => {
    if (!a?.url) return;
    setSaving(true);
    try {
      const blob = await soundFile(a.url, clip.in, clip.out);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${(a.name || "sound").replace(/\.[^.]+$/, "")}-audio.wav`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
    } catch {
      flash("ما قدرنا نقرأ صوت هذا الملف في متصفحك.", true);
    } finally {
      setSaving(false);
    }
  };
  const next = track.clips[index + 1];
  const joined = !!next && next.start === clipEnd(clip);
  const tabs: [InspectorTab, string][] = [
    ["basic", text ? "النص" : "أساسي"],
    ...(visual ? ([["motion", "حركة"]] as [InspectorTab, string][]) : []),
    ...(visual ? ([["anim", "دخول وخروج"]] as [InspectorTab, string][]) : []),
    ...(visual && !text ? ([["fx", "مؤثرات"]] as [InspectorTab, string][]) : []),
    ...(visual && !text ? ([["color", "ألوان"]] as [InspectorTab, string][]) : []),
    ...(visual && !text ? ([["backdrop", "الخلفية"]] as [InspectorTab, string][]) : []),
    ...(visual && joined ? ([["transition", "انتقال"]] as [InspectorTab, string][]) : []),
    ...(sound ? ([["sound", "صوت"]] as [InspectorTab, string][]) : []),
  ];
  const current = tabs.some(([k]) => k === tab) ? tab : "basic";
  // from the rail: a section this clip doesn't have shows what it has instead, saying so
  const missing = rail && current !== tab ? { motion: "الحركة", anim: "الدخول والخروج", fx: "المؤثرات", color: "الألوان", backdrop: "الخلفية", transition: "الانتقال", sound: "الصوت", basic: "" }[tab] : "";

  // ---- motion: with motion points, a change goes into the point at the playhead
  const inClip = playhead >= clip.start && playhead < clipEnd(clip);
  const at = Math.min(clipEnd(clip) - 1, Math.max(clip.start, playhead));
  const t = transformAt(clip, at);
  const keyHere = clip.keys.some((k) => Math.abs(k.t - sourceTime(clip, at)) <= 40);
  const move = (p: Partial<Transform>, key: string) =>
    clip.keys.length ? run({ type: "set_key", clipId: clip.id, at, transform: p }, { coalesce: `${clip.id}:key:${key}:${Math.round(at)}` }) : set({ transform: p }, key);

  // «طلّع الصوت» and «احفظ الصوت ملف»: on the clip's main settings and on its sound settings
  const soundButtons = (
            <div className="flex gap-1.5">
              {!onSound && a?.kind === "video" && (
                <button type="button" className="jw-btn !min-h-9 flex-1 text-xs" disabled={locked || clip.volume === 0} onClick={() => run({ type: "extract_audio", clipId: clip.id })} title="ينزل صوت الفيديو في مسار صوت تحته، متزامن معه، تعدّل عليه أو تقصّه بروحه">
                  <Icon name="music" size={14} /> {clip.volume === 0 ? "الصوت مطلّع" : "طلّع الصوت"}
                </button>
              )}
              <button type="button" className="jw-btn jw-btn-quiet !min-h-9 flex-1 text-xs" disabled={saving} onClick={saveSound} title="ينزّل صوت هذا الجزء ملف WAV على جهازك">
                {saving ? <span className="jw-spinner" /> : <Icon name="download" size={14} />} احفظ الصوت ملف
              </button>
            </div>
  );

  const beats = async () => {
    if (!a) return;
    setBeatBusy(true);
    try {
      const peaks = await peaksOf(a.id, a.url);
      const r = peaks ? detectBeats(peaks, clip.in, clip.out) : null;
      if (!r || !r.beats.length) return flash("ما قدرنا نلقى إيقاعًا واضحًا في هذا الصوت.", true);
      const marks = r.beats.map((s) => Math.round(clip.start + (s - clip.in) / clip.speed)).filter((m) => m >= clip.start && m < clipEnd(clip));
      run({ type: "set_markers", markers: marks, mode: "add" });
      flash(`الإيقاع ${r.bpm} ضربة في الدقيقة: ${marks.length} علامة؛ القص والسحب يلتصقون عليها.`);
    } finally {
      setBeatBusy(false);
    }
  };

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-2">
        <Icon name={text ? "type" : a?.kind === "audio" || onSound ? "music" : a?.kind === "image" ? "image" : "video"} size={16} />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold" dir="auto">{text ? "نص" : (a?.name ?? "مقطع")}</h3>
        <span className="text-xs tabular-nums text-jw-muted" dir="ltr">{formatTime(clipLength(clip))}</span>
        <button type="button" className="grid h-7 w-7 place-items-center rounded text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink disabled:opacity-40" disabled={locked} onClick={() => run({ type: "duplicate", clipId: clip.id })} aria-label="تكرار" title="تكرار (Ctrl+D)">
          <Icon name="copy" size={15} />
        </button>
      </div>
      {track.locked && <p className="text-xs text-jw-warn">المسار مقفول؛ افتح القفل من رأس المسار لتعدّل.</p>}
      {missing && <p className="rounded-lg bg-jw-surface-2 p-2 text-[11px] text-jw-muted">قسم «{missing}» ما يناسب هذا المقطع{tab === "transition" ? " (يحتاج مقطع بعده ملاصق له)" : ""}؛ هذي إعداداته الأساسية.</p>}
      {tabs.length > 1 && !rail && (
        <div className="jw-seg" role="tablist" aria-label="أقسام التعديل">
          {tabs.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={current === k} onClick={() => onTab(k)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {current === "basic" && (
        <div className="space-y-3">
          {a?.kind === "video" && onSceneCut && <SceneCut clipId={clip.id} locked={locked} run={onSceneCut} />}
          {group && (
            <div className={`space-y-1.5 rounded-lg border p-2 text-[11px] leading-5 ${together ? "border-jw-accent/40 bg-jw-accent/5" : "border-jw-warn/50 bg-jw-warn/5"}`}>
              <p>
                {together ? (
                  <>🔗 <b>تعديل جماعي:</b> الحجم والخط واللون والمكان تتغير لكل نصوص هذا المسار ({track.clips.filter((c) => !c.own).length}). الكلام نفسه لهذا النص بس.</>
                ) : (
                  <>✂️ <b>منفصل:</b> تعديلاتك على هذا النص بروحه. لما ترجّعه للمجموعة يحتفظ بشكله، والتعديلات الجماعية الجاية توصله.</>
                )}
              </p>
              <button type="button" disabled={locked} className="jw-btn !min-h-8 w-full text-xs" onClick={() => run({ type: "update_clip", clipId: clip.id, patch: { own: together } }, { label: together ? "فصلت نصًا عن المجموعة" : "رجّعت نصًا للمجموعة" })}>
                {together ? "افصل هذا النص وعدّله بروحه" : "رجّعه للتعديل الجماعي"}
              </button>
            </div>
          )}
          {text && <TextControls text={text} locked={locked} setText={setText} />}
          {text && clip.words.length > 0 && <p className="text-[11px] text-jw-faint">كابشن بتوقيت الكلمات: صحّح أي كلمة بنفس عددها وتبقى متزامنة.</p>}
          {text && track.clips.length > 1 && (
            <div className="space-y-1.5 border-t border-jw-line pt-3">
              <span className="text-xs text-jw-muted">شكل لكل جمل هذا المسار ({track.clips.length})</span>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(CAPTION_STYLES) as CaptionStyle[]).map((k) => (
                  <button key={k} type="button" disabled={locked} className="jw-chip !px-2.5 !py-1 !text-xs" onClick={() => run({ type: "style_track", trackId: track.id, text: CAPTION_STYLES[k].style })}>
                    {CAPTION_STYLES[k].label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {sound && <Slider label="الصوت" value={Math.round(clip.volume * 100)} min={0} max={200} step={5} disabled={locked} onChange={(v) => set({ volume: v / 100 }, "volume")} format={(v) => `${v}%`} />}
          {a && a.kind !== "image" && (
            <div className="space-y-1">
              <span className="text-xs text-jw-muted">السرعة (الصوت يحتفظ بطبقته)</span>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="السرعة">
                {SPEEDS.map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={clip.speed === s} disabled={locked} onClick={() => run({ type: "update_clip", clipId: clip.id, patch: { speed: s } })} dir="ltr" className={`jw-chip !px-2.5 !py-1 !text-xs ${clip.speed === s ? "!border-jw-accent !text-jw-ink" : ""}`}>
                    ×{s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {sound && soundButtons}
          {!text && a?.kind !== "audio" && !onSound && (
            <div className="jw-seg" role="radiogroup" aria-label="الملاءمة">
              <button type="button" role="radio" aria-checked={clip.fit === "cover"} disabled={locked} onClick={() => set({ fit: "cover" }, "fit")}>
                املأ الإطار
              </button>
              <button type="button" role="radio" aria-checked={clip.fit === "contain"} disabled={locked} onClick={() => set({ fit: "contain" }, "fit")}>
                الصورة كاملة
              </button>
            </div>
          )}
          {sound && clip.volume > 1 && <p className="text-[11px] text-jw-faint">الصوت فوق ١٠٠٪ يبان في الملف المصدَّر؛ المعاينة تشغّله حتى ١٠٠٪.</p>}
        </div>
      )}

      {current === "motion" && (
        <div className="space-y-3">
          {!text && (
            <div className="space-y-1">
              <span className="text-xs text-jw-muted">صورة داخل صورة</span>
              <div className="flex flex-wrap gap-1.5">
                {PIP.map((p) => (
                  <button key={p.label} type="button" disabled={locked} className="jw-chip !px-2.5 !py-1 !text-xs" onClick={() => move(p.t, "pip")}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="jw-seg mt-1.5" role="radiogroup" aria-label="الشكل">
                {(["rect", "rounded", "circle"] as const).map((sh) => (
                  <button key={sh} type="button" role="radio" aria-checked={clip.shape === sh} disabled={locked} onClick={() => set({ shape: sh }, "shape")}>
                    {sh === "rect" ? "مربع" : sh === "rounded" ? "زوايا ناعمة" : "دائرة"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Slider label="التكبير" value={Math.round(t.scale * 100)} min={10} max={400} step={1} disabled={locked} onChange={(v) => move({ scale: v / 100 }, "scale")} format={(v) => `${v}%`} />
          <Slider ltr label="← يسار · يمين →" value={Math.round(t.x * 100)} min={-50} max={150} step={1} disabled={locked} onChange={(v) => move({ x: v / 100 }, "x")} format={(v) => `${v}%`} />
          <Slider label={together && !clip.keys.length ? "فوق ↕ تحت (لكل نصوص المسار)" : "فوق ↕ تحت"} value={Math.round(t.y * 100)} min={-50} max={150} step={1} disabled={locked} onChange={(v) => (together && !clip.keys.length ? run({ type: "style_track", trackId: track.id, text: {}, y: v / 100 }, { coalesce: `${track.id}:group:y` }) : move({ y: v / 100 }, "y"))} format={(v) => `${v}%`} />
          <Slider label="الدوران" value={Math.round(t.rotate)} min={-180} max={180} step={1} disabled={locked} onChange={(v) => move({ rotate: v }, "rotate")} format={(v) => `${v}°`} />
          <Slider label="الشفافية" value={Math.round(t.opacity * 100)} min={0} max={100} step={1} disabled={locked} onChange={(v) => move({ opacity: v / 100 }, "opacity")} format={(v) => `${v}%`} />
          <div className="space-y-1.5 rounded-lg border border-jw-line p-2">
            <p className="text-xs font-semibold">◆ الحركة مع الوقت {clip.keys.length > 0 && <span className="font-normal text-jw-muted">({clip.keys.length} نقاط)</span>}</p>
            <p className="text-[11px] leading-5 text-jw-muted">حط الخط الأخضر على لحظة، اضغط «نقطة هنا» وغيّر المكان أو الحجم؛ انتقل للحظة ثانية وغيّر مرة ثانية: المقطع يتحرك بينهم لحاله.</p>
            {!inClip && <p className="text-[11px] text-jw-warn">مؤشر الوقت خارج هذا المقطع؛ حطه عليه أول.</p>}
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="jw-btn !min-h-8 flex-1 text-xs" disabled={locked || !inClip} onClick={() => (keyHere ? run({ type: "remove_key", clipId: clip.id, at }) : run({ type: "set_key", clipId: clip.id, at, transform: {} }))}>
                {keyHere ? "◇ شيل النقطة هنا" : "◆ نقطة هنا"}
              </button>
              {clip.keys.length > 0 && (
                <button type="button" className="jw-btn jw-btn-quiet !min-h-8 text-xs" disabled={locked} onClick={() => run({ type: "clear_keys", clipId: clip.id })}>
                  شيل كل الحركة
                </button>
              )}
            </div>
          </div>
          <button type="button" className="jw-btn jw-btn-quiet w-full text-xs" disabled={locked} onClick={() => run([{ type: "clear_keys", clipId: clip.id }, { type: "update_clip", clipId: clip.id, patch: { transform: { x: 0.5, y: text ? 0.78 : 0.5, scale: 1, rotate: 0, opacity: 1 } } }], { label: "رجّعت الوضع الأصلي" })}>
            <Icon name="retry" size={14} /> رجّع الوضع الأصلي
          </button>
        </div>
      )}

      {current === "fx" && <FxPanel clip={clip} thumb={a ? (thumbs?.[a.id] ?? null) : null} locked={locked} run={run} flash={flash} others={track.clips.filter((c) => c.id !== clip.id && !c.text).map((c) => c.id)} />}
      {current === "anim" && <AnimControls clip={clip} track={track} together={together} locked={locked} run={run} />}

      {current === "color" && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(COLOR_PRESETS) as ColorPreset[]).map((k) => (
              <button key={k} type="button" disabled={locked} aria-pressed={(clip.color?.preset ?? "none") === k} className={`rounded-lg border px-1 py-2 text-[11px] ${(clip.color?.preset ?? "none") === k ? "border-jw-accent bg-jw-accent/10" : "border-jw-line hover:border-jw-line-strong"}`} onClick={() => set({ color: { preset: k } }, "color:preset")}>
                {COLOR_PRESETS[k].label}
              </button>
            ))}
          </div>
          {(["brightness", "contrast", "saturation"] as const).map((k) => (
            <Slider key={k} label={k === "brightness" ? "الإضاءة" : k === "contrast" ? "التباين" : "التشبع"} value={Math.round((clip.color?.[k] ?? 1) * 100)} min={k === "saturation" ? 0 : 40} max={k === "saturation" ? 250 : 180} step={1} disabled={locked} onChange={(v) => set({ color: { [k]: v / 100 } }, `color:${k}`)} format={(v) => `${v}%`} />
          ))}
          <Slider ltr label="← بارد · دافئ →" value={Math.round((clip.color?.warmth ?? 0) * 100)} min={-100} max={100} step={1} disabled={locked} onChange={(v) => set({ color: { warmth: v / 100 } }, "color:warmth")} format={(v) => `${v}`} />
          <button type="button" className="jw-btn jw-btn-quiet w-full text-xs" disabled={locked || !clip.color} onClick={() => set({ color: null }, "color:reset")}>
            <Icon name="retry" size={14} /> الألوان الأصلية
          </button>
          {clip.color && JSON.stringify(clip.color) !== JSON.stringify(NEUTRAL_COLOR) && <p className="text-[11px] text-jw-faint">المعاينة والتصدير بنفس الألوان.</p>}
        </div>
      )}

      {current === "backdrop" && (
        <div className="space-y-3">
          <p className="text-xs leading-6 text-jw-muted">نلقى الشخص في الصورة ونغيّر اللي وراه. يشتغل على جهازك مجانًا (أول مرة يتحمّل نموذج صغير).</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                [null, "الأصلية"],
                ["blur", "غبّش الخلفية"],
                ["remove", "شيل الخلفية"],
                ["color", "لون بدلها"],
              ] as const
            ).map(([mode, label]) => {
              const on = mode === null ? !clip.bg : clip.bg?.mode === mode;
              return (
                <button key={label} type="button" disabled={locked} aria-pressed={on} className={`rounded-lg border px-2 py-2 text-xs ${on ? "border-jw-accent bg-jw-accent/10" : "border-jw-line hover:border-jw-line-strong"}`} onClick={() => set({ bg: mode === null ? null : { mode } }, "bg:mode")}>
                  {label}
                </button>
              );
            })}
          </div>
          {clip.bg?.mode === "blur" && <Slider label="قوة التغبيش" value={clip.bg.blur} min={1} max={100} step={1} disabled={locked} onChange={(v) => set({ bg: { blur: v } }, "bg:blur")} />}
          {clip.bg?.mode === "color" && (
            <label className="flex items-center justify-between gap-2 text-xs text-jw-muted">
              لون الخلفية
              <input type="color" disabled={locked} value={clip.bg.color} onChange={(e) => set({ bg: { color: e.target.value } }, "bg:color")} className="h-8 w-12 cursor-pointer rounded border border-jw-line bg-transparent" />
            </label>
          )}
          {clip.bg?.mode === "remove" && (
            <p className="rounded-lg bg-jw-surface-2 p-2 text-[11px] leading-5 text-jw-muted">
              مكان الخلفية يصير شفاف، فيبان اللي تحت هذا المقطع في التايملاين. لتحط صورة أو فيديو خلف الشخص: حط هذا المقطع في مسار فوق (اسحبه للأعلى) والخلفية الجديدة في الرئيسي تحته.
            </p>
          )}
          {clip.bg && <p className="text-[11px] text-jw-faint">يناسب لقطات الشخص الواحد من الأمام (مثل السيلفي والبودكاست).</p>}
        </div>
      )}

      {current === "transition" && joined && <TransitionPanel clip={clip} trackId={track.id} thumbA={a ? (thumbs?.[a.id] ?? null) : null} thumbB={next?.assetId ? (thumbs?.[next.assetId] ?? null) : null} locked={locked} run={run} />}

      {current === "sound" && sound && (
        <div className="space-y-3">
          <Slider label="الصوت" value={Math.round(clip.volume * 100)} min={0} max={200} step={5} disabled={locked} onChange={(v) => set({ volume: v / 100 }, "volume")} format={(v) => `${v}%`} />
          <Slider label="ظهور تدريجي في البداية" value={clip.fadeIn} min={0} max={Math.min(10_000, clipLength(clip))} step={100} disabled={locked} onChange={(v) => set({ fadeIn: v }, "fadeIn")} format={(v) => `${(v / 1000).toFixed(1)} ث`} />
          <Slider label="اختفاء تدريجي في النهاية" value={clip.fadeOut} min={0} max={Math.min(10_000, clipLength(clip))} step={100} disabled={locked} onChange={(v) => set({ fadeOut: v }, "fadeOut")} format={(v) => `${(v / 1000).toFixed(1)} ث`} />
          {track.kind === "audio" && (
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" disabled={locked} checked={track.duck} onChange={(e) => run({ type: "update_track", trackId: track.id, patch: { duck: e.target.checked } })} className="mt-0.5 accent-[var(--jw-accent)]" />
              <span>
                <b>خفض تلقائي وقت الكلام</b>
                <span className="block text-jw-muted">صوت هذا المسار (الموسيقى مثلًا) ينخفض لحاله لما يكون فيه كلام أو صوت في المسارات الثانية، ويرجع بعده.</span>
              </span>
            </label>
          )}
          {soundButtons}
          {onSeparate && (
            <button type="button" className="jw-btn jw-3d w-full text-xs" disabled={locked || separating} onClick={() => { setSeparating(true); void onSeparate(clip.id).finally(() => setSeparating(false)); }} title="الكلام في مسار، والموسيقى في مسار، والمؤثرات الصوتية في مسار، متزامنة مع المقطع">
              {separating ? <span className="jw-spinner" /> : "🎚️"} افصل الكلام والموسيقى والمؤثرات
            </button>
          )}
          <SoundWork clip={clip} track={track} url={a?.url ?? null} locked={locked} run={run} />
          {a?.kind === "audio" && (
            <button type="button" className="jw-btn w-full text-xs" disabled={locked || beatBusy} onClick={beats}>
              {beatBusy ? <span className="jw-spinner" /> : "🥁"} اكشف الإيقاع (علامات يلتصق عليها القص)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TextControls({ text, locked, setText }: { text: TextStyle; locked: boolean; setText: (p: Partial<TextStyle>, key: string) => void }) {
  return (
    <div className="space-y-3">
      <textarea className="jw-textarea min-h-20 w-full text-sm" dir="auto" disabled={locked} value={text.body} onChange={(e) => setText({ body: e.target.value }, "body")} placeholder="اكتب النص" />
      <Slider label="الحجم" value={Math.round(text.size * 1000) / 10} min={2} max={20} step={0.5} disabled={locked} onChange={(v) => setText({ size: v / 100 }, "size")} format={(v) => `${v}%`} />
      <div className="space-y-1">
        <span className="text-xs text-jw-muted">اللون</span>
        <div className="flex flex-wrap gap-1.5">
          {COLORS.map((c) => (
            <button key={c} type="button" disabled={locked} aria-label={c} aria-pressed={text.color === c} className={`h-7 w-7 rounded-full border-2 ${text.color === c ? "border-jw-accent" : "border-jw-line"}`} style={{ background: c }} onClick={() => setText({ color: c }, "color")} />
          ))}
          <input type="color" disabled={locked} value={text.color.slice(0, 7)} onChange={(e) => setText({ color: e.target.value }, "color")} className="h-7 w-9 cursor-pointer rounded border border-jw-line bg-transparent" aria-label="لون آخر" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" disabled={locked} checked={!!text.box} onChange={(e) => setText({ box: e.target.checked ? "#000000b3" : null }, "box")} className="accent-[var(--jw-accent)]" />
        خلفية خلف الكلام
      </label>
      <FontPicker value={text.font} disabled={locked} onPick={(f) => setText({ font: f }, "font")} />
      <div className="jw-seg" role="radiogroup" aria-label="السماكة">
        {([400, 700, 900] as const).map((w) => (
          <button key={w} type="button" role="radio" aria-checked={text.weight === w} disabled={locked} onClick={() => setText({ weight: w }, "weight")}>
            {w === 400 ? "عادي" : w === 700 ? "عريض" : "أعرض"}
          </button>
        ))}
      </div>
    </div>
  );
}

/** «تحسين الصوت»: noise reduction, the voice enhancer, an effect and the voice's pitch (made on this device). */
function SoundWork({ clip, track, url, locked, run }: { clip: Clip; track: Track; url: string | null; locked: boolean; run: Run }) {
  const fx = clip.sound ?? NO_SOUND_FX;
  const [state, setState] = useState<"idle" | "busy" | "ready" | "failed">("idle");
  const set = (p: Partial<SoundFx>, key: string) => run({ type: "update_clip", clipId: clip.id, patch: { sound: p } }, { coalesce: `${clip.id}:sound:${key}` });
  // the worked sound is made ahead (a moment after the last change), so playing it starts straight away
  useEffect(() => {
    if (!url || !hasSoundFx(clip)) return;
    let live = true;
    const t = setTimeout(() => {
      setState("busy");
      clipSound(url, clip).then(
        () => live && setState("ready"),
        () => live && setState("failed"),
      );
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [url, clip]);
  const others = track.clips.filter((c) => c.id !== clip.id && c.assetId);
  return (
    <div className="space-y-3 rounded-xl border border-jw-line p-2.5">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-xs font-semibold">✨ تحسين الصوت</span>
        {hasSoundFx(clip) && state === "busy" && (
          <span className="flex items-center gap-1 text-[11px] text-jw-muted">
            <span className="jw-spinner" /> نجهّزه…
          </span>
        )}
        {hasSoundFx(clip) && state === "failed" && <span className="text-[11px] text-jw-danger">ما قدرنا نعالج صوته</span>}
      </div>
      <Slider label="عزل الضوضاء" value={Math.round(fx.clean * 100)} min={0} max={100} step={5} disabled={locked} onChange={(v) => set({ clean: v / 100 }, "clean")} format={(v) => (v ? `${v}%` : "بدون")} />
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" disabled={locked} checked={fx.enhance} onChange={(e) => set({ enhance: e.target.checked }, "enhance")} className="mt-0.5 accent-[var(--jw-accent)]" />
        <span>
          <b>محسّن الصوت</b>
          <span className="block text-jw-muted">يشيل الهمهمة والطنين، يوضّح الكلام ويخلّي مستواه متساوي.</span>
        </span>
      </label>
      <div className="space-y-1.5">
        <span className="text-xs text-jw-muted">مؤثر</span>
        <div className="grid grid-cols-5 gap-1">
          <button type="button" disabled={locked} aria-pressed={!fx.effect} className={`rounded-lg border px-0.5 py-1.5 text-[10px] ${!fx.effect ? "border-jw-accent bg-jw-accent/10" : "border-jw-line"}`} onClick={() => set({ effect: null }, "effect")}>
              <span className="block text-sm leading-none">∅</span>بدون
          </button>
          {(Object.keys(SOUND_EFFECTS) as SoundEffect[]).map((k) => (
            <button
              key={k}
              type="button"
              disabled={locked}
              aria-pressed={fx.effect === k}
              className={`rounded-lg border px-0.5 py-1.5 text-[10px] ${fx.effect === k ? "border-jw-accent bg-jw-accent/10" : "border-jw-line hover:border-jw-line-strong"}`}
              // the rooms (echo, hall…) sit around the voice; the others change the voice itself
              onClick={() => set({ effect: k, mix: ["echo", "reverb", "stadium", "cave"].includes(k) ? 0.4 : 1 }, "effect")}
            >
              <span className="block text-sm leading-none">{SOUND_EFFECTS[k].icon}</span>
              {SOUND_EFFECTS[k].label}
            </button>
          ))}
        </div>
        {fx.effect && <Slider label="قوة المؤثر" value={Math.round(fx.mix * 100)} min={5} max={100} step={5} disabled={locked} onChange={(v) => set({ mix: v / 100 }, "mix")} format={(v) => `${v}%`} />}
      </div>
      <Slider ltr label="← أعمق · طبقة الصوت · أنحف →" value={fx.pitch} min={-12} max={12} step={1} disabled={locked} onChange={(v) => set({ pitch: v }, "pitch")} format={(v) => (v ? `${v > 0 ? "+" : ""}${v}` : "طبيعي")} />
      <div className="flex gap-1.5">
        {others.length > 0 && hasSoundFx(clip) && (
          <button type="button" className="jw-btn !min-h-8 flex-1 text-[11px]" disabled={locked} onClick={() => run(others.map((c) => ({ type: "update_clip" as const, clipId: c.id, patch: { sound: { ...fx } } })), { label: "نفس تحسين الصوت لكل المسار" })}>
            طبّقه على كل المسار ({others.length + 1})
          </button>
        )}
        {hasSoundFx(clip) && (
          <button type="button" className="jw-btn jw-btn-quiet !min-h-8 flex-1 text-[11px]" disabled={locked} onClick={() => run({ type: "update_clip", clipId: clip.id, patch: { sound: null } }, { label: "رجّعت الصوت الأصلي" })}>
            <Icon name="retry" size={13} /> الصوت الأصلي
          </button>
        )}
      </div>
      <p className="text-[10px] leading-4 text-jw-faint">يشتغل على جهازك مجانًا، والتصدير يطلع بنفس الصوت اللي تسمعه.</p>
    </div>
  );
}

/** «دخول وخروج»: how the clip comes in and goes out (texts of a group all together). */
function AnimControls({ clip, track, together, locked, run }: { clip: Clip; track: Track; together: boolean; locked: boolean; run: Run }) {
  const a = clip.anim;
  const kind = clip.text ? "text" : "media";
  const kinds = (Object.keys(ANIMS) as AnimKind[]).filter((k) => {
    const only = (ANIMS[k] as { only?: string }).only;
    return !only || only === kind;
  });
  // a group's texts change together; the others alone
  const targets = together ? track.clips.filter((c) => !c.own).map((c) => c.id) : [clip.id];
  const set = (p: Partial<Anim> | null, key: string) =>
    run(
      targets.map((id) => ({ type: "update_clip" as const, clipId: id, patch: { anim: p } })),
      { label: p === null ? "شلت الدخول والخروج" : "غيّرت الدخول والخروج", coalesce: `${clip.id}:anim:${key}` },
    );
  const grid = (side: "in" | "out") => {
    const cur = a?.[side] ?? null;
    return (
      <div className="space-y-1.5">
        <span className="text-xs font-semibold">{side === "in" ? "⤵ الدخول" : "⤴ الخروج"}</span>
        <div className="grid grid-cols-4 gap-1">
          <button type="button" disabled={locked} aria-pressed={!cur} className={`rounded-lg border px-0.5 py-1.5 text-[10px] ${!cur ? "border-jw-accent bg-jw-accent/10" : "border-jw-line"}`} onClick={() => set({ [side]: null }, side)}>
            <span className="block text-sm leading-none">∅</span>بدون
          </button>
          {kinds
            .filter((k) => side === "in" || k !== "kenburns")
            .map((k) => (
              <button
                key={k}
                type="button"
                disabled={locked}
                aria-pressed={cur === k}
                className={`rounded-lg border px-0.5 py-1.5 text-[10px] ${cur === k ? "border-jw-accent bg-jw-accent/10" : "border-jw-line hover:border-jw-line-strong"}`}
                onClick={() => set({ [side]: k, [side === "in" ? "inMs" : "outMs"]: ANIMS[k].ms || 400 }, side)}
              >
                <span className="block text-sm leading-none">{ANIMS[k].icon}</span>
                {ANIMS[k].label}
              </button>
            ))}
        </div>
        {cur && cur !== "kenburns" && (
          <Slider
            label="المدة"
            value={side === "in" ? a!.inMs : a!.outMs}
            min={ANIM_MS.min}
            max={ANIM_MS.max}
            step={50}
            disabled={locked}
            onChange={(v) => set({ [side === "in" ? "inMs" : "outMs"]: v }, `${side}:ms`)}
            format={(v) => `${(v / 1000).toFixed(2)} ث`}
          />
        )}
      </div>
    );
  };
  return (
    <div className="space-y-4">
      {together && <p className="rounded-lg bg-jw-accent/5 p-2 text-[11px] text-jw-muted">🔗 ينطبق على كل نصوص المسار ({targets.length}). افصل النص من «النص» لتعطيه حركة بروحه.</p>}
      {grid("in")}
      {grid("out")}
      <p className="text-[10px] leading-4 text-jw-faint">ما فيه حركات حرف بحرف لأنها تقطّع الحروف العربية المتصلة؛ «كتابة» تكشف النص من اليمين، و«مطّ» تمدّ الكلمات بالكشيدة.</p>
      <div className="flex gap-1.5">
        {!clip.text && a && track.clips.length > 1 && (
          <button type="button" className="jw-btn !min-h-8 flex-1 text-[11px]" disabled={locked} onClick={() => run(track.clips.filter((c) => c.id !== clip.id).map((c) => ({ type: "update_clip" as const, clipId: c.id, patch: { anim: { ...a } } })), { label: "نفس الدخول والخروج لكل المسار" })}>
            طبّقه على كل المسار
          </button>
        )}
        {a && (
          <button type="button" className="jw-btn jw-btn-quiet !min-h-8 flex-1 text-[11px]" disabled={locked} onClick={() => set(null, "reset")}>
            <Icon name="retry" size={13} /> بدون حركات
          </button>
        )}
      </div>
    </div>
  );
}

export type SceneCutRun = (clipId: string, sensitivity: Sensitivity, onProgress: (p: SceneProgress) => void, signal: AbortSignal) => Promise<number>;

/** «التقطيع الذكي»: the clip cut wherever its camera or scene changes (found in the browser, one undo). */
function SceneCut({ clipId, locked, run }: { clipId: string; locked: boolean; run: SceneCutRun }) {
  const [level, setLevel] = useState<Sensitivity>("normal");
  const [busy, setBusy] = useState<{ done: number; total: number; stop: AbortController } | null>(null);
  const go = async () => {
    const stop = new AbortController();
    setBusy({ done: 0, total: 1, stop });
    try {
      await run(clipId, level, (p) => setBusy((b) => (b ? { ...b, ...p } : b)), stop.signal);
    } finally {
      setBusy(null);
    }
  };
  const levels: [Sensitivity, string][] = [
    ["low", "تغيّرات واضحة"],
    ["normal", "عادي"],
    ["high", "حساس"],
  ];
  return (
    <div className="space-y-2 rounded-xl border border-jw-accent/30 bg-jw-accent/5 p-2.5">
      <p className="text-xs font-bold">✂️ التقطيع الذكي</p>
      <p className="text-[11px] leading-5 text-jw-muted">يقطع المقطع عند كل تغيّر في المشهد أو الكاميرا، وكل مشهد يصير مقطع لحاله تقدر تحذفه أو ترتّبه.</p>
      {busy ? (
        <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-jw-bg-2">
            <div className="h-full rounded-full bg-jw-accent transition-all" style={{ width: `${Math.round((busy.done / Math.max(1, busy.total)) * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-jw-muted">
            <span>يقرأ المشاهد… {Math.round((busy.done / Math.max(1, busy.total)) * 100)}%</span>
            <button type="button" className="underline" onClick={() => busy.stop.abort()}>
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="الحساسية">
            {levels.map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={level === k} onClick={() => setLevel(k)} className={`rounded-lg px-1 py-1 text-[11px] ${level === k ? "bg-jw-accent text-jw-on-accent" : "bg-jw-surface-2 text-jw-muted"}`}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="jw-btn jw-btn-primary w-full text-xs" disabled={locked} onClick={go}>
            قطّع عند تغيّر المشهد
          </button>
        </>
      )}
    </div>
  );
}
