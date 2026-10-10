"use client";

// «زهراء فوتو ماستر» — the editor: the canvas in the middle (drag a layer, pull its corner), the panels (sliders, looks, crop
// and size, layers with their settings) and «زهراء» in her own tab, who edits by commands the page carries out — one step
// of undo each. Everything goes through src/lib/photo/doc.ts, so what she does and what the buttons do are the same thing.
// A project that came from «كاظم» can go back to him, edited: the words stay real text for him.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADJUSTS, ADJUST_GROUPS, FILTERS, HSL_BANDS, HSL_PARTS, NO_ADJUST, PHOTO, RATIOS, SIZE_PRESETS, hslKey, type AdjustGroup, type AdjustKey, type HslBand } from "@config/photo";
import { LAYER_EFFECTS } from "@config/designer";
import { applyOp, docChanges, readDoc, type Op, type PhotoDoc, type PhotoLayer, type ShapeLayer, type TextLayer } from "@/lib/photo/doc";
import { postJson } from "@/lib/fetch";
import { loadFont, type FontDef } from "@/components/jawad/designer/LayerEditor";
import { ensureFonts, exportBlob, loadImageUrl, renderPhoto, type Box } from "./render";

interface FileView {
  id: string;
  name: string;
  role: string;
  width: number;
  height: number;
}
interface Turn {
  role: "user" | "assistant";
  text: string;
  suggestions?: string[];
  note?: boolean;
  error?: boolean;
}
interface ProjectView {
  id: string;
  title: string;
  doc: PhotoDoc;
  record: string;
  messages: Turn[];
  source: { kind: string; chatId?: string; label?: string } | null;
}
type Tab = "adjust" | "filters" | "crop" | "layers" | "zahraa";
type Ask = { kind: "generate" | "cutout" | "edit"; prompt: string; aspect: string; target: "base" | "layer" | "file"; source: string };

/** The tool rail on the LEFT, the way a design app is laid out: a tool is pressed, its own panel opens on the right. */
const TABS: { id: Tab; icon: string; label: string; hint: string }[] = [
  { id: "zahraa", icon: "✨", label: "زهراء", hint: "اطلب أي تعديل بالكلام" },
  { id: "adjust", icon: "🎚️", label: "التلوين", hint: "الضوء واللون والتفاصيل — مثل لايت روم" },
  { id: "filters", icon: "🎞️", label: "لوكات", hint: "لوك جاهز بقوّة تتحكم فيها" },
  { id: "crop", icon: "✂️", label: "قص ومقاس", hint: "النسبة والمقاس والتدوير" },
  { id: "layers", icon: "🗂️", label: "طبقات", hint: "نص وأشكال وصور، وكل عنصر على حدة" },
];
/** How far the picture is zoomed on the stage: «يناسب الشاشة» or a real number. */
const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const MAX_HISTORY = 60;
const STAGE_PREVIEW = 1100;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const j = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(j.error ?? "تعذّر تنفيذ الطلب.");
  return j;
}

const ROLE_LABEL: Record<string, string> = { base: "الصورة الأساسية", layer: "صورة مضافة", made: "من جواد", export: "تصدير" };

export default function PhotoEditor({ projectId, persona }: { projectId: string; persona: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [doc, setDoc] = useState<PhotoDoc | null>(null);
  const [files, setFiles] = useState<FileView[]>([]);
  const [messages, setMessages] = useState<Turn[]>([]);
  const [source, setSource] = useState<ProjectView["source"]>(null);
  const [cutoutOn, setCutoutOn] = useState(true);
  const [fonts, setFonts] = useState<FontDef[]>([]);
  const [images, setImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [tab, setTab] = useState<Tab>("zahraa");
  const [selected, setSelected] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [saved, setSaved] = useState<"" | "saving" | "saved" | "error">("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [askReturn, setAskReturn] = useState(false);
  const [focus, setFocus] = useState({ x: 50, y: 50 });
  const [msg, setMsg] = useState("");
  const [typing, setTyping] = useState(false);
  // the stage: «يناسب» or a zoom, and «قبل/بعد» held down to see the picture before any colouring
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [compare, setCompare] = useState(false);
  const [band, setBand] = useState<HslBand>("red");
  const [shut, setShut] = useState<Record<string, boolean>>({});

  const canvas = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PhotoDoc | null>(null);
  const past = useRef<PhotoDoc[]>([]);
  const future = useRef<PhotoDoc[]>([]);
  const gesture = useRef<PhotoDoc | null>(null);
  const [, bump] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const pickBase = useRef<HTMLInputElement>(null);
  const renderToken = useRef(0);

  const ctxFiles = useMemo(() => new Map(files.map((f) => [f.id, { w: f.width, h: f.height }])), [files]);
  const fontIds = useMemo(() => fonts.map((f) => f.id), [fonts]);

  // ── loading the project and the fonts
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [p, f] = await Promise.all([
          api<{ project: ProjectView; files: FileView[]; cutout: boolean }>(`/api/photo/projects?id=${projectId}`),
          api<{ fonts: FontDef[] }>("/api/designer/fonts"),
        ]);
        if (dead) return;
        setTitle(p.project.title);
        setDoc(readDoc(p.project.doc));
        docRef.current = readDoc(p.project.doc);
        setFiles(p.files);
        setMessages(p.project.messages);
        setSource(p.project.source);
        setCutoutOn(p.cutout);
        setFonts(f.fonts);
        setLoaded(true);
      } catch (e) {
        if (!dead) setError((e as Error).message);
      }
    })();
    return () => { dead = true; };
  }, [projectId]);

  // ── the pictures the project uses
  useEffect(() => {
    if (!doc) return;
    const need = new Set<string>([...(doc.base ? [doc.base.fileId] : []), ...doc.layers.flatMap((l) => (l.kind === "image" ? [l.fileId] : []))]);
    const missing = [...need].filter((id) => !images.has(id));
    if (!missing.length) return;
    let dead = false;
    void Promise.all(missing.map((id) => loadImageUrl(`/api/photo/image?id=${id}`).then((im) => [id, im] as const).catch(() => null))).then((list) => {
      if (dead) return;
      setImages((m) => {
        const n = new Map(m);
        for (const x of list) if (x) n.set(x[0], x[1]);
        return n;
      });
    });
    return () => { dead = true; };
  }, [doc, images]);

  // ── drawing
  useEffect(() => {
    if (!doc || !canvas.current || !fonts.length) return;
    const token = ++renderToken.current;
    const c = canvas.current;
    // «قبل»: the same project with every slider and look off, so the eye compares the real before and after
    const shown = compare ? { ...doc, adjust: { ...NO_ADJUST }, filter: { id: "none", strength: 0 } } : doc;
    const raf = requestAnimationFrame(() => {
      void ensureFonts(shown, fonts).then(() => {
        if (token !== renderToken.current) return;
        const k = Math.min(1, STAGE_PREVIEW / Math.max(shown.width, shown.height));
        setBoxes(renderPhoto(c, shown, { scale: k, images, fonts }));
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [doc, images, fonts, compare]);

  // ── history
  const push = (d: PhotoDoc) => {
    past.current.push(d);
    if (past.current.length > MAX_HISTORY) past.current.shift();
    future.current = [];
  };
  /** A change: a step of undo of its own (`live` for a drag or a slider: the step is closed by endGesture). */
  const change = useCallback((fn: (d: PhotoDoc) => PhotoDoc, live = false) => {
    const cur = docRef.current;
    if (!cur) return;
    const next = fn(cur);
    if (next === cur) return;
    if (live) {
      if (!gesture.current) gesture.current = cur;
    } else {
      push(cur);
    }
    docRef.current = next;
    setDoc(next);
    dirty.current = true;
    bump((n) => n + 1);
  }, []);
  const endGesture = useCallback(() => {
    const g = gesture.current;
    gesture.current = null;
    if (g && docRef.current && JSON.stringify(g) !== JSON.stringify(docRef.current)) {
      push(g);
      bump((n) => n + 1);
    }
  }, []);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    const cur = docRef.current;
    if (!prev || !cur) return;
    future.current.push(cur);
    docRef.current = prev;
    setDoc(prev);
    dirty.current = true;
    bump((n) => n + 1);
  }, []);
  const redo = useCallback(() => {
    const next = future.current.pop();
    const cur = docRef.current;
    if (!next || !cur) return;
    past.current.push(cur);
    docRef.current = next;
    setDoc(next);
    dirty.current = true;
    bump((n) => n + 1);
  }, []);

  const op = useCallback((o: Op, live = false) => {
    change((d) => {
      const r = applyOp(d, o, { files: ctxFiles, fonts: fontIds });
      if ("error" in r) {
        setNotice(r.error);
        return d;
      }
      return r.doc;
    }, live);
  }, [change, ctxFiles, fontIds]);

  const patchLayer = useCallback((id: string, patch: Record<string, unknown>, live = false) => op({ op: "update", id, patch }, live), [op]);

  // ── saving
  useEffect(() => {
    if (!doc || !dirty.current) return;
    setSaved("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/photo/projects", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: projectId, doc }) })
        .then((r) => { setSaved(r.ok ? "saved" : "error"); if (r.ok) dirty.current = false; })
        .catch(() => setSaved("error"));
    }, 900);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [doc, projectId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typingIn = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (!typingIn && (e.key === "Delete" || e.key === "Backspace") && selected) { e.preventDefault(); op({ op: "delete", id: selected }); setSelected(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, op, selected]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "end" }); }, [messages, typing, tab]);

  // ── dragging a layer on the stage
  const stage = useRef<HTMLDivElement>(null);
  const startDrag = (e: React.PointerEvent, id: string, mode: "move" | "size") => {
    e.stopPropagation();
    e.preventDefault();
    setSelected(id);
    const el = stage.current;
    const layer = docRef.current?.layers.find((l) => l.id === id);
    if (!el || !layer) return;
    const r = el.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const x0 = layer.x;
    const y0 = layer.y;
    const w0 = layer.kind === "shape" || layer.kind === "text" || layer.kind === "image" ? layer.w : 0;
    const h0 = layer.kind === "shape" ? layer.h : 0;
    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - sx) / r.width) * 100;
      const dy = ((ev.clientY - sy) / r.height) * 100;
      if (mode === "move") patchLayer(id, { x: Math.max(0, Math.min(100, x0 + dx)), y: Math.max(0, Math.min(100, y0 + dy)) }, true);
      else patchLayer(id, layer.kind === "shape" ? { w: Math.max(1, w0 + dx * 2), h: Math.max(0, h0 + dy * 2) } : { w: Math.max(5, w0 + dx * 2) }, true);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      endGesture();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ── files
  async function uploadFile(file: File, role: "base" | "layer") {
    setBusy("أرفع الصورة…");
    try {
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("file", file);
      fd.append("role", role);
      const r = await api<{ file: FileView }>("/api/photo/file", { method: "POST", body: fd });
      const f = { ...r.file };
      setFiles((x) => [...x, f]);
      const info = new Map([...ctxFiles, [f.id, { w: f.width, h: f.height }]]);
      change((d) => {
        const res = applyOp(d, role === "base" ? { op: "use_as_base", file: f.id } : { op: "add_image", file: f.id, x: 50, y: 50, w: 50 }, { files: info, fonts: fontIds });
        return "error" in res ? d : res.doc;
      });
      if (role === "layer") setTab("layers");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function reloadFiles() {
    const p = await api<{ files: FileView[] }>(`/api/photo/projects?id=${projectId}`);
    setFiles(p.files);
    return p.files;
  }

  // ── جواد's part of what زهراء asked
  async function runMake(ask: Ask) {
    const label = ask.kind === "cutout" ? "جواد يقصّ الخلفية…" : ask.kind === "edit" ? "جواد يعدّل الصورة…" : "جواد يجهّز الصورة…";
    setBusy(label);
    try {
      await flushSave();
      const r = await postJson<{ file: { id: string; width: number; height: number }; free: boolean; coins: number }>("/api/photo/make", { projectId, ask });
      const list = await reloadFiles();
      const info = new Map(list.map((f) => [f.id, { w: f.width, h: f.height }]));
      change((d) => {
        if (ask.target === "file") return d;
        const res = applyOp(d, ask.target === "base" ? { op: "use_as_base", file: r.file.id } : { op: "add_image", file: r.file.id, x: 50, y: 50, w: 60 }, { files: info, fonts: fontIds });
        return "error" in res ? d : res.doc;
      });
      setMessages((m) => [...m, { role: "assistant", text: ask.kind === "cutout" ? "✂️ جاهز: العنصر مقصوص بخلفية شفافة." : ask.kind === "edit" ? "🖌️ جاهز: النسخة المعدّلة." : "🎨 جاهز: الصورة من جواد.", note: true }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: `❌ ${(e as Error).message}`, error: true }]);
    } finally {
      setBusy("");
    }
  }

  async function flushSave() {
    if (!docRef.current || !dirty.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await fetch("/api/photo/projects", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: projectId, doc: docRef.current }) });
    dirty.current = false;
    setSaved("saved");
  }

  // ── زهراء
  const previewB64 = useCallback(async () => {
    const d = docRef.current;
    if (!d) return null;
    try {
      await ensureFonts(d, fonts);
      const c = document.createElement("canvas");
      renderPhoto(c, d, { scale: Math.min(1, PHOTO.previewSide / Math.max(d.width, d.height)), images, fonts });
      return c.toDataURL("image/jpeg", 0.72).split(",")[1] ?? null;
    } catch {
      return null;
    }
  }, [fonts, images]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || typing || !docRef.current) return;
    setMsg("");
    setMessages((m) => [...m.map((x) => ({ ...x, suggestions: undefined })), { role: "user", text: message }]);
    setTyping(true);
    try {
      const preview = await previewB64();
      const r = await postJson<{ reply: string; doc: PhotoDoc; changes: string[]; suggestions: string[]; jawad: Ask | null; returnTo: boolean }>("/api/photo/chat", { projectId, message, doc: docRef.current, preview });
      const before = docRef.current;
      const next = readDoc(r.doc);
      if (docChanges(before, next).length) {
        push(before);
        docRef.current = next;
        setDoc(next);
        bump((n) => n + 1);
      }
      dirty.current = false;
      setMessages((m) => [...m, { role: "assistant", text: r.reply, suggestions: r.suggestions }]);
      if (r.returnTo) setAskReturn(true);
      setTyping(false);
      if (r.jawad) await runMake(r.jawad);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: (e as Error).message, error: true }]);
    } finally {
      setTyping(false);
    }
  }

  // ── going out
  async function download(type: "image/png" | "image/jpeg" | "image/webp") {
    const d = docRef.current;
    if (!d) return;
    setBusy("أجهّز الصورة…");
    try {
      const blob = await exportBlob(d, { images, fonts }, type, 0.94);
      const ext = type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${title || "photo"}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("file", blob, a.download);
      void fetch("/api/photo/export", { method: "POST", body: fd }).catch(() => null);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function returnToKazim() {
    const d = docRef.current;
    if (!d) return;
    setBusy("أرجّع التصميم لكاظم…");
    try {
      await flushSave();
      const artwork = await exportBlob(d, { images, fonts, skipText: true });
      const final = await exportBlob(d, { images, fonts });
      const last = [...messages].reverse().find((m) => m.role === "assistant" && !m.note && !m.error);
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("artwork", artwork, "artwork.png");
      fd.append("final", final, "final.png");
      fd.append("summary", last?.text.slice(0, 1500) ?? "عدّلت زهراء الصورة.");
      const r = await api<{ url: string }>("/api/photo/return", { method: "POST", body: fd });
      window.location.href = r.url;
    } catch (e) {
      setNotice((e as Error).message);
      setBusy("");
    }
  }

  if (error) return <div className="ph"><p className="ph-error">{error} <Link href={PHOTO.base} className="ph-link">← مشاريعي</Link></p></div>;
  if (!loaded || !doc) return <div className="ph"><p className="ph-loading">…أفتح المشروع</p></div>;

  const sel = doc.layers.find((l) => l.id === selected) ?? null;
  const ratio = doc.width / doc.height;
  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;
  const fromKazim = source?.kind === "designer";

  return (
    <div className="ph" dir="rtl" style={{ ["--ar" as string]: String(ratio) }}>
      <header className="ph-top">
        <Link href={PHOTO.base} className="ph-btn" aria-label="مشاريعي">←</Link>
        <input className="ph-title" value={title} aria-label="اسم المشروع" onChange={(e) => setTitle(e.target.value)} onBlur={() => void fetch("/api/photo/projects", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: projectId, title }) })} maxLength={120} />
        <span className="ph-saved" aria-live="polite">{saved === "saving" ? "…" : saved === "saved" ? "✓ محفوظ" : saved === "error" ? "⚠️ لم يُحفظ" : ""}</span>
        <button type="button" className="ph-btn" disabled={!canUndo} onClick={undo} title="تراجع (Ctrl+Z)" aria-label="تراجع">↶</button>
        <button type="button" className="ph-btn" disabled={!canRedo} onClick={redo} title="إعادة (Ctrl+Shift+Z)" aria-label="إعادة">↷</button>
        <details className="ph-menu">
          <summary className="ph-btn ph-primary">⬇️ حفظ الصورة</summary>
          <div className="ph-pop">
            <button type="button" onClick={() => void download("image/png")}>PNG (أعلى جودة)</button>
            <button type="button" onClick={() => void download("image/jpeg")}>JPG (أخف)</button>
            <button type="button" onClick={() => void download("image/webp")}>WebP</button>
            <small>{doc.width}×{doc.height}</small>
          </div>
        </details>
        {fromKazim && <button type="button" className={`ph-btn ph-kazim${askReturn ? " pulse" : ""}`} disabled={!!busy} onClick={() => void returnToKazim()} title="يرجع التصميم لكاظم والنصوص تبقى قابلة للتعديل عنده">↩️ رجّع لكاظم</button>}
      </header>

      {(notice || busy) && (
        <div className="ph-note" role="status" onClick={() => setNotice("")}>
          {busy ? `⏳ ${busy}` : `⚠️ ${notice}`}
        </div>
      )}

      <div className="ph-body">
        <nav className="ph-rail" role="tablist" aria-label="الأدوات">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} title={t.hint} onClick={() => setTab(t.id)}>
              <span aria-hidden>{t.icon}</span>
              <small>{t.id === "zahraa" ? persona : t.label}</small>
            </button>
          ))}
          <span className="ph-rail-gap" />
          <button type="button" className="ph-rail-add" title="أضف صورة أساسية" onClick={() => pickBase.current?.click()}>
            <span aria-hidden>📷</span>
            <small>صورة</small>
          </button>
        </nav>

        <section className="ph-stage-col">
          <div className="ph-stage" onPointerDown={() => setSelected(null)}>
            <div className={`ph-canvas-wrap${zoom === "fit" ? " fit" : ""}`} ref={stage} style={zoom === "fit" ? undefined : { width: `${Math.round(Math.min(doc.width, STAGE_PREVIEW) * zoom)}px` }}>
              <canvas ref={canvas} className="ph-canvas" />
              {!doc.base && !doc.layers.length && <button type="button" className="ph-empty" onClick={() => pickBase.current?.click()}>📷 اضغط لإضافة صورة</button>}
              {canvas.current && boxes.map((b) => {
                const W = canvas.current!.width;
                const H = canvas.current!.height;
                const on = b.id === selected;
                return (
                  <div
                    key={b.id}
                    className={`ph-box${on ? " on" : ""}`}
                    style={{ left: `${((b.cx - b.w / 2) / W) * 100}%`, top: `${((b.cy - b.h / 2) / H) * 100}%`, width: `${(b.w / W) * 100}%`, height: `${(b.h / H) * 100}%`, transform: `rotate(${b.rotate}deg)` }}
                    onPointerDown={(e) => startDrag(e, b.id, "move")}
                  >
                    {on && <span className="ph-grip" onPointerDown={(e) => startDrag(e, b.id, "size")} aria-label="غيّر الحجم" />}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="ph-stage-bar">
            <button type="button" className={zoom === "fit" ? "on" : ""} onClick={() => setZoom("fit")} title="يناسب الشاشة">⤢ يناسب</button>
            <button type="button" onClick={() => setZoom((z) => (z === "fit" ? 0.75 : ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)] ?? 0.25))} aria-label="تصغير">−</button>
            <b>{zoom === "fit" ? "تلقائي" : `${Math.round(zoom * 100)}%`}</b>
            <button type="button" onClick={() => setZoom((z) => (z === "fit" ? 1.5 : ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)] ?? 4))} aria-label="تكبير">+</button>
            <span className="ph-stage-gap" />
            <button
              type="button"
              className={compare ? "on" : ""}
              title="اضغط باستمرار لترى الصورة قبل التلوين"
              onPointerDown={() => setCompare(true)}
              onPointerUp={() => setCompare(false)}
              onPointerLeave={() => setCompare(false)}
              onKeyDown={(e) => e.key === " " && setCompare(true)}
              onKeyUp={() => setCompare(false)}
            >
              👁️ قبل / بعد
            </button>
            <small className="ph-stage-size">{doc.width}×{doc.height}</small>
          </div>
          <input ref={pickBase} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f, "base"); e.target.value = ""; }} />
          <input ref={picker} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f, "layer"); e.target.value = ""; }} />
        </section>

        <aside className="ph-panel">
          <header className="ph-panel-head">
            <b>{TABS.find((t) => t.id === tab)!.icon} {tab === "zahraa" ? persona : TABS.find((t) => t.id === tab)!.label}</b>
            <small>{TABS.find((t) => t.id === tab)!.hint}</small>
          </header>

          {tab === "adjust" && (
            <div className="ph-pane">
              <p className="ph-hint">{doc.base ? "الشرائح على الصورة الأساسية (لا على النصوص). اضغط مرتين على أي شريحة ترجع صفر، أو اكتب الرقم بيدك." : "أضف صورة أساسية لتظهر آثار الشرائح."}</p>
              {ADJUST_GROUPS.map((g) => {
                const rows = ADJUSTS.filter((a) => a.group === g.id);
                const touched = rows.filter((a) => doc.adjust[a.key]).length;
                const open = !shut[g.id];
                return (
                  <section key={g.id} className={`ph-group${open ? " open" : ""}`}>
                    <button type="button" className="ph-group-head" aria-expanded={open} onClick={() => setShut((x) => ({ ...x, [g.id]: open }))}>
                      <span aria-hidden>{g.icon}</span>
                      <b>{g.label}</b>
                      {touched > 0 && <i className="ph-dot" title={`${touched} معدّلة`}>{touched}</i>}
                      <small>{g.hint}</small>
                      <em aria-hidden>{open ? "▾" : "▸"}</em>
                    </button>
                    {open && (g.id === "hsl" ? (
                      <div className="ph-mixer">
                        <div className="ph-bands" role="tablist" aria-label="عائلات الألوان">
                          {HSL_BANDS.map((b) => {
                            const used = HSL_PARTS.some((p) => doc.adjust[hslKey(p.id, b.id) as AdjustKey]);
                            return (
                              <button key={b.id} type="button" role="tab" aria-selected={band === b.id} className={`${band === b.id ? "on" : ""}${used ? " used" : ""}`} style={{ ["--sw" as string]: b.swatch }} title={b.label} onClick={() => setBand(b.id)}>
                                <span aria-hidden />
                                <small>{b.label}</small>
                              </button>
                            );
                          })}
                        </div>
                        {HSL_PARTS.map((part) => {
                          const key = hslKey(part.id, band) as AdjustKey;
                          const def = ADJUSTS.find((a) => a.key === key)!;
                          return <Slide key={key} label={part.label} hint={def.hint} min={def.min} max={def.max} step={def.step} value={doc.adjust[key]} onLive={(v) => op({ op: "adjust", values: { [key]: v } }, true)} onDone={endGesture} />;
                        })}
                        <button type="button" className="ph-btn ph-quiet" onClick={() => op({ op: "adjust", values: Object.fromEntries(HSL_PARTS.map((p) => [hslKey(p.id, band), 0])) })}>صفّر هذا اللون</button>
                      </div>
                    ) : (
                      <div className="ph-rows">
                        {rows.map((a) => (
                          <Slide key={a.key} label={a.label} hint={a.hint} min={a.min} max={a.max} step={a.step} value={doc.adjust[a.key]} onLive={(v) => op({ op: "adjust", values: { [a.key]: v } }, true)} onDone={endGesture} />
                        ))}
                        {touched > 0 && <button type="button" className="ph-btn ph-quiet" onClick={() => op({ op: "adjust", values: Object.fromEntries(rows.map((a) => [a.key, 0])) })}>صفّر {g.label}</button>}
                      </div>
                    ))}
                  </section>
                );
              })}
              <button type="button" className="ph-btn" onClick={() => op({ op: "adjust_reset" })}>تصفير كل الشرائح والفلتر</button>
            </div>
          )}

          {tab === "filters" && (
            <div className="ph-pane">
              <div className="ph-filters">
                {FILTERS.map((f) => (
                  <button key={f.id} type="button" className={doc.filter.id === f.id ? "on" : ""} title={f.hint} onClick={() => op({ op: "filter", id: f.id, strength: doc.filter.id === f.id ? doc.filter.strength : 100 })}>
                    <span>{f.icon}</span>{f.name}
                  </button>
                ))}
              </div>
              {doc.filter.id !== "none" && (
                <label className="ph-slider">
                  <span>قوة الفلتر<b>{doc.filter.strength}</b></span>
                  <input type="range" min={0} max={100} value={doc.filter.strength} onChange={(e) => op({ op: "filter", id: doc.filter.id, strength: Number(e.target.value) }, true)} onPointerUp={endGesture} onKeyUp={endGesture} />
                </label>
              )}
            </div>
          )}

          {tab === "crop" && (
            <div className="ph-pane">
              <b>نسبة القص</b>
              <div className="ph-chips">
                {RATIOS.map((r) => <button key={r} type="button" onClick={() => op({ op: "crop_ratio", ratio: r, focus })}>{r}</button>)}
              </div>
              <div className="ph-focus">
                <label>نقطة التركيز أفقيًا<input type="range" min={0} max={100} value={focus.x} onChange={(e) => setFocus({ ...focus, x: Number(e.target.value) })} /></label>
                <label>رأسيًا<input type="range" min={0} max={100} value={focus.y} onChange={(e) => setFocus({ ...focus, y: Number(e.target.value) })} /></label>
              </div>
              <b>مقاس المنصة</b>
              <select className="ph-input" value="" onChange={(e) => e.target.value && op({ op: "canvas", preset: e.target.value, focus })}>
                <option value="">اختر مقاسًا…</option>
                {SIZE_PRESETS.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.w}×{s.h}</option>)}
              </select>
              <b>قص حر</b>
              <div className="ph-grid4">
                {[["x", "من اليسار %"], ["y", "من الأعلى %"], ["w", "العرض %"], ["h", "الارتفاع %"]].map(([k, l]) => (
                  <label key={k}>{l}<input className="ph-input" type="number" min={0} max={100} defaultValue={k === "w" || k === "h" ? 100 : 0} id={`ph-crop-${k}`} /></label>
                ))}
              </div>
              <button type="button" className="ph-btn" onClick={() => {
                const v = (k: string) => Number((document.getElementById(`ph-crop-${k}`) as HTMLInputElement | null)?.value ?? 0);
                op({ op: "crop", x: v("x"), y: v("y"), w: v("w"), h: v("h") });
              }}>✂️ طبّق القص</button>
              <b>تدوير وقلب</b>
              <div className="ph-chips">
                <button type="button" onClick={() => op({ op: "rotate", deg: -90 })}>⟲ 90°</button>
                <button type="button" onClick={() => op({ op: "rotate", deg: 90 })}>⟳ 90°</button>
                <button type="button" onClick={() => op({ op: "flip", axis: "h" })}>↔️ قلب أفقي</button>
                <button type="button" onClick={() => op({ op: "flip", axis: "v" })}>↕️ قلب رأسي</button>
              </div>
              {doc.base && (
                <label className="ph-slider">
                  <span>تقويم الميل<b>{doc.base.straighten}°</b></span>
                  <input type="range" min={-15} max={15} step={0.5} value={doc.base.straighten} onChange={(e) => op({ op: "straighten", deg: Number(e.target.value) }, true)} onPointerUp={endGesture} onKeyUp={endGesture} />
                </label>
              )}
              <div className="ph-row">
                <label>لون الخلف<input type="color" value={doc.bg} onChange={(e) => op({ op: "bg", color: e.target.value }, true)} onBlur={endGesture} onPointerUp={endGesture} /></label>
                <button type="button" className="ph-btn" onClick={() => pickBase.current?.click()}>📷 استبدل الصورة الأساسية</button>
              </div>
            </div>
          )}

          {tab === "layers" && (
            <div className="ph-pane">
              <div className="ph-chips">
                <button type="button" onClick={() => { op({ op: "add_text", text: "اكتب هنا", font: fontIds[0] ?? "readex", size: 7, color: "#FFFFFF", effect: "shadow", effect_color: "#000000", x: 50, y: 50, w: 80 }); setSelected(`t${doc.layers.length + 1}`); }}>🔤 نص</button>
                <button type="button" onClick={() => op({ op: "add_shape", shape: "rect", x: 50, y: 85, w: 90, h: 14, fill: "#000000", opacity: 0.55, radius: 2 })}>▭ مستطيل</button>
                <button type="button" onClick={() => op({ op: "add_shape", shape: "ellipse", x: 50, y: 50, w: 40, h: 30, fill: "#FFFFFF", opacity: 0.4 })}>⬭ دائرة</button>
                <button type="button" onClick={() => op({ op: "add_shape", shape: "line", x: 50, y: 50, w: 60, h: 0, stroke: "#FFFFFF", stroke_w: 0.5 })}>─ خط</button>
                <button type="button" onClick={() => picker.current?.click()}>🖼️ صورة</button>
                {doc.base && <button type="button" disabled={!cutoutOn || !!busy} title={cutoutOn ? "جواد يقصّ الخلفية ويرجّع الموضوع عنصرًا شفافًا فوق الصورة (يُخصم من الرصيد)" : "غير مفعّل على الخادم"} onClick={() => void runMake({ kind: "cutout", prompt: "", aspect: "auto", target: "layer", source: "base" })}>✂️ اقصص خلفية الصورة</button>}
              </div>
              {files.filter((f) => f.role !== "export" && f.id !== doc.base?.fileId).length > 0 && (
                <details className="ph-files">
                  <summary>ملفات المشروع ({files.filter((f) => f.id !== doc.base?.fileId).length})</summary>
                  {files.filter((f) => f.id !== doc.base?.fileId).map((f) => (
                    <div key={f.id} className="ph-file">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/photo/image?id=${f.id}`} alt={f.name} loading="lazy" />
                      <span>{f.name || ROLE_LABEL[f.role]}</span>
                      <button type="button" onClick={() => op({ op: "add_image", file: f.id, x: 50, y: 50, w: 50 })}>أضف</button>
                      <button type="button" onClick={() => op({ op: "use_as_base", file: f.id })}>اجعلها الأساسية</button>
                    </div>
                  ))}
                </details>
              )}
              <ul className="ph-layers">
                {[...doc.layers].reverse().map((l) => (
                  <li key={l.id} className={l.id === selected ? "on" : ""} onClick={() => setSelected(l.id)}>
                    <span>{l.kind === "text" ? "🔤" : l.kind === "shape" ? "▭" : "🖼️"}</span>
                    <b>{l.kind === "text" ? l.text.replace(/\n/g, " ").slice(0, 22) : l.kind === "shape" ? "شكل" : "صورة"}</b>
                    <button type="button" aria-label="للأمام" onClick={(e) => { e.stopPropagation(); op({ op: "order", id: l.id, to: "up" }); }}>▲</button>
                    <button type="button" aria-label="للخلف" onClick={(e) => { e.stopPropagation(); op({ op: "order", id: l.id, to: "down" }); }}>▼</button>
                    <button type="button" aria-label="كرّر" onClick={(e) => { e.stopPropagation(); op({ op: "duplicate", id: l.id }); }}>⎘</button>
                    <button type="button" aria-label="احذف" onClick={(e) => { e.stopPropagation(); op({ op: "delete", id: l.id }); if (selected === l.id) setSelected(null); }}>🗑️</button>
                  </li>
                ))}
                {!doc.layers.length && <li className="ph-hint">لا طبقات بعد. أضف نصًا أو شكلًا أو صورة.</li>}
              </ul>
              {sel && <LayerSettings layer={sel} fonts={fonts} patch={(p, live) => patchLayer(sel.id, p, live)} end={endGesture} cutout={cutoutOn} onCutout={() => void runMake({ kind: "cutout", prompt: "", aspect: "auto", target: "layer", source: sel.id })} />}
            </div>
          )}

          {tab === "zahraa" && (
            <div className="ph-chat">
              <div className="ph-msgs">
                {messages.map((m, i) => (
                  <div key={i} className={`ph-msg ${m.role}${m.note ? " note" : ""}${m.error ? " err" : ""}`}>
                    <div dir="auto">{m.text}</div>
                    {m.suggestions && i === messages.length - 1 && !typing && (
                      <div className="ph-sugs">{m.suggestions.map((s) => <button key={s} type="button" onClick={() => void send(s)}>{s}</button>)}</div>
                    )}
                  </div>
                ))}
                {typing && <div className="ph-msg assistant"><div className="ph-dots"><i /><i /><i /></div></div>}
                {askReturn && fromKazim && <div className="ph-msg note"><div>خلصنا؟ <button type="button" className="ph-btn ph-primary" disabled={!!busy} onClick={() => void returnToKazim()}>↩️ رجّع لكاظم الآن</button></div></div>}
                <div ref={chatEnd} />
              </div>
              <form className="ph-send" onSubmit={(e) => { e.preventDefault(); void send(msg); }}>
                <textarea dir="auto" rows={2} value={msg} placeholder={`قل لـ${persona} وش تبي… مثلًا: «خلّها سينمائية» أو «اكتب اسمي تحت»`} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(msg); } }} maxLength={PHOTO.messageMax} />
                <button className="ph-btn ph-primary" disabled={typing || !!busy || !msg.trim()}>{typing ? "…" : "أرسل"}</button>
              </form>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/** The settings of the selected layer: text, shape or picture. */
function LayerSettings({ layer, fonts, patch, end, cutout, onCutout }: { layer: PhotoLayer; fonts: FontDef[]; patch: (p: Record<string, unknown>, live?: boolean) => void; end: () => void; cutout: boolean; onCutout: () => void }) {
  const num = (label: string, key: string, v: number, min: number, max: number, step = 1) => (
    <label className="ph-slider"><span>{label}<b>{Math.round(v * 100) / 100}</b></span><input type="range" min={min} max={max} step={step} value={v} onChange={(e) => patch({ [key]: Number(e.target.value) }, true)} onPointerUp={end} onKeyUp={end} /></label>
  );
  const color = (label: string, key: string, v: string) => (
    <label className="ph-color">{label}<input type="color" value={v || "#000000"} onChange={(e) => patch({ [key]: e.target.value }, true)} onPointerUp={end} onBlur={end} /></label>
  );
  if (layer.kind === "text") {
    const t: TextLayer = layer;
    return (
      <div className="ph-settings">
        <textarea dir="auto" className="ph-input" rows={3} value={t.text} onChange={(e) => patch({ text: e.target.value }, true)} onBlur={end} />
        <select className="ph-input" value={t.font} onChange={(e) => { const f = fonts.find((x) => x.id === e.target.value); if (f) void loadFont(f); patch({ font: e.target.value }); }}>
          {fonts.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        {num("الحجم %", "size", t.size, 1, 30, 0.5)}
        {num("عرض الصندوق %", "w", t.w, 10, 100)}
        <div className="ph-row">{color("اللون", "color", t.color)}{color("لون التأثير", "effect_color", t.effectColor)}</div>
        <div className="ph-chips">
          {LAYER_EFFECTS.map((e) => <button key={e.id} type="button" className={t.effect === e.id ? "on" : ""} onClick={() => patch({ effect: e.id })}>{e.name}</button>)}
        </div>
        <div className="ph-chips">
          {(["right", "center", "left"] as const).map((a) => <button key={a} type="button" className={t.align === a ? "on" : ""} onClick={() => patch({ align: a })}>{a === "right" ? "يمين" : a === "center" ? "وسط" : "يسار"}</button>)}
          <button type="button" className={t.weight === 700 ? "on" : ""} onClick={() => patch({ weight: t.weight === 700 ? 400 : 700 })}>عريض</button>
        </div>
        {num("تدوير", "rotate", t.rotate, -180, 180)}
        {num("شفافية", "opacity", t.opacity, 0, 1, 0.05)}
        {num("ارتفاع السطر", "line_height", t.lineHeight, 0.8, 2.2, 0.05)}
        {num("تباعد الحروف", "spacing", t.spacing, -10, 40)}
      </div>
    );
  }
  if (layer.kind === "shape") {
    const s: ShapeLayer = layer;
    return (
      <div className="ph-settings">
        <div className="ph-row">{color("التعبئة", "fill", s.fill)}<button type="button" className="ph-btn" onClick={() => patch({ fill: s.fill ? "" : "#000000" })}>{s.fill ? "بلا تعبئة" : "عبّئ"}</button></div>
        <div className="ph-row">{color("الحد", "stroke", s.stroke)}<button type="button" className="ph-btn" onClick={() => patch({ stroke: s.stroke ? "" : "#FFFFFF", stroke_w: s.strokeW || 0.5 })}>{s.stroke ? "بلا حد" : "أضف حدًا"}</button></div>
        {num("العرض %", "w", s.w, 1, 150)}
        {s.shape !== "line" && num("الارتفاع %", "h", s.h, 1, 150)}
        {num("سماكة الحد", "stroke_w", s.strokeW, 0, 10, 0.1)}
        {s.shape === "rect" && num("استدارة الزوايا", "radius", s.radius, 0, 50, 0.5)}
        {num("تدوير", "rotate", s.rotate, -180, 180)}
        {num("شفافية", "opacity", s.opacity, 0, 1, 0.05)}
      </div>
    );
  }
  return (
    <div className="ph-settings">
      {num("العرض %", "w", layer.w, 2, 200)}
      {num("تدوير", "rotate", layer.rotate, -180, 180)}
      {num("شفافية", "opacity", layer.opacity, 0, 1, 0.05)}
      <div className="ph-chips">
        <button type="button" onClick={() => patch({ flip: !layer.flip })}>↔️ اقلب</button>
        <button type="button" disabled={!cutout} title={cutout ? "جواد يقصّ الخلفية ويرجّع العنصر شفافًا (يُخصم من الرصيد)" : "غير مفعّل على الخادم"} onClick={onCutout}>✂️ اقصص الخلفية</button>
      </div>
    </div>
  );
}

/**
 * One control of the colourist's panel: a slider for the hand and a NUMBER for the eye — the number is typed exactly
 * (that is what «تلوين دقيق» means), the arrows step by the slider's own grain, and a double-click returns to zero.
 */
function Slide({ label, hint, min, max, step, value, onLive, onDone }: { label: string; hint: string; min: number; max: number; step: number; value: number; onLive: (v: number) => void; onDone: () => void }) {
  const set = (v: number) => onLive(Math.max(min, Math.min(max, Math.round(v / step) * step)));
  return (
    <label className="ph-slide" title={hint}>
      <span className="ph-slide-top">
        <b>{label}</b>
        <input
          className="ph-num"
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number.isInteger(value) ? value : Math.round(value * 10) / 10}
          aria-label={`${label} بالرقم`}
          onChange={(e) => e.target.value !== "" && set(Number(e.target.value))}
          onBlur={onDone}
        />
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        className={value ? "on" : ""}
        onChange={(e) => onLive(Number(e.target.value))}
        onPointerUp={onDone}
        onKeyUp={onDone}
        onDoubleClick={() => { onLive(0); onDone(); }}
      />
    </label>
  );
}
