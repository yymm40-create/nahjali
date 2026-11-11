"use client";

// «الرضا فويس» — the studio, laid out as a recording program is (the project window of Cubase is the model): a
// toolbar on top with the editing tools and the snap; an info line that spells out the selected clip in numbers; the
// inspector of the selected track on one side; the track list and its events in the middle; a lower zone for the
// mixing console and the tools; and the transport bar along the bottom. It owns the engine and the project's store,
// saves a moment after every change, and gives every panel the same few verbs.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RIDHA } from "@config/ridha";
import { addClip, addMarker, addRecording, addTrack, armTrack, chooseTake, clipOf, deleteClips, duplicateClips, patchClip, replaceSound, setFades, splitClip, takesOf, trackOf } from "@/lib/ridha/ops";
import { barsLabel, clockLabel, SR, type Clip, type Project } from "@/lib/ridha/model";
import { StudioCtx, type PanelId, type Studio as StudioApi } from "./ctx";
import { decodeFile, Engine, getSound, putSound } from "./engine";
import { saveProject, Store, useProject } from "./store";
import Timeline, { type TimelineApi, type Tool } from "./Timeline";
import Inspector from "./Inspector";
import MixerPanel from "./panels/MixerPanel";
import EditorPanel from "./panels/EditorPanel";
import EqPanel from "./panels/EqPanel";
import FxPanel from "./panels/FxPanel";
import TunePanel from "./panels/TunePanel";
import CleanPanel from "./panels/CleanPanel";
import HarmonyPanel from "./panels/HarmonyPanel";
import ArrangePanel from "./panels/ArrangePanel";
import VoicePanel from "./panels/VoicePanel";
import ExportPanel from "./panels/ExportPanel";
import LatencyDialog, { loadLatency } from "./LatencyDialog";

const PANELS: { id: PanelId; name: string }[] = [
  { id: "mixer", name: "الميكسر" },
  { id: "editor", name: "المحرر" },
  { id: "clean", name: "التنظيف" },
  { id: "eq", name: "الإكولايزر" },
  { id: "fx", name: "المؤثرات" },
  { id: "tune", name: "الأوتوتيون والنغمة" },
  { id: "harmony", name: "هارموني 3D" },
  { id: "arrange", name: "التوزيع السريع" },
  { id: "voice", name: "تغيير الصوت" },
  { id: "export", name: "التصدير" },
];

const TOOLS: { id: Tool; name: string; key: string; path: string }[] = [
  { id: "select", name: "تحديد وتحريك", key: "1", path: "M5 3l14 8-6 2-2 6z" },
  { id: "split", name: "مقص: اضغط على المقطع ليُقص هناك", key: "2", path: "M6 6a2.5 2.5 0 1 0 0 .01M6 18a2.5 2.5 0 1 0 0 .01M8 8l12 10M8 16L20 6" },
  { id: "erase", name: "ممحاة: اضغط على المقطع ليُحذف", key: "3", path: "M4 16l9-10 7 6-7 8H7zM10 20h10" },
  { id: "mute", name: "كتم: اضغط على المقطع ليُكتم أو يُفتح", key: "4", path: "M5 5l14 14M19 5L5 19" },
];

const Icon = ({ d, size = 15, fill }: { d: string; size?: number; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

interface Job {
  title: string;
  done: number;
  what: string;
}

export default function Studio({ initial, onExit }: { initial: Project; onExit(): void }) {
  const store = useMemo(() => new Store(initial), [initial]);
  const engine = useMemo(() => new Engine(), []);
  const project = useProject(store);
  const [selClips, setSelClips] = useState<string[]>([]);
  const [selTrack, setSelTrack] = useState(initial.tracks[0]?.id ?? "");
  const [panel, setPanel] = useState<PanelId>("mixer");
  const [lower, setLower] = useState(true);
  const [left, setLeft] = useState(() => typeof window === "undefined" || window.innerWidth > 1000);
  const [tool, setTool] = useState<Tool>("select");
  const [job, setJob] = useState<Job | null>(null);
  const [toastText, setToast] = useState("");
  const [, bump] = useState(0);
  const [recStart, setRecStart] = useState<number | null>(null);
  const [saved, setSaved] = useState<"saved" | "saving" | "error">("saved");
  const [monitor, setMonitor] = useState(false);
  const [latencyOpen, setLatencyOpen] = useState(false);
  const tl = useRef<TimelineApi | null>(null);
  const clockEl = useRef<HTMLSpanElement>(null);
  const barsEl = useRef<HTMLSpanElement>(null);
  const clipboard = useRef<Clip[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4200);
  }, []);

  // the engine follows the project; the device keeps a copy a moment after each change
  useEffect(() => {
    void engine.setProject(project);
  }, [engine, project]);
  // the round trip measured on this device (a Bluetooth headphone's delay) is remembered between visits
  useEffect(() => {
    const l = loadLatency();
    engine.setLatency(l.roundTrip, l.trim);
  }, [engine]);
  useEffect(() => {
    engine.hold();
    const off = engine.watch(() => bump((n) => n + 1));
    return () => {
      off();
      engine.release();
    };
  }, [engine]);
  useEffect(() => {
    const t = setTimeout(() => {
      setSaved("saving");
      saveProject(project, store.liveSounds()).then(() => setSaved("saved"), () => setSaved("error"));
    }, 1200);
    return () => clearTimeout(t);
  }, [project, store]);

  // the time displays move every frame on their own (no re-render of the studio)
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const pos = engine.position();
      if (clockEl.current) clockEl.current.textContent = clockLabel(pos);
      if (barsEl.current) barsEl.current.textContent = barsLabel(store.get(), pos);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, store]);

  const select = useCallback((clips: string[], track?: string) => {
    setSelClips(clips);
    if (track) setSelTrack(track);
  }, []);

  const work = useCallback(async <T,>(title: string, fn: (say: (done: number, what?: string) => void) => Promise<T>): Promise<T | null> => {
    setJob({ title, done: 0, what: "" });
    // let the card paint before the heavy work starts
    await new Promise((r) => setTimeout(r, 30));
    try {
      return await fn((done, what) => setJob((j) => (j ? { ...j, done, what: what ?? j.what } : j)));
    } catch (e) {
      console.error(e);
      toast(`تعذّر: ${title}. ${e instanceof Error && /[؀-ۿ]/.test(e.message) ? e.message : "حاول مرة ثانية."}`);
      return null;
    } finally {
      setJob(null);
    }
  }, [toast]);

  const clipSound = useCallback((c: Clip): Float32Array[] | null => {
    const s = getSound(c.assetId);
    if (!s) return null;
    const a = Math.round(c.offset * SR), b = Math.min(s.channels[0].length, Math.round((c.offset + c.dur) * SR));
    return s.channels.map((ch) => ch.slice(a, b));
  }, []);

  const applyToClip = useCallback((c: Clip, channels: Float32Array[], label: string) => {
    const s = putSound(channels, `${c.name} · ${label}`);
    store.set((p) => replaceSound(p, c.id, s.id, channels[0].length / SR));
    toast(`تم: ${label} — التراجع بـ ⌘Z`);
  }, [store, toast]);

  const clip = selClips.length ? clipOf(project, selClips[0]) : null;
  const track = trackOf(project, selTrack) ?? project.tracks[0] ?? null;

  // ── importing sound ──

  const importFiles = useCallback(async (files: File[], trackId: string | null, at: number) => {
    await engine.start();
    await work("استيراد الصوت", async (say) => {
      for (let i = 0; i < files.length; i++) {
        say(i / files.length, files[i].name);
        const channels = await decodeFile(files[i]);
        if (channels[0].length / SR > RIDHA.maxMinutes * 60) throw new Error(`الملف أطول من ${RIDHA.maxMinutes} دقيقة.`);
        const s = putSound(channels, files[i].name.replace(/\.[^.]+$/, ""));
        const dur = channels[0].length / SR;
        store.set((p) => {
          // the first file goes where it was dropped; each further file gets a track of its own
          let q = p;
          let tid = i === 0 ? trackId : null;
          if (!tid || q.clips.some((c) => c.trackId === tid && c.start < at + dur && c.start + c.dur > at)) {
            const empty = q.tracks.find((t) => t.kind !== "group" && !q.clips.some((c) => c.trackId === t.id));
            if (i === 0 && empty && !trackId) tid = empty.id;
            else {
              const made = addTrack(q, s.name.slice(0, 24), { stereo: channels.length > 1 });
              q = made.project;
              tid = made.track.id;
            }
          }
          // an empty track takes the shape of what lands on it: a stereo file makes it stereo, a mono one mono
          if (!q.clips.some((c) => c.trackId === tid)) q = { ...q, tracks: q.tracks.map((t) => (t.id === tid ? { ...t, stereo: channels.length > 1 } : t)) };
          const r = addClip(q, { trackId: tid!, assetId: s.id, start: at, dur, name: s.name });
          setSelClips([r.clip.id]);
          setSelTrack(tid!);
          return r.project;
        });
      }
    });
  }, [engine, store, work]);

  const pickFiles = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*,video/mp4,video/quicktime,video/webm,.wav,.mp3,.m4a,.aac,.ogg,.flac,.opus";
    input.multiple = true;
    input.onchange = () => {
      const q = store.get();
      const free = q.tracks.some((t) => t.id === selTrack && t.kind !== "group") && !q.clips.some((c) => c.trackId === selTrack);
      if (input.files?.length) void importFiles([...input.files], free ? selTrack : null, engine.position());
    };
    input.click();
  }, [engine, importFiles, selTrack, store]);

  // ── transport ──

  const stopRec = useCallback(() => {
    const p = store.get();
    const armed = p.tracks.find((t) => t.arm);
    const rec = engine.stopRecording();
    setRecStart(null);
    if (!rec || !armed) return;
    const dur = rec.channels[0].length / SR;
    if (dur < 0.15) return;
    const n = p.clips.filter((c) => c.trackId === armed.id).length + 1;
    const s = putSound(rec.channels, `${armed.name} · تسجيل ${n}`);
    store.set((q) => {
      const r = addRecording(q, armed.id, s.id, rec.start, dur, `تسجيل ${n}`);
      setSelClips([r.clip.id]);
      setSelTrack(armed.id);
      return r.project;
    });
    engine.seek(rec.start);
  }, [engine, store]);

  // a recording is stopped at the longest length the device's memory can be trusted with
  useEffect(() => {
    if (recStart == null) return;
    const t = setInterval(() => {
      if (engine.recording && engine.position() - recStart > RIDHA.maxMinutes * 60) stopRec();
    }, 1000);
    return () => clearInterval(t);
  }, [engine, recStart, stopRec]);

  const toggleRecord = useCallback(async () => {
    if (engine.recording) return stopRec();
    // nothing armed: the selected track is (a group records nothing, so then the first real track)
    if (!store.get().tracks.some((t) => t.arm)) store.set((q) => armTrack(q, q.tracks.find((t) => t.id === selTrack && t.kind !== "group")?.id ?? q.tracks.find((t) => t.kind !== "group")!.id), { undo: false });
    const p = store.get();
    try {
      const from = engine.position();
      // the other tracks play while the armed one records; a stereo track records two channels
      await engine.record(from, p.countIn, p.tracks.find((t) => t.arm)?.stereo === true);
      setRecStart(from);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      toast(name === "NotAllowedError" ? "المتصفح منع المايكروفون. اسمح له من إعدادات الصفحة ثم اضغط التسجيل من جديد." : name === "NotFoundError" ? "ما لقيت مايكروفون موصول بالجهاز." : "تعذّر فتح المايكروفون.");
    }
  }, [engine, selTrack, stopRec, store, toast]);

  const togglePlay = useCallback(() => {
    if (engine.recording) return stopRec();
    if (engine.playing) engine.stop();
    else engine.play();
  }, [engine, stopRec]);

  const stopAll = useCallback(() => {
    if (engine.recording) return stopRec();
    if (engine.playing) engine.stop();
    else engine.seek(0);
  }, [engine, stopRec]);

  // ── clip verbs ──

  const split = useCallback(() => {
    const t = engine.position();
    store.set((p) => {
      const targets = selClips.length ? selClips : p.clips.filter((c) => c.trackId === selTrack && t > c.start && t < c.start + c.dur).map((c) => c.id);
      return targets.reduce((q, id) => splitClip(q, id, t), p);
    });
  }, [engine, selClips, selTrack, store]);
  const remove = useCallback(() => {
    if (!selClips.length) return;
    store.set((p) => deleteClips(p, selClips));
    setSelClips([]);
  }, [selClips, store]);
  const duplicate = useCallback(() => {
    if (!selClips.length) return;
    store.set((p) => {
      const r = duplicateClips(p, selClips);
      setSelClips(r.ids);
      return r.project;
    });
  }, [selClips, store]);
  const paste = useCallback(() => {
    if (!clipboard.current.length) return;
    const at = engine.position();
    const first = Math.min(...clipboard.current.map((c) => c.start));
    store.set((p) => {
      let q = p;
      const ids: string[] = [];
      for (const c of clipboard.current) {
        const tid = q.tracks.some((t) => t.id === c.trackId) ? c.trackId : selTrack;
        const r = addClip(q, { ...c, id: undefined, trackId: tid, start: at + (c.start - first), take: undefined, muted: false } as Omit<Clip, "id">);
        q = r.project;
        ids.push(r.clip.id);
      }
      setSelClips(ids);
      return q;
    });
  }, [engine, selTrack, store]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" && (el as HTMLInputElement).type !== "range") return;
      if (el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const toggle = (key: "metronome" | "snap") => store.set((p) => ({ ...p, [key]: !p[key] }), { undo: false });
      // with ⌘/Ctrl: the editing shortcuts every program shares
      const withMod: Record<string, () => void> = {
        z: () => (e.shiftKey ? store.redo() : store.undo()),
        y: () => store.redo(),
        v: paste,
        d: duplicate,
        a: () => setSelClips(store.get().clips.map((c) => c.id)),
      };
      // alone: the transport, the tools and the clip verbs, by the key's place on the keyboard (so they work on an Arabic layout too)
      const alone: Record<string, () => void> = {
        Space: togglePlay,
        KeyR: () => void toggleRecord(),
        KeyS: split,
        KeyL: () => store.set((p) => ({ ...p, loop: { ...p.loop, on: !p.loop.on } }), { undo: false }),
        KeyM: () => store.set((p) => addMarker(p, engine.position())),
        KeyC: () => toggle("metronome"),
        KeyJ: () => toggle("snap"),
        Digit1: () => setTool("select"),
        Digit2: () => setTool("split"),
        Digit3: () => setTool("erase"),
        Digit4: () => setTool("mute"),
        F3: () => {
          setPanel("mixer");
          setLower(true);
        },
        Delete: remove,
        Backspace: remove,
        Home: () => engine.seek(0),
        Enter: () => engine.seek(0),
        Equal: () => tl.current?.zoom(1.4),
        Minus: () => tl.current?.zoom(1 / 1.4),
        KeyH: () => tl.current?.zoom(1.4),
        KeyG: () => tl.current?.zoom(1 / 1.4),
        Escape: () => {
          setSelClips([]);
          setTool("select");
        },
      };
      if (mod && k === "c") {
        clipboard.current = store.get().clips.filter((c) => selClips.includes(c.id));
        return;
      }
      const run = mod ? withMod[k] : alone[e.code];
      if (!run) return;
      e.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [duplicate, engine, paste, remove, selClips, split, store, togglePlay, toggleRecord]);

  const openPanel = useCallback((p: PanelId) => {
    setPanel(p);
    setLower(true);
  }, []);
  const api: StudioApi = useMemo(
    () => ({ engine, store, project, selClips, selTrack, select, clip, track, panel, openPanel, work, toast, clipSound, applyToClip }),
    [engine, store, project, selClips, selTrack, select, clip, track, panel, openPanel, work, toast, clipSound, applyToClip],
  );

  const takes = clip ? takesOf(project, clip) : [];
  const set = (patch: Partial<Project>) => store.set((p) => ({ ...p, ...patch }), { undo: false });
  const sound = clip ? getSound(clip.assetId) : null;
  const room = clip && sound ? sound.channels[0].length / SR - clip.offset : 0;
  /** A number field of the info line: typed, then committed on Enter or on leaving the field. */
  const num = (label: string, value: number, onSet: (v: number) => void, unit = "ث", digits = 3) => (
    <label className="rv-info-f">
      <span>{label}</span>
      <input key={`${clip?.id}:${label}:${value.toFixed(digits)}`} dir="ltr" defaultValue={value.toFixed(digits)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} onBlur={(e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v) && Math.abs(v - value) > 1e-4) onSet(v);
      }} />
      <i>{unit}</i>
    </label>
  );

  return (
    <StudioCtx.Provider value={api}>
      <div className={`rv rv-studio${lower ? "" : " rv-no-lower"}${left ? "" : " rv-no-left"}`}>
        {/* ── toolbar ── */}
        <header className="rv-bar rv-toolbar">
          <button type="button" className="rv-tbtn" onClick={onExit} title="مشاريعي"><Icon d="M9 6l6 6-6 6" /></button>
          <Logo />
          <input className="rv-name" value={project.name} onChange={(e) => store.set((p) => ({ ...p, name: e.target.value }), { merge: "name" })} aria-label="اسم المشروع" />
          <span className={`rv-saved ${saved}`} title={saved === "error" ? "تعذّر الحفظ على الجهاز (المساحة ممتلئة؟)" : "يُحفظ على هذا الجهاز تلقائيًا"}>{saved === "saved" ? "محفوظ" : saved === "saving" ? "يحفظ…" : "لم يُحفظ"}</span>
          <span className="rv-sep" />
          <button type="button" className="rv-tbtn" onClick={() => store.undo()} disabled={!store.canUndo} title="تراجع (⌘Z)"><Icon d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></button>
          <button type="button" className="rv-tbtn" onClick={() => store.redo()} disabled={!store.canRedo} title="إعادة (⇧⌘Z)"><Icon d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" /></button>
          <span className="rv-sep" />
          <span className="rv-tools" role="radiogroup" aria-label="أدوات التحرير" dir="ltr">
            {TOOLS.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={tool === t.id} className={`rv-tbtn${tool === t.id ? " on" : ""}`} onClick={() => setTool(t.id)} title={`${t.name} (${t.key})`}><Icon d={t.path} /></button>
            ))}
          </span>
          <span className="rv-sep" />
          <button type="button" className={`rv-tbtn rv-tbtn-w${project.snap ? " on" : ""}`} onClick={() => set({ snap: !project.snap })} title="الالتصاق بالشبكة (J)"><Icon d="M6 3v8a6 6 0 0 0 12 0V3M6 7h4M14 7h4" /> شبكة</button>
          <button type="button" className="rv-tbtn rv-tbtn-w" onClick={split} title="قص عند المؤشر (S)">قص</button>
          <button type="button" className="rv-tbtn rv-tbtn-w" onClick={duplicate} disabled={!clip} title="تكرار (⌘D)">تكرار</button>
          <button type="button" className="rv-tbtn rv-tbtn-w" onClick={() => store.set((p) => addMarker(p, engine.position()))} title="علامة عند المؤشر (M)">علامة</button>
          <span className="rv-grow" />
          <button type="button" className={`rv-tbtn${left ? " on" : ""}`} onClick={() => setLeft(!left)} title="إظهار/إخفاء الإنسبكتور"><Icon d="M4 5h16v14H4zM9 5v14" /></button>
          <button type="button" className={`rv-tbtn${lower ? " on" : ""}`} onClick={() => setLower(!lower)} title="إظهار/إخفاء المنطقة السفلية (F3 للميكسر)"><Icon d="M4 5h16v14H4zM4 14h16" /></button>
          <span className="rv-sep" />
          <button type="button" className="rv-tbtn rv-tbtn-w" onClick={pickFiles} title="أضف ملف صوت أو فيديو (يؤخذ صوته)">استيراد</button>
          <button type="button" className="rv-tbtn rv-tbtn-w rv-tbtn-gold" onClick={() => openPanel("export")}>تصدير</button>
        </header>

        {/* ── info line: the selected clip, in numbers ── */}
        <div className="rv-bar rv-info">
          {clip ? (
            <>
              <label className="rv-info-f rv-info-name">
                <span>المقطع</span>
                <input value={clip.name} onChange={(e) => store.set((p) => patchClip(p, clip.id, { name: e.target.value }), { merge: `cn${clip.id}` })} />
              </label>
              {num("البداية", clip.start, (v) => store.set((p) => patchClip(p, clip.id, { start: Math.max(0, v) })))}
              {num("النهاية", clip.start + clip.dur, (v) => store.set((p) => patchClip(p, clip.id, { dur: Math.max(0.02, Math.min(v - clip.start, room || clip.dur)) })))}
              {num("الطول", clip.dur, (v) => store.set((p) => patchClip(p, clip.id, { dur: Math.max(0.02, Math.min(v, room || clip.dur)) })))}
              {num("المستوى", clip.gain, (v) => store.set((p) => patchClip(p, clip.id, { gain: Math.max(-60, Math.min(24, v)) })), "dB", 1)}
              {num("دخول", clip.fadeIn, (v) => store.set((p) => setFades(p, clip.id, v, clip.fadeOut)))}
              {num("خروج", clip.fadeOut, (v) => store.set((p) => setFades(p, clip.id, clip.fadeIn, v)))}
              <label className="rv-info-f rv-info-check">
                <span>كتم</span>
                <input type="checkbox" checked={clip.muted} onChange={() => store.set((p) => patchClip(p, clip.id, { muted: !clip.muted }))} />
              </label>
              <span className="rv-info-ro rv-clipinfo">{clip.name} · {sound ? (sound.channels.length > 1 ? "ستيريو" : "مونو") : "الصوت مفقود"} · 48 kHz</span>
              {takes.length > 1 ? (
                <span className="rv-takes">
                  <span>التيكات</span>
                  {takes.map((t, i) => (
                    <button key={t.id} type="button" className={!t.muted ? "on" : ""} onClick={() => {
                      store.set((p) => chooseTake(p, t.id));
                      setSelClips([t.id]);
                    }}>{i + 1}</button>
                  ))}
                </span>
              ) : null}
              <button type="button" className="rv-tbtn rv-tbtn-w" onClick={remove} title="حذف (Delete)">حذف</button>
            </>
          ) : (
            <span className="rv-info-ro">لا مقطع محدد — اضغط على مقطع لتظهر أرقامه هنا (البداية، الطول، المستوى، التدرّج)، ونقرتان تفتحانه في المحرر</span>
          )}
        </div>

        {/* ── the project: inspector | tracks and events ── */}
        <div className="rv-work">
          {left ? <Inspector /> : null}
          <Timeline onImport={importFiles} recStart={recStart} apiRef={tl} tool={tool} />
        </div>

        {/* ── lower zone ── */}
        <nav className="rv-tabs" aria-label="المنطقة السفلية">
          {PANELS.map((t) => (
            <button key={t.id} type="button" className={panel === t.id && lower ? "on" : ""} onClick={() => {
              if (panel === t.id) setLower(!lower);
              else openPanel(t.id);
            }}>{t.name}</button>
          ))}
        </nav>
        {lower ? (
          <section className="rv-panel">
            {panel === "mixer" ? <MixerPanel /> : null}
            {panel === "editor" ? <EditorPanel /> : null}
            {panel === "eq" ? <EqPanel /> : null}
            {panel === "fx" ? <FxPanel /> : null}
            {panel === "tune" ? <TunePanel /> : null}
            {panel === "clean" ? <CleanPanel /> : null}
            {panel === "harmony" ? <HarmonyPanel /> : null}
            {panel === "arrange" ? <ArrangePanel /> : null}
            {panel === "voice" ? <VoicePanel /> : null}
            {panel === "export" ? <ExportPanel /> : null}
          </section>
        ) : null}

        {/* ── transport bar ── */}
        <footer className="rv-bar rv-transport" dir="ltr">
          <div className="rv-loc" title="منطقة التكرار: اسحب على المسطرة لتحديدها">
            <span>L</span><b>{barsLabel(project, project.loop.start)}</b>
            <span>R</span><b>{barsLabel(project, project.loop.end)}</b>
          </div>
          <button type="button" className={`rv-tbtn${project.loop.on ? " on violet" : ""}`} onClick={() => set({ loop: { ...project.loop, on: !project.loop.on } })} title="تكرار المنطقة (L)"><Icon d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" /></button>
          <span className="rv-sep" />
          <button type="button" className="rv-tr" onClick={() => engine.seek(0)} title="للبداية (Home)"><Icon d="M6 5h2v14H6zM20 5v14L9 12z" fill /></button>
          <button type="button" className="rv-tr" onClick={stopAll} title="إيقاف"><Icon d="M6 6h12v12H6z" fill /></button>
          <button type="button" className={`rv-tr rv-tr-play${engine.playing && !engine.recording ? " on" : ""}`} onClick={togglePlay} title="تشغيل / إيقاف (مسافة)"><Icon d={engine.playing ? "M6 5h4v14H6zM14 5h4v14h-4z" : "M7 4v16l13-8z"} fill size={17} /></button>
          <button type="button" className={`rv-tr rv-tr-rec${engine.recording ? " on" : ""}`} onClick={() => void toggleRecord()} title="تسجيل على المسار الجاهز، والباقي يشتغل (R)"><Icon d="M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z" fill size={17} /></button>
          <span className="rv-sep" />
          <div className="rv-time"><span ref={barsEl} className="rv-time-bars">1.1.1</span><small>بار</small></div>
          <div className="rv-time"><span ref={clockEl} className="rv-time-clock">0:00.000</span><small>وقت</small></div>
          <span className="rv-sep" />
          <label className="rv-bpm" title="السرعة (ضربة في الدقيقة)">
            <input type="number" min={30} max={240} step={1} value={Math.round(project.bpm * 10) / 10} onChange={(e) => store.set((p) => ({ ...p, bpm: Math.max(30, Math.min(240, Number(e.target.value) || p.bpm)) }), { merge: "bpm" })} />
            <small>BPM</small>
          </label>
          <select className="rv-sig" value={project.beats} onChange={(e) => store.set((p) => ({ ...p, beats: Number(e.target.value) }))} title="الميزان" aria-label="الميزان">
            <option value={2}>2/4</option>
            <option value={3}>3/4</option>
            <option value={4}>4/4</option>
            <option value={6}>6/8</option>
          </select>
          <button type="button" className={`rv-tbtn${project.metronome ? " on" : ""}`} onClick={() => set({ metronome: !project.metronome })} title="المترونوم (C)"><Icon d="M8 3h8l4 18H4zM12 15l6-9" /></button>
          <button type="button" className={`rv-tbtn rv-tbtn-w${project.countIn ? " on" : ""}`} onClick={() => set({ countIn: !project.countIn })} title="عدّ بار قبل التسجيل">عدّ</button>
          <span className="rv-grow" />
          <button type="button" className={`rv-tbtn rv-tbtn-w${monitor ? " on" : ""}`} dir="rtl" disabled={!engine.hasMic} onClick={() => {
            engine.setMonitor(!monitor);
            setMonitor(!monitor);
          }} title="اسمع نفسك وأنت تسجل — بالسماعات فقط">اسمع نفسي</button>
          <button type="button" className="rv-tbtn rv-tbtn-w" dir="rtl" onClick={() => setLatencyOpen(true)} title="لضبط مكان التسجيل بدقة، خصوصًا مع سماعات البلوتوث">معايرة التأخير</button>
        </footer>

        {latencyOpen ? <LatencyDialog engine={engine} onClose={() => setLatencyOpen(false)} /> : null}
        {job ? (
          <div className="rv-job" role="status">
            <div className="rv-job-card">
              <b>{job.title}</b>
              <div className="rv-job-bar"><i style={{ width: `${Math.max(4, job.done * 100)}%` }} /></div>
              <span>{job.what || "لحظات…"}</span>
            </div>
          </div>
        ) : null}
        {toastText ? <div className="rv-toast" role="status">{toastText}</div> : null}
      </div>
    </StudioCtx.Provider>
  );
}

/** The mark: a dome's arch holding a waveform — the gold of the shrine's dome over the turquoise of its tiles. */
export function Logo({ big }: { big?: boolean }) {
  return (
    <span className={`rv-logo${big ? " rv-logo-big" : ""}`}>
      <svg viewBox="0 0 40 40" width={big ? 52 : 22} height={big ? 52 : 22} aria-hidden>
        <defs>
          <linearGradient id="rv-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f6d27a" />
            <stop offset="1" stopColor="#c9962e" />
          </linearGradient>
        </defs>
        <path d="M20 3c2 5 13 8 13 19v13H7V22C7 11 18 8 20 3z" fill="none" stroke="url(#rv-g)" strokeWidth="2.4" strokeLinejoin="round" />
        <g stroke="#2fd6c3" strokeWidth="2.4" strokeLinecap="round">
          <path d="M12.5 25v4M16.2 21v12M20 17v20M23.8 21v12M27.5 25v4" />
        </g>
      </svg>
      <span className="rv-logo-text">
        <b>{RIDHA.name}</b>
        {big ? <i>{RIDHA.nameEn}</i> : null}
      </span>
    </span>
  );
}
