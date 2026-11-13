"use client";

// «الرضا فويس» — the studio. THE TRACKS ARE THE SCREEN: one bar on top (the project, the transport, import and
// export), then the track list and its clips filling everything, and a slim dock at the bottom whose five buttons
// open a panel only when asked — effects of the selected track, the selected clip's tools, the mixer, harmony and
// arrangement, and «الرضا ماكس». What belongs to a selected clip floats over the tracks as a small bar; what is set
// once (snap, count-in, latency) sits behind one settings button. It owns the engine and the project's store, saves
// a moment after every change, and gives every panel the same few verbs.
//
// On a phone the same studio is laid out for a thumb, the way the phone workstations do it (BandLab's Mix Editor is
// the model): it takes the whole screen; a slim bar on top holds the way out, the time and export; the transport
// sits along the BOTTOM with the record button large in its middle; and the tools open from one button as sheets
// that rise from the bottom, with the tracks still visible above them.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RIDHA } from "@config/ridha";
import { addClip, addMarker, addRecording, addTrack, armTrack, chooseTake, clipOf, deleteClips, duplicateClips, patchClip, punchRecording, replaceSound, splitClip, takesOf, trackOf } from "@/lib/ridha/ops";
import { barSec, barsLabel, clockLabel, SR, type Clip, type Project } from "@/lib/ridha/model";
import { StudioCtx, type PanelId, type Studio as StudioApi } from "./ctx";
import { decodeFile, Engine, getSound, putSound } from "./engine";
import { saveProject, Store, useProject } from "./store";
import Timeline, { type TimelineApi } from "./Timeline";
import FloatWindow from "./FloatWindow";
import { usePhone, useTouch } from "./ui";
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
import MaxPanel from "./panels/MaxPanel";
import SmartPanel from "./panels/SmartPanel";
import MasterPanel from "./panels/MasterPanel";
import LyricsPanel from "./panels/LyricsPanel";
import LatmaPanel from "./panels/LatmaPanel";
import LatencyDialog, { loadLatency } from "./LatencyDialog";
import { CHOIRS } from "@config/ridha-choirs";
import { buildChoir } from "@/lib/ridha/choir";

/** The dock: six doors. Each opens a floating window; a door with several tools shows them as tabs in the window's bar. */
const DOCK: { id: string; name: string; icon: string; size: { w: number; h: number }; tabs: { id: PanelId; name: string }[] }[] = [
  { id: "fx", size: { w: 860, h: 440 }, name: "المؤثرات", icon: "M4 6h16M4 12h16M4 18h16M8 4v4M15 10v4M10 16v4", tabs: [{ id: "fx", name: "السلسلة والجاهز" }, { id: "eq", name: "الإكولايزر" }] },
  { id: "clip", size: { w: 920, h: 480 }, name: "المقطع", icon: "M6 6a2.5 2.5 0 1 0 0 .01M6 18a2.5 2.5 0 1 0 0 .01M8 8l12 10M8 16L20 6", tabs: [{ id: "editor", name: "تحرير" }, { id: "clean", name: "تنظيف" }, { id: "smart", name: "أدوات ذكية" }, { id: "tune", name: "أوتوتيون ونغمة" }, { id: "voice", name: "تغيير الصوت" }] },
  { id: "mixer", size: { w: 1100, h: 440 }, name: "الميكسر", icon: "M6 4v16M12 4v16M18 4v16M4 9h4M10 15h4M16 7h4", tabs: [{ id: "mixer", name: "الميكسر" }, { id: "master", name: "الماستر" }] },
  { id: "create", size: { w: 1040, h: 500 }, name: "هارموني وتوزيع", icon: "M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z", tabs: [{ id: "harmony", name: "هارموني 3D" }, { id: "arrange", name: "التوزيع السريع" }, { id: "latma", name: "تركيب اللطمة" }] },
  { id: "lyrics", size: { w: 420, h: 520 }, name: "الكلمات", icon: "M5 5h14M5 10h14M5 15h9M5 20h6", tabs: [{ id: "lyrics", name: "الكلمات" }] },
  { id: "max", size: { w: 460, h: 520 }, name: "الرضا ماكس", icon: "M12 3l2.2 5.3L20 9l-4.3 3.9L17 19l-5-3-5 3 1.3-6.1L4 9l5.8-.7z", tabs: [{ id: "max", name: "الرضا ماكس" }] },
];

const Icon = ({ d, size = 15, fill }: { d: string; size?: number; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

/** The files of a drop that carry sound: audio, or a video whose sound is taken. */
export const soundFiles = (list: FileList) => [...list].filter((f) => f.type.startsWith("audio/") || f.type.startsWith("video/") || /\.(wav|mp3|m4a|aac|ogg|flac|opus|webm|mp4|mov|aif|aiff)$/i.test(f.name));

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
  // the open tool windows, the front one last, and the tab each one shows
  const [wins, setWins] = useState<string[]>([]);
  const [tabOf, setTabOf] = useState<Record<string, PanelId>>({});
  /** Opens a tool's window, or brings it to the front. */
  const focusWin = useCallback((gid: string) => setWins((w) => [...w.filter((x) => x !== gid), gid]), []);
  const [prefs, setPrefs] = useState(false);
  const phone = usePhone();
  const touch = useTouch();
  // the phone's list of tools, opened from the bottom bar
  const [tools, setTools] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [choirOpen, setChoirOpen] = useState(false);
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
  // the stretch being punched into (recording inside the loop region only), while such a take is running
  const punch = useRef<{ a: number; b: number } | null>(null);
  const taps = useRef<number[]>([]);
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
          // every file becomes a track of its own, named after it — unless it was dropped on a track that is still empty
          let q = p;
          let tid = i === 0 && trackId && !q.clips.some((c) => c.trackId === trackId) ? trackId : null;
          if (tid) q = { ...q, tracks: q.tracks.map((t) => (t.id === tid ? { ...t, stereo: channels.length > 1 } : t)) };
          else {
            const made = addTrack(q, s.name.slice(0, 28), { stereo: channels.length > 1 });
            q = made.project;
            tid = made.track.id;
          }
          const r = addClip(q, { trackId: tid, assetId: s.id, start: at, dur, name: s.name });
          setSelClips([r.clip.id]);
          setSelTrack(tid);
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
      if (input.files?.length) void importFiles([...input.files], null, engine.position());
    };
    input.click();
  }, [engine, importFiles]);

  // ── transport ──

  const stopRec = useCallback(() => {
    const p = store.get();
    const armed = p.tracks.find((t) => t.arm);
    const rec = engine.stopRecording();
    const zone = punch.current;
    punch.current = null;
    setRecStart(null);
    if (!rec || !armed) return;
    let channels = rec.channels;
    if (zone) {
      // a punch keeps only what was sung inside the region: the bar before it was the run-up
      const a = Math.max(0, Math.round((zone.a - rec.start) * SR)), b = Math.min(channels[0].length, Math.round((zone.b - rec.start) * SR));
      if (b - a < SR * 0.15) {
        toast("وقف التسجيل قبل ما يوصل المنطقة المحددة، فما انحفظ شيء.");
        engine.seek(rec.start);
        return;
      }
      channels = channels.map((ch) => ch.slice(a, b));
    }
    const dur = channels[0].length / SR;
    if (dur < 0.15) return;
    const n = p.clips.filter((c) => c.trackId === armed.id).length + 1;
    const s = putSound(channels, `${armed.name} · تسجيل ${n}`);
    store.set((q) => {
      const r = zone ? punchRecording(q, armed.id, s.id, zone.a, zone.a + dur, `تسجيل ${n}`) : addRecording(q, armed.id, s.id, rec.start, dur, `تسجيل ${n}`);
      setSelClips([r.clip.id]);
      setSelTrack(armed.id);
      return r.project;
    });
    engine.seek(rec.start);
  }, [engine, store, toast]);

  // a recording is stopped at the longest length the device's memory can be trusted with
  useEffect(() => {
    if (recStart == null) return;
    const t = setInterval(() => {
      if (engine.recording && engine.position() - recStart > RIDHA.maxMinutes * 60) stopRec();
    }, 1000);
    // a punch ends by itself where its region ends
    const out = setInterval(() => {
      if (engine.recording && punch.current && engine.position() >= punch.current.b + 0.06) stopRec();
    }, 40);
    return () => {
      clearInterval(t);
      clearInterval(out);
    };
  }, [engine, recStart, stopRec]);

  const toggleRecord = useCallback(async () => {
    if (engine.recording) return stopRec();
    // nothing armed: the selected track is (a group records nothing, so then the first real track)
    if (!store.get().tracks.some((t) => t.arm)) store.set((q) => armTrack(q, q.tracks.find((t) => t.id === selTrack && t.kind !== "group")?.id ?? q.tracks.find((t) => t.kind !== "group")!.id), { undo: false });
    const p = store.get();
    try {
      // a punch records only inside the loop region: playback starts a bar before it (the run-up) and the take ends with it
      const zone = p.punch && p.loop.end > p.loop.start + 0.2 ? { a: p.loop.start, b: p.loop.end } : null;
      const runUp = zone ? Math.min(zone.a, barSec(p)) : 0;
      const from = zone ? zone.a - runUp : engine.position();
      // the other tracks play while the armed one records; a stereo track records two channels
      await engine.record(from, zone && runUp > 0.5 ? false : p.countIn, p.tracks.find((t) => t.arm)?.stereo === true);
      punch.current = zone;
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
        F3: () => focusWin("mixer"),
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
          setPrefs(false);
          setTools(false);
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
  }, [duplicate, engine, focusWin, paste, remove, selClips, split, store, togglePlay, toggleRecord]);

  const openPanel = useCallback((p: PanelId) => {
    // exporting is an act, not a place to stay: it opens as a dialog
    if (p === "export") return setExportOpen(true);
    const g = DOCK.find((d) => d.tabs.some((t) => t.id === p));
    if (!g) return;
    setTabOf((m) => ({ ...m, [g.id]: p }));
    focusWin(g.id);
  }, [focusWin]);
  const frontGroup = DOCK.find((d) => d.id === wins[wins.length - 1]);
  const panel: PanelId = frontGroup ? tabOf[frontGroup.id] ?? frontGroup.tabs[0].id : "mixer";
  const api: StudioApi = useMemo(
    () => ({ engine, store, project, selClips, selTrack, select, clip, track, panel, openPanel, work, toast, clipSound, applyToClip }),
    [engine, store, project, selClips, selTrack, select, clip, track, panel, openPanel, work, toast, clipSound, applyToClip],
  );

  const takes = clip ? takesOf(project, clip) : [];
  const set = (patch: Partial<Project>) => store.set((p) => ({ ...p, ...patch }), { undo: false });
  const dockHint = (id: string) => (id === "fx" ? (selTrack === "master" ? "الماستر" : track?.name ?? "") : id === "clip" ? clip?.name ?? "اختر مقطعًا" : "");

  // the transport's pieces: one row in the top bar on a desk; on a phone the time stays on top and the rest goes to the bottom bar
  const seek0 = <button type="button" className="rv-ib" onClick={() => engine.seek(0)} title="للبداية (Home)" aria-label="للبداية"><Icon d="M6 5h2v14H6zM20 5v14L9 12z" fill /></button>;
  const play = <button type="button" className={`rv-tr-play${engine.playing && !engine.recording ? " on" : ""}`} onClick={togglePlay} title="تشغيل / إيقاف (مسافة)" aria-label="تشغيل أو إيقاف"><Icon d={engine.playing ? "M7 5h4v14H7zM13 5h4v14h-4z" : "M8 5v14l11-7z"} fill size={20} /></button>;
  const rec = <button type="button" className={`rv-tr-rec${engine.recording ? " on" : ""}`} onClick={() => void toggleRecord()} title="تسجيل على المسار الجاهز، والباقي يشتغل (R)" aria-label="تسجيل"><i /></button>;
  const lcd = (
    <div className="rv-lcd" dir="ltr">
      <span ref={barsEl} className="rv-time-bars">1.1.1</span>
      <span ref={clockEl} className="rv-time-clock">0:00.000</span>
    </div>
  );
  const tempo = (
    <>
      <label className="rv-bpm" title="السرعة (ضربة في الدقيقة)">
        <input type="number" inputMode="numeric" min={30} max={240} step={1} value={Math.round(project.bpm * 10) / 10} onChange={(e) => store.set((p) => ({ ...p, bpm: Math.max(30, Math.min(240, Number(e.target.value) || p.bpm)) }), { merge: "bpm" })} />
        <small>BPM</small>
      </label>
      <button type="button" className="rv-tap" onClick={() => {
        // the tempo tapped by hand: the average of the last taps (a pause of two seconds starts over)
        const now = performance.now();
        const t = taps.current.length && now - taps.current[taps.current.length - 1] > 2000 ? [] : taps.current.slice(-7);
        t.push(now);
        taps.current = t;
        if (t.length >= 3) store.set((p) => ({ ...p, bpm: Math.max(30, Math.min(240, Math.round(60000 / ((t[t.length - 1] - t[0]) / (t.length - 1))))) }), { merge: "bpm" });
      }} title="انقر الإيقاع بإصبعك ثلاث مرات أو أكثر والسرعة تنضبط عليه" aria-label="انقر الإيقاع">TAP</button>
      <select className="rv-sig" value={project.beats} onChange={(e) => store.set((p) => ({ ...p, beats: Number(e.target.value) }))} title="الميزان" aria-label="الميزان">
        <option value={2}>2/4</option>
        <option value={3}>3/4</option>
        <option value={4}>4/4</option>
        <option value={6}>6/8</option>
      </select>
    </>
  );
  const loopBtn = <button type="button" className={`rv-ib${project.loop.on ? " on" : ""}`} onClick={() => set({ loop: { ...project.loop, on: !project.loop.on } })} title="تكرار المنطقة (L) — اسحب على المسطرة لتحديدها" aria-label="تكرار المنطقة"><Icon d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" /></button>;
  const metroBtn = <button type="button" className={`rv-ib${project.metronome ? " on" : ""}`} onClick={() => set({ metronome: !project.metronome })} title="المترونوم (C)" aria-label="المترونوم"><Icon d="M8 3h8l4 18H4zM12 15l6-9" /></button>;
  const prefsBtn = <button type="button" className={`rv-ib${prefs ? " on" : ""}`} onClick={() => setPrefs(!prefs)} title="إعدادات التسجيل والشبكة" aria-label="الإعدادات" aria-expanded={prefs}><Icon d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4" /></button>;
  const undoBtn = <button type="button" className="rv-ib" onClick={() => store.undo()} disabled={!store.canUndo} title="تراجع (⌘Z)" aria-label="تراجع"><Icon d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></button>;
  const redoBtn = <button type="button" className="rv-ib" onClick={() => store.redo()} disabled={!store.canRedo} title="إعادة (⇧⌘Z)" aria-label="إعادة"><Icon d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" /></button>;
  const prefsPop = prefs ? (
    <>
      <div className="rv-scrim" onPointerDown={() => setPrefs(false)} />
      <div className="rv-pop rv-prefs" dir="rtl" onPointerLeave={(e) => e.pointerType === "mouse" && setPrefs(false)}>
        {phone ? (
          <>
            <label className="rv-pop-row"><span>اسم المشروع</span><input className="rv-sheet-name" value={project.name} onChange={(e) => store.set((p) => ({ ...p, name: e.target.value }), { merge: "name" })} aria-label="اسم المشروع" /></label>
            <div className="rv-pop-row" dir="ltr">{tempo}{loopBtn}<span className={`rv-saved ${saved}`}>{saved === "saved" ? "محفوظ" : saved === "saving" ? "يحفظ…" : "لم يُحفظ"}</span></div>
          </>
        ) : null}
        <label className="rv-check"><input type="checkbox" checked={project.snap} onChange={() => set({ snap: !project.snap })} />المقاطع تلتصق بالشبكة عند السحب</label>
        <label className="rv-check"><input type="checkbox" checked={project.countIn} onChange={() => set({ countIn: !project.countIn })} />عدّ بار كامل قبل ما يبدأ التسجيل</label>
        <label className="rv-check"><input type="checkbox" checked={!!project.punch} onChange={() => set({ punch: !project.punch })} />سجّل داخل منطقة التكرار فقط (يشتغل بار قبلها ويوقف عند نهايتها)</label>
        <label className="rv-check"><input type="checkbox" checked={monitor} disabled={!engine.hasMic} onChange={() => {
          engine.setMonitor(!monitor);
          setMonitor(!monitor);
        }} />اسمع نفسي وأنا أسجّل (بالسماعات فقط)</label>
        <button type="button" className="rv-pop-btn" onClick={() => {
          setLatencyOpen(true);
          setPrefs(false);
        }}>معايرة التأخير (سماعات البلوتوث)</button>
        <button type="button" className="rv-pop-btn" onClick={() => store.set((p) => addMarker(p, engine.position()))}>علامة عند المؤشر{phone ? "" : " (M)"}</button>
        {phone ? <small className="rv-muted">إصبع واحد يحرّك العرض · إصبعان يكبّران ويصغّران · لمسة على المقطع تحدده ثم اسحبه</small> : <small className="rv-muted">اختصارات: مسافة تشغيل · R تسجيل · S قص · L تكرار · ⌘Z تراجع · ⌘D تكرار المقطع · H و G تكبير وتصغير</small>}
      </div>
    </>
  ) : null;

  return (
    <StudioCtx.Provider value={api}>
      <div className={`rv rv-studio${phone ? " rv-phone" : ""}${touch || phone ? " rv-touch" : ""}${dropping ? " rv-dropping" : ""}`} onDragOver={(e) => {
        // a file dragged in from the computer can be let go anywhere: it becomes a new track
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        if (!dropping) setDropping(true);
      }} onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
      }} onDrop={(e) => {
        e.preventDefault();
        setDropping(false);
        const files = soundFiles(e.dataTransfer.files);
        if (files.length) void importFiles(files, null, engine.position());
        else if (e.dataTransfer.files.length) toast("هذا الملف ليس صوتًا ولا فيديو أقدر آخذ صوته.");
      }}>
        {/* ── one bar on top: the project, the transport, the two big actions ── */}
        <header className="rv-top">
          <div className="rv-top-a">
            <button type="button" className="rv-ib" onClick={onExit} title="مشاريعي" aria-label="مشاريعي"><Icon d="M9 6l6 6-6 6" /></button>
            <Logo />
            <input className="rv-name" value={project.name} onChange={(e) => store.set((p) => ({ ...p, name: e.target.value }), { merge: "name" })} aria-label="اسم المشروع" />
            <span className={`rv-saved ${saved}`} title={saved === "error" ? "تعذّر الحفظ على الجهاز (المساحة ممتلئة؟)" : "يُحفظ على هذا الجهاز تلقائيًا"}>{saved === "saved" ? "محفوظ" : saved === "saving" ? "يحفظ…" : "لم يُحفظ"}</span>
          </div>

          {phone ? lcd : (
            <div className="rv-transport" dir="ltr">
              {seek0}
              {play}
              {rec}
              {lcd}
              {tempo}
              {loopBtn}
              {metroBtn}
              {prefsBtn}
              {prefsPop}
            </div>
          )}

          <div className="rv-top-b">
            {phone ? prefsBtn : undoBtn}
            {phone ? <button type="button" className="rv-ib" onClick={pickFiles} title="استيراد ملف صوت أو فيديو" aria-label="استيراد ملف"><Icon d="M12 3v12M7 10l5 5 5-5M5 21h14" /></button> : redoBtn}
            {phone ? null : <button type="button" className="rv-topbtn" onClick={pickFiles} title="أضف ملف صوت أو فيديو (يؤخذ صوته)">استيراد</button>}
            <button type="button" className="rv-topbtn primary" onClick={() => setExportOpen(true)}>تصدير</button>
          </div>
        </header>

        {/* ── the tracks: the whole screen is theirs ── */}
        <div className="rv-work">
          <Timeline onImport={importFiles} onPick={pickFiles} onRecord={() => void toggleRecord()} onChoir={() => setChoirOpen(true)} recStart={recStart} apiRef={tl} tool="select" />
          {clip ? (
            <div className="rv-selbar" dir="rtl" role="toolbar" aria-label="المقطع المحدد">
              <b title={clip.name}>{clip.name}</b>
              <button type="button" onClick={split} title="قص عند المؤشر (S)">قص</button>
              <button type="button" onClick={duplicate} title="تكرار (⌘D)">تكرار</button>
              <button type="button" onClick={() => store.set((p) => patchClip(p, clip.id, { muted: !clip.muted }))}>{clip.muted ? "تشغيل" : "كتم"}</button>
              <i />
              <button type="button" onClick={() => openPanel("editor")}>تحرير</button>
              <button type="button" onClick={() => openPanel("clean")}>تنظيف</button>
              <button type="button" onClick={() => openPanel("tune")}>أوتوتيون</button>
              {takes.length > 1 ? (
                <>
                  <i />
                  <span>التيكات</span>
                  {takes.map((t, i) => (
                    <button key={t.id} type="button" className={`take${!t.muted ? " on" : ""}`} onClick={() => {
                      store.set((p) => chooseTake(p, t.id));
                      setSelClips([t.id]);
                    }}>{i + 1}</button>
                  ))}
                </>
              ) : null}
              <i />
              <button type="button" className="danger" onClick={remove} title="حذف (Delete)">حذف</button>
            </div>
          ) : null}
        </div>

        {/* ── the tools: windows floating over the tracks, opened from the dock and left open as long as wanted ── */}
        {wins.map((gid, i) => {
          const g = DOCK.find((d) => d.id === gid)!;
          const tab = tabOf[gid] ?? g.tabs[0].id;
          return (
            <FloatWindow key={gid} id={gid} title={g.name} hint={dockHint(gid)} size={g.size} order={i} top={i === wins.length - 1} onFocus={() => focusWin(gid)} onClose={() => setWins((w) => (phone ? [] : w.filter((x) => x !== gid)))}
              tabs={g.tabs.length > 1 ? (
                <span className="rv-subtabs">
                  {g.tabs.map((t) => <button key={t.id} type="button" className={tab === t.id ? "on" : ""} onClick={() => setTabOf((m) => ({ ...m, [gid]: t.id }))}>{t.name}</button>)}
                </span>
              ) : null}>
              {tab === "mixer" ? <MixerPanel /> : null}
              {tab === "editor" ? <EditorPanel /> : null}
              {tab === "eq" ? <EqPanel /> : null}
              {tab === "fx" ? <FxPanel /> : null}
              {tab === "tune" ? <TunePanel /> : null}
              {tab === "clean" ? <CleanPanel /> : null}
              {tab === "harmony" ? <HarmonyPanel /> : null}
              {tab === "arrange" ? <ArrangePanel /> : null}
              {tab === "latma" ? <LatmaPanel /> : null}
              {tab === "voice" ? <VoicePanel /> : null}
              {tab === "smart" ? <SmartPanel /> : null}
              {tab === "master" ? <MasterPanel /> : null}
              {tab === "lyrics" ? <LyricsPanel /> : null}
              {tab === "max" ? <MaxPanel /> : null}
            </FloatWindow>
          );
        })}
        {phone ? (
          // the phone's bottom bar: the transport under the thumb, record large in the middle, the tools behind one button
          <nav className="rv-mbar" dir="ltr" aria-label="التشغيل والتسجيل">
            <button type="button" className={`rv-ib rv-mb-tools${tools || wins.length ? " on" : ""}`} onClick={() => setTools(true)} aria-label="الأدوات" aria-expanded={tools}><Icon d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" size={18} /></button>
            {undoBtn}
            {seek0}
            {rec}
            {play}
            {redoBtn}
            {metroBtn}
          </nav>
        ) : (
          <nav className="rv-dock" aria-label="أدوات الاستوديو">
            {DOCK.map((g) => {
              const on = wins.includes(g.id);
              return (
                <button key={g.id} type="button" className={`${on ? "on" : ""}${g.id === "max" ? " max" : ""}`} onClick={() => {
                  // a press opens the window, or brings it to the front; a press on the front window closes it
                  if (wins[wins.length - 1] === g.id) setWins((w) => w.filter((x) => x !== g.id));
                  else focusWin(g.id);
                }}>
                  <Icon d={g.icon} size={16} />
                  <span>{g.name}</span>
                  {dockHint(g.id) ? <small>{dockHint(g.id)}</small> : null}
                </button>
              );
            })}
          </nav>
        )}
        {phone ? prefsPop : null}
        {phone && tools ? (
          <>
            <div className="rv-scrim" onPointerDown={() => setTools(false)} />
            <div className="rv-pop rv-tools" dir="rtl" role="dialog" aria-label="الأدوات">
              {DOCK.map((g) => (
                <section key={g.id}>
                  <b><Icon d={g.icon} size={15} />{g.name}{dockHint(g.id) ? <small>{dockHint(g.id)}</small> : null}</b>
                  <div>
                    {g.tabs.map((t) => (
                      <button key={t.id} type="button" className={g.id === "max" ? "max" : ""} onClick={() => {
                        openPanel(t.id);
                        setTools(false);
                      }}>{t.name}</button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : null}

        {exportOpen ? (
          <div className="rv-dialog" role="dialog" aria-label="التصدير" onPointerDown={(e) => e.target === e.currentTarget && setExportOpen(false)}>
            <div className="rv-dialog-card rv-dialog-wide">
              <div className="rv-panel-bar">
                <b>تصدير المشروع</b>
                <span className="rv-grow" />
                <button type="button" className="rv-ib" onClick={() => setExportOpen(false)} title="إغلاق"><Icon d="M6 6l12 12M18 6L6 18" /></button>
              </div>
              <ExportPanel />
            </div>
          </div>
        ) : null}
        {choirOpen ? (
          <div className="rv-dialog" role="dialog" aria-label="كورال" onPointerDown={(e) => e.target === e.currentTarget && setChoirOpen(false)}>
            <div className="rv-dialog-card rv-dialog-wide">
              <div className="rv-panel-bar">
                <b>اختر الكورال</b>
                <span className="rv-muted">يجهّز لك المسارات بأدوارها؛ تسجّل كل مسار بدوره</span>
                <span className="rv-grow" />
                <button type="button" className="rv-ib" onClick={() => setChoirOpen(false)} title="إغلاق"><Icon d="M6 6l12 12M18 6L6 18" /></button>
              </div>
              <div className="rv-choirs">
                {CHOIRS.map((c) => (
                  <button key={c.id} type="button" className="rv-card" onClick={() => {
                    const made = buildChoir(store.get(), c);
                    store.set(made.project);
                    setSelTrack(made.first);
                    setChoirOpen(false);
                    toast(`«${c.name}»: ${c.parts.length} مسارات جاهزة داخل قروب — سجّل كل مسار بدوره (● على المسار ثم زر التسجيل)`);
                  }}>
                    <b>{c.name} <small>· {c.parts.length} مسارات</small></b>
                    <small>{c.hint}</small>
                    <ol>{c.parts.map((x) => <li key={x.name}><b>{x.name}:</b> {x.sing}</li>)}</ol>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
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
