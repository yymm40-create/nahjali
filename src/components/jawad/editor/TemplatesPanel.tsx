"use client";

// «قوالب المونتاج» (CapCut's templates): a gallery of ready templates and the person's own; one picked shows its slots
// («حط مقطعك هنا», each with its suggested length) to fill from the library — a tap, a drag, files from the device, or
// «عبّي بالترتيب» — and its words to change; «ابنِ المونتاج» makes it an ordinary project (one undo). «احفظ كقالب»
// keeps the open project as a template of the person's own (needs migration 0115).

import { useEffect, useRef, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import { formatTime, type Timeline } from "@/lib/editor/model";
import { autoFill, buildTemplate, READY_TEMPLATES, slotLengths, templateFromTimeline, type Fill, type Template } from "@/lib/editor/templates";
import type { Command } from "@/lib/editor/commands";
import type { CaptionStyle } from "@/lib/editor/model";
import { CAPTION_STYLES } from "@/lib/editor/model";
import { track } from "@/lib/feature-track";
import DockFrame from "./DockFrame";
import TemplateCard from "./TemplateCard";
import { ASSET_DRAG } from "./Timeline";
import Icon from "../Icon";
import type { Run } from "./Inspector";
import type { EditorAsset } from "./types";

const MEDIA_FILE = /\.(mp4|mov|m4v|webm|mkv|mp3|m4a|aac|wav|ogg|opus|flac|png|jpe?g|webp|gif|heic|avif)$/i;
const sec = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} ث`;

export type TemplateUpload = (files: File[], each: (a: EditorAsset, i: number) => void) => void;

export default function TemplatesPanel({
  dock,
  open,
  onClose,
  tl,
  assets,
  thumbs,
  run,
  flash,
  readOnly,
  upload,
  start,
  onCaptions,
}: {
  dock?: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  tl: Timeline;
  /** the library, in its order */
  assets: EditorAsset[];
  thumbs: Record<string, string | null>;
  run: Run;
  flash: (t: string, bad?: boolean) => void;
  readOnly: boolean;
  upload: TemplateUpload;
  /** a template to open straight away (picked in the launcher) */
  start?: Template | null;
  /** the captions the template suggests: the captions window opened with that look */
  onCaptions?: (style: CaptionStyle) => void;
}) {
  const [tab, setTab] = useState<"ready" | "mine">("ready");
  const [mine, setMine] = useState<Template[] | null>(null);
  const [ready, setReady] = useState(true);
  const [pick, setPick] = useState<Template | null>(start ?? null);
  const [fills, setFills] = useState<(Fill | null)[]>([]);
  const [words, setWords] = useState<string[]>([]);
  const [music, setMusic] = useState<string | null>(null);
  const [chooser, setChooser] = useState<number | "music" | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) track("editor.templates");
  }, [open]);
  // the person's own templates, once the window opens
  useEffect(() => {
    if (!open || mine) return;
    let live = true;
    api<{ ready: boolean; templates: Template[] }>("/api/jawad/editor/templates")
      .then((r) => {
        if (!live) return;
        setMine(r.templates);
        setReady(r.ready);
      })
      .catch(() => live && setMine([]));
    return () => {
      live = false;
    };
  }, [open, mine]);
  // a template from the launcher
  const startId = start?.id;
  useEffect(() => {
    if (!start) return;
    const t = setTimeout(() => choose(start), 0);
    return () => clearTimeout(t);
    // when another one comes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startId]);

  const info = new Map(assets.map((a) => [a.id, a]));
  const media = assets.filter((a) => a.status === "ready" && (a.kind === "video" || a.kind === "image"));
  const sounds = assets.filter((a) => a.status === "ready" && a.kind === "audio");

  function choose(t: Template) {
    setPick(t);
    setFills(t.slots.map(() => null));
    setWords(t.texts.map(() => ""));
    setMusic(null);
    setChooser(null);
  }
  const setSlot = (i: number, f: Fill | null) => setFills((xs) => xs.map((x, k) => (k === i ? f : x)));

  if (!pick) {
    const list = tab === "ready" ? READY_TEMPLATES : (mine ?? []);
    const save = async () => {
      setNote(null);
      setSaving(true);
      try {
        const t = templateFromTimeline(tl, info, name || "قالبي");
        const r = await postJson<{ template: Template }>("/api/jawad/editor/templates", { template: t });
        setMine((m) => [r.template, ...(m ?? [])]);
        setName("");
        track("editor.template_save");
        flash(`حفظت «${r.template.name}» في «قوالبي» (${r.template.slots.length} خانة).`);
      } catch (e) {
        setNote(e instanceof Error ? e.message : "تعذّر الحفظ.");
      } finally {
        setSaving(false);
      }
    };
    const remove = async (t: Template) => {
      if (!confirm(`نحذف القالب «${t.name}»؟`)) return;
      try {
        await api(`/api/jawad/editor/templates?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
        setMine((m) => m?.filter((x) => x.id !== t.id) ?? null);
      } catch (e) {
        flash(e instanceof Error ? e.message : "تعذّر الحذف.", true);
      }
    };
    return (
      <DockFrame dock={dock} open={open} onClose={onClose} title="قوالب المونتاج">
        <div className="space-y-3 p-3">
          <p className="text-xs leading-6 text-jw-muted">اختر قالب، حط مقاطعك في خاناته، وغيّر كلامه — ويطلع مشروع عادي تعدّل فيه كل شي.</p>
          <div className="jw-seg" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "ready"} onClick={() => setTab("ready")}>جاهزة ({READY_TEMPLATES.length})</button>
            <button type="button" role="tab" aria-selected={tab === "mine"} onClick={() => setTab("mine")}>قوالبي{mine?.length ? ` (${mine.length})` : ""}</button>
          </div>
          {tab === "mine" && mine === null ? (
            <div className="grid h-24 place-items-center"><span className="jw-spinner" /></div>
          ) : list.length ? (
            <ul className="grid grid-cols-2 gap-2">
              {list.map((t) => (
                <li key={t.id}>
                  <TemplateCard t={t} onPick={() => choose(t)} onRemove={tab === "mine" && !readOnly ? () => void remove(t) : undefined} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg bg-jw-bg-2 p-3 text-center text-xs text-jw-faint">ما عندك قوالب بعد. سوّ مونتاج يعجبك واحفظه كقالب من تحت.</p>
          )}
          {tab === "mine" && (
            <div className="space-y-1.5 border-t border-jw-line pt-3">
              <p className="text-xs font-semibold">⭐ احفظ هذا المشروع كقالب</p>
              <p className="text-[11px] leading-5 text-jw-muted">كل مقطع في المسار الرئيسي يصير خانة بطوله، والنصوص والانتقالات والمؤثرات والتلوين والإيقاع تنحفظ معه (ملفاتك ما تنحفظ).</p>
              {!ready && <p className="text-[11px] text-jw-warn">حفظ القوالب يحتاج تحديث قاعدة البيانات أول (ملف 0115). القوالب الجاهزة شغالة.</p>}
              <div className="flex gap-1.5">
                <input className="jw-input !min-h-9 min-w-0 flex-1 text-xs" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="اسم القالب" disabled={readOnly || !ready} />
                <button type="button" className="jw-btn jw-btn-primary !min-h-9 shrink-0 text-xs" disabled={readOnly || !ready || saving} onClick={save}>
                  {saving ? <span className="jw-spinner" /> : "احفظ كقالب"}
                </button>
              </div>
              {note && <p className="text-[11px] text-jw-danger">{note}</p>}
            </div>
          )}
        </div>
      </DockFrame>
    );
  }

  const t = pick;
  const lens = slotLengths(t, fills, info);
  const total = lens.reduce<number>((m, l, i) => m + (l ?? t.slots[i].ms), 0);
  const empty = fills.filter((f) => !f).length;
  const hasWork = tl.tracks.some((x) => x.clips.length);

  const fillInOrder = () => {
    if (!media.length) return flash("ما فيه صور أو فيديو جاهزة في الوسائط؛ ارفع ملفاتك أول.", true);
    const r = autoFill(t, media, fills);
    setFills(r.fills);
    if (r.music && !music) setMusic(r.music);
    flash(r.reused ? "الملفات أقل من الخانات: كررناها، والفيديو الطويل يكمل من وين وقف." : r.extra ? `عبّينا الخانات؛ ${r.extra} ملف زايد باقي في الوسائط.` : "عبّينا الخانات بالترتيب.");
  };
  // files from the device: each goes into the next empty slot as it is up (a sound into the music)
  const fromDevice = (list: File[], at?: number) => {
    const files = list.filter((f) => /^(video|audio|image)\//.test(f.type) || MEDIA_FILE.test(f.name));
    if (!files.length) return;
    const free = fills.map((f, i) => (f && i !== at ? -1 : i)).filter((i) => i >= 0);
    const order = at != null ? [at, ...free.filter((i) => i > at), ...free.filter((i) => i < at && i !== at)] : free;
    let k = 0;
    const targets = files.map((f) => (/^audio\//.test(f.type) ? -1 : (order[k++] ?? -2)));
    upload(files, (a, i) => {
      if (a.kind === "audio") {
        if (t.music) setMusic((m) => m ?? a.id);
        return;
      }
      const slot = targets[i];
      if (slot >= 0) setSlot(slot, { assetId: a.id });
    });
    flash(`نرفع ${files.length} ${files.length > 1 ? "ملفات" : "ملف"} وتنحط في الخانات أول ما تخلص…`);
  };
  const dropOn = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(ASSET_DRAG);
    const a = id ? info.get(id) : null;
    if (a && (a.kind === "video" || a.kind === "image")) return setSlot(i, { assetId: a.id });
    if (a?.kind === "audio") return flash("هذي خانة صورة أو فيديو؛ الصوت يروح في «الموسيقى».", true);
    if (e.dataTransfer.files.length) fromDevice(Array.from(e.dataTransfer.files), i);
  };

  const build = () => {
    try {
      const b = buildTemplate(t, fills, info, { words, music });
      const cmds: Command[] = [...(hasWork ? [{ type: "seq_new" as const, name: t.name }] : []), { type: "use_template", name: t.name, timeline: b.timeline }];
      if (!run(cmds, { label: `قالب: ${t.name}` })) return;
      track("editor.template_use");
      const cap = t.captions ? ` القالب يمشي مع كابشن «${CAPTION_STYLES[t.captions].label}»: فتحت لك «الكابشن» بهالشكل.` : "";
      flash(`صار مشروعك من قالب «${t.name}»${hasWork ? " في تسلسل جديد (شغلك القديم باقي في تبويبه)" : ""}. كل شي فيه يتعدّل عادي.${b.notes.length ? ` ${b.notes.join(" ")}` : ""}${cap}`);
      setPick(null);
      onClose();
      if (t.captions) onCaptions?.(t.captions);
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذّر بناء القالب.", true);
    }
  };

  const thumb = (id: string | undefined) => {
    const a = id ? info.get(id) : null;
    if (!a) return null;
    const src = thumbs[a.id] ?? (a.kind === "image" ? a.url : null);
    // eslint-disable-next-line @next/next/no-img-element
    return src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center"><Icon name={a.kind === "image" ? "image" : "video"} size={14} /></span>;
  };
  const picker = (onPick: (a: EditorAsset) => void, list: EditorAsset[]) => (
    <div className="rounded-lg bg-jw-bg-2 p-1.5">
      {list.length ? (
        <ul className="grid max-h-44 grid-cols-4 gap-1 overflow-y-auto">
          {list.map((a) => (
            <li key={a.id}>
              <button type="button" className="block w-full overflow-hidden rounded border border-jw-line hover:border-jw-accent" onClick={() => onPick(a)} title={a.name}>
                <span className="block aspect-square bg-black/40">{a.kind === "audio" ? <span className="grid h-full place-items-center">🎵</span> : thumb(a.id)}</span>
                <span className="block truncate px-0.5 text-[9px]" dir="auto">{a.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-2 text-center text-[11px] text-jw-faint">ما فيه ملفات جاهزة؛ ارفع من جهازك.</p>
      )}
    </div>
  );

  return (
    <DockFrame dock={dock} open={open} onClose={onClose} title={`قالب: ${t.name}`}>
      <div className="space-y-3 p-3">
        <div className="flex items-start gap-2">
          <button type="button" className="jw-btn jw-btn-quiet !min-h-8 shrink-0 text-xs" onClick={() => setPick(null)}>
            → القوالب
          </button>
          <p className="min-w-0 flex-1 text-[11px] leading-5 text-jw-muted">{t.desc}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="jw-btn !min-h-8 flex-1 text-xs" disabled={readOnly} onClick={fillInOrder} title="من ملفات الوسائط بترتيبها">
            <Icon name="sparkles" size={14} /> عبّي بالترتيب
          </button>
          <button type="button" className="jw-btn !min-h-8 flex-1 text-xs" disabled={readOnly} onClick={() => fileInput.current?.click()}>
            <Icon name="upload" size={14} /> ارفع من جهازي
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="video/*,image/*,audio/*,.mp3,.m4a,.wav"
            className="hidden"
            onChange={(e) => {
              fromDevice(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>

        <ol className="space-y-1.5">
          {t.slots.map((s, i) => {
            const f = fills[i];
            const a = f ? info.get(f.assetId) : null;
            return (
              <li key={i} className="space-y-1">
                <div
                  className={`flex items-center gap-2 rounded-lg border p-1.5 ${f ? "border-jw-line" : "border-dashed border-jw-accent/60 bg-jw-accent/5"}`}
                  onDragOver={(e) => {
                    if (readOnly) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                  }}
                  onDrop={(e) => !readOnly && dropOn(e, i)}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-jw-surface-2 text-[10px] font-bold">{i + 1}</span>
                  <button type="button" className="h-10 w-10 shrink-0 overflow-hidden rounded bg-black/40" disabled={readOnly} onClick={() => setChooser(chooser === i ? null : i)} aria-label={`اختر ملف لـ${s.label}`}>
                    {a ? thumb(a.id) : <span className="grid h-full place-items-center text-jw-accent"><Icon name="plus" size={16} /></span>}
                  </button>
                  <button type="button" className="min-w-0 flex-1 text-start" disabled={readOnly} onClick={() => setChooser(chooser === i ? null : i)}>
                    <b className="block truncate text-xs">{s.label}</b>
                    <span className="block truncate text-[10px] text-jw-muted" dir="auto">
                      {a ? a.name : "حط مقطعك هنا"} · {s.whole && !a ? "طول مقطعك" : sec(lens[i] ?? s.ms)}
                      {s.kind === "image" ? " · صورة أحسن" : s.kind === "video" ? " · فيديو أحسن" : ""}
                    </span>
                  </button>
                  {f && (
                    <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon shrink-0" disabled={readOnly} onClick={() => setSlot(i, null)} aria-label="فضّي الخانة">
                      <Icon name="x" size={12} />
                    </button>
                  )}
                </div>
                {chooser === i && picker((x) => {
                  setSlot(i, { assetId: x.id });
                  setChooser(null);
                }, media)}
              </li>
            );
          })}
        </ol>

        {t.music && (
          <div className="space-y-1">
            <button type="button" className="flex w-full items-center gap-2 rounded-lg border border-jw-line p-1.5 text-start" disabled={readOnly} onClick={() => setChooser(chooser === "music" ? null : "music")}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-jw-surface-2"><Icon name="music" size={12} /></span>
              <span className="min-w-0 flex-1 truncate text-xs">{music ? (info.get(music)?.name ?? "موسيقى") : "الموسيقى (اختياري)"}</span>
              {t.bpm && <span className="text-[10px] text-jw-faint">{t.bpm} ضربة · علامات إيقاع</span>}
            </button>
            {chooser === "music" && picker((x) => {
              setMusic(x.id);
              setChooser(null);
            }, sounds)}
          </div>
        )}

        {t.texts.length > 0 && (
          <div className="space-y-1.5 border-t border-jw-line pt-3">
            <p className="text-xs font-semibold">الكلام</p>
            {t.texts.map((x, i) => (
              <label key={i} className="block space-y-0.5">
                <span className="text-[10px] text-jw-muted">{x.label} · خانة {x.slot + 1}</span>
                <input className="jw-input !min-h-8 w-full text-xs" dir="auto" value={words[i] ?? ""} placeholder={x.body} maxLength={200} disabled={readOnly} onChange={(e) => setWords((w) => w.map((v, k) => (k === i ? e.target.value : v)))} />
              </label>
            ))}
          </div>
        )}

        <p className="text-[11px] leading-5 text-jw-faint">
          المجموع {formatTime(total, false)}{t.captions ? ` · كابشن «${CAPTION_STYLES[t.captions].label}» من كلامك بعد البناء` : ""}{t.transition ? " · انتقالات بين الخانات" : ""}. {hasWork ? "مشروعك فيه شغل: القالب ينبني في تسلسل جديد ويبقى شغلك." : ""}
        </p>
        <button type="button" className="jw-btn jw-btn-primary w-full" disabled={readOnly || empty > 0} onClick={build}>
          {empty ? `باقي ${empty} ${empty > 2 && empty < 11 ? "خانات" : "خانة"} فاضية` : "ابنِ المونتاج"}
        </button>
      </div>
    </DockFrame>
  );
}
