"use client";

// «🖼️ أدوات الصورة»: three edits of ONE picture (a result of «أعمالي» or a picture loaded in the studio), each a job of
// its own generator so it goes through the same price, hold, refund and «أعمالي» as any generation:
//   • «امسح بالفرشاة» / «عدّل هالجزء»: paint over a part (brush, eraser, undo, zoom by buttons, the wheel or two fingers),
//     or «✨ تحديد ذكي» names it; then «امسحه» (removed and filled naturally) or «بدّله بـ…» (painted from words)
//   • «وسّع الصورة»: a new shape (9:16, 1:1, 4:5, 16:9, 3:4) or «كبّرها من كل الجهات», with what to add (optional)
//   • «ارفع الدقة»: ×2 / ×4
// The mask goes up as one of the person's pictures (white where to change, the picture's shape); the server stretches it
// to the picture's exact size and changes nothing outside it.

import Link from "next/link";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { coinStr } from "@config/coins";
import { coinsOf, defaultSettings, generatorById, priceKindOf, SMART_SELECT_KEY } from "@config/jawad/generators";
import { binaryMask, IMG_INPAINT_ID, IMG_OUTPAINT_ID, IMG_UPSCALE_ID, maskCanvasSize, maskShare, maskToRgba, OUTPAINT_SHAPE_LABEL, outpaintPlan, upscaledImage, type ImageToolId, type OutpaintShape } from "@config/jawad/image-tools";
import type { OptionState, RefMeta, Settings, SettingValue } from "@config/jawad/types";
import { evaluate } from "@/lib/jawad/engine";
import type { JobView } from "@/lib/jawad/labels";
import { track } from "@/lib/feature-track";
import { useAtCost } from "@/components/usePerks";
import Riyal from "@/components/Riyal";
import Dialog from "../Dialog";
import Icon from "../Icon";
import { announceBalance } from "../CoinBalance";
import { uploadReference } from "./upload";
import type { StudioGenerator, UploadView } from "./types";

/** The picture the tools work on: one of the person's uploads, or a result of «أعمالي» (copied to an upload first). */
export interface ImageSource {
  uploadId?: string;
  outputId?: string;
  url: string | null;
  width: number | null;
  height: number | null;
  /** the tool to open on (another of a job's tool, «استخدم الإعدادات») */
  tool?: ImageToolId;
}

const TOOL_TAB: Record<ImageToolId, { label: string; icon: "wand" | "expand" | "zoomIn" }> = {
  [IMG_INPAINT_ID]: { label: "امسح · عدّل جزء", icon: "wand" },
  [IMG_OUTPAINT_ID]: { label: "وسّع الصورة", icon: "expand" },
  [IMG_UPSCALE_ID]: { label: "ارفع الدقة", icon: "zoomIn" },
};
const TRACK = { [IMG_INPAINT_ID]: "studio.inpaint", [IMG_OUTPAINT_ID]: "studio.outpaint", [IMG_UPSCALE_ID]: "studio.upscale" } as const;
/** The paint shown on the picture (only its alpha is the mask). */
const PAINT = "#ff3b5c";
const MAX_UNDO = 20;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

async function postJson<T>(url: string, data: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), cache: "no-store" });
  return { ok: res.ok, status: res.status, body: (await res.json().catch(() => ({}))) as T & { error?: string; code?: string; coins?: number; prices?: Record<string, number | null> } };
}

const pictureMeta = (u: UploadView): RefMeta => ({ id: u.id, kind: "image", role: "reference", name: "picture", mime: u.mime, bytes: u.bytes, width: u.width, height: u.height, durationMs: null, fps: null, status: "ready" });

export default function ImageTools({
  open,
  onClose,
  source,
  initialTool,
  tools,
  prices,
  owner,
  balance,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  source: ImageSource | null;
  initialTool?: ImageToolId;
  /** the tool generators this person may use now (live, or hidden ones for the owner to try) */
  tools: StudioGenerator[];
  prices: Record<string, Record<string, number | null>>;
  owner: boolean;
  balance: number | null;
  onCreated: (job: JobView, balance: number | null) => void;
}) {
  const available = tools.filter((t) => t.id in TOOL_TAB).map((t) => t.id as ImageToolId);
  const [tool, setTool] = useState<ImageToolId>(initialTool && available.includes(initialTool) ? initialTool : available[0]);
  const [picture, setPicture] = useState<UploadView | null>(null);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [settings, setSettings] = useState<Record<string, Settings>>({});
  const [prompt, setPrompt] = useState("");
  const [confirm, setConfirm] = useState<{ coins: number; was: number } | null>(null);
  const atCost = useAtCost();
  const keyRef = useRef<{ sig: string; key: string } | null>(null);
  const maskRef = useRef<MaskPainterHandle | null>(null);
  const [maskInfo, setMaskInfo] = useState({ painted: 0, share: 0 });

  // the picture as one of the person's uploads (a result is copied once per opening)
  useEffect(() => {
    if (!open || !source) return;
    let live = true;
    const t = setTimeout(async () => {
      setError("");
      setPicture(null);
      if (source.tool && tools.some((g) => g.id === source.tool)) setTool(source.tool);
      if (source.uploadId) {
        const r = await fetch(`/api/jawad/uploads?ids=${source.uploadId}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
        const u = (r?.uploads as UploadView[] | undefined)?.[0];
        if (!live) return;
        if (!u || u.status !== "ready") return setError("ما لقينا الصورة؛ ارفعها من جديد.");
        return setPicture(u);
      }
      setLoading("يجهّز الصورة…");
      const r = await postJson<{ upload: UploadView }>("/api/jawad/uploads/from-output", { outputId: source.outputId }).catch(() => null);
      if (!live) return;
      setLoading("");
      if (!r?.ok || !r.body.upload) return setError(r?.body.error ?? "تعذّر تجهيز الصورة.");
      setPicture(r.body.upload);
    }, 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [open, source, tools]);

  const def = generatorById(tool);
  const tg = tools.find((t) => t.id === tool);
  const s: Settings = useMemo(() => (def ? { ...defaultSettings(def), ...(settings[tool] ?? {}) } : {}), [def, settings, tool]);
  const setOne = (k: string, v: SettingValue) => setSettings((cur) => ({ ...cur, [tool]: { ...(cur[tool] ?? {}), [k]: v } }));
  const work = picture?.width && picture.height ? maskCanvasSize(picture.width, picture.height) : null;
  const usesPrompt = tool === IMG_OUTPAINT_ID || (tool === IMG_INPAINT_ID && s.action === "replace");

  const refs: RefMeta[] = useMemo(() => {
    if (!picture) return [];
    const pic = pictureMeta(picture);
    if (tool !== IMG_INPAINT_ID || !work) return [pic];
    // the mask as it will go up (the page's own size); its file is made when sending
    return [pic, { id: "mask", kind: "image", role: "reference", name: "mask", mime: "image/png", bytes: 1000, width: work.width, height: work.height, durationMs: null, fps: null, status: "ready" }];
  }, [picture, tool, work]);
  const ev = def && picture ? evaluate(def, { settings: s, prompt: usesPrompt ? prompt : "", instructions: "", refStyle: "references", refs, atCost: !owner && atCost }, prices[tool] ?? {}) : null;
  const coins = ev?.price.ok ? ev.price.coins : null;

  const blockers: string[] = [];
  if (tg && !tg.live && !owner) blockers.push("هذي الأداة غير متاحة حاليًا.");
  if (ev) for (const i of ev.issues) if (!blockers.includes(i.message)) blockers.push(i.message);
  if (ev && !ev.price.ok) blockers.push(ev.price.reason);
  if (tool === IMG_INPAINT_ID && !maskInfo.painted) blockers.push("لوّن على الجزء اللي تبي تعدّله، أو استخدم «✨ تحديد ذكي».");
  const short = !owner && coins != null && balance != null && balance < coins;
  if (short) blockers.push(`رصيدك (${coinStr(balance)}) ما يكفي (${coinStr(coins)}).`);

  async function send(expectedCoins: number) {
    if (!def || !tg || !picture || busy) return;
    setBusy("يرسل…");
    setError("");
    setConfirm(null);
    try {
      const used = ev?.settings ?? s;
      const refList: { uploadId: string; role: "reference"; name: string }[] = [{ uploadId: picture.id, role: "reference", name: "picture" }];
      if (tool === IMG_INPAINT_ID) {
        setBusy("يجهّز التحديد…");
        const file = await maskRef.current?.export();
        if (!file) throw new Error("لوّن على الجزء اللي تبي تعدّله أولًا.");
        const mask = await uploadReference(file, "image");
        refList.push({ uploadId: mask.id, role: "reference", name: "mask" });
      }
      const sig = JSON.stringify([tool, used, usesPrompt ? prompt : "", refList.map((r) => r.uploadId)]);
      // a repeat of the same request keeps its key (the server then never makes a second job)
      if (keyRef.current?.sig !== sig) keyRef.current = { sig, key: uid() };
      setBusy("يرسل…");
      const r = await postJson<{ job: JobView; balance: number | null }>("/api/jawad/generate", {
        idempotencyKey: keyRef.current.key,
        sectionId: tg.sectionId,
        generatorId: def.id,
        refStyle: "references",
        settings: used,
        prompt: usesPrompt ? prompt : "",
        instructions: "",
        refs: refList,
        expectedCoins,
      });
      if (r.ok) {
        keyRef.current = null;
        track(TRACK[tool]);
        announceBalance(r.body.balance);
        onCreated(r.body.job, r.body.balance);
        return;
      }
      if (r.status === 409 && r.body.code === "price_changed" && typeof r.body.coins === "number") return setConfirm({ coins: r.body.coins, was: expectedCoins });
      keyRef.current = null;
      setError(r.body.error ?? "تعذّر البدء.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "انقطع الاتصال؛ جرّب مرة ثانية (ما يتكرر الخصم).");
    } finally {
      setBusy("");
    }
  }

  if (!available.length) return null;
  const title = def?.name ?? "أدوات الصورة";
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} title={`🖼️ ${title}`} wide>
      <div className="flex max-h-[calc(100dvh-5rem)] flex-col gap-3 overflow-y-auto p-3 sm:p-4" dir="rtl">
        {available.length > 1 && (
          <div className="jw-seg" role="tablist" aria-label="الأداة">
            {available.map((id) => (
              <button key={id} type="button" role="tab" aria-selected={tool === id} disabled={Boolean(busy)} onClick={() => (setTool(id), setError(""), setConfirm(null))}>
                <span className="inline-flex items-center gap-1"><Icon name={TOOL_TAB[id].icon} size={14} /> {TOOL_TAB[id].label}</span>
              </button>
            ))}
          </div>
        )}
        {tg && !tg.live && owner && <p className="rounded-lg border border-jw-line bg-jw-surface-2 px-3 py-2 text-xs text-jw-muted">مخفية عن الناس: أنت تجربها قبل ما تفعّلها من «المولّدات» في لوحة التحكم.</p>}

        {loading && <p className="text-sm text-jw-muted">{loading}</p>}
        {picture && work && def && (
          <>
            {tool === IMG_INPAINT_ID && (
              <MaskPainter
                ref={maskRef}
                url={picture.url ?? source?.url ?? ""}
                width={work.width}
                height={work.height}
                onChange={setMaskInfo}
                selectPrice={prices[IMG_INPAINT_ID]?.[SMART_SELECT_KEY]}
                kind={priceKindOf(def)}
                uploadId={picture.id}
                owner={owner}
              />
            )}
            {tool === IMG_OUTPAINT_ID && picture.width && picture.height && <OutpaintPreview url={picture.url ?? ""} width={picture.width} height={picture.height} shape={String(s.shape) as OutpaintShape} />}
            {tool === IMG_UPSCALE_ID && picture.width && picture.height && (
              <div className="flex items-center gap-3 rounded-lg border border-jw-line bg-jw-bg-2 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={picture.url ?? ""} alt="" className="size-20 shrink-0 rounded object-contain" />
                <p className="text-sm text-jw-muted" dir="rtl">
                  <span dir="ltr" className="tabular-nums">{picture.width}×{picture.height}</span> ←{" "}
                  <b dir="ltr" className="tabular-nums text-jw-ink">{(() => { const o = upscaledImage(picture.width, picture.height, Number(s.factor) || 2); return `${o.width}×${o.height}`; })()}</b>
                </p>
              </div>
            )}

            {ev && ev.options.filter((o) => !o.hidden).map((o) => <Choice key={o.key} o={o} value={s[o.key]} onChange={(v) => setOne(o.key, v)} />)}

            {usesPrompt && (
              <label className="block">
                <span className="jw-label">{def.modes[0].prompt?.label ?? def.prompt.label}</span>
                <textarea className="jw-input min-h-[4.5rem]" dir="auto" value={prompt} maxLength={def.prompt.max} placeholder={def.modes[0].prompt?.placeholder ?? def.prompt.placeholder} onChange={(e) => setPrompt(e.target.value)} />
              </label>
            )}
            {ev && ev.notes.length > 0 && (
              <ul className="space-y-1 text-[11px] text-jw-faint">
                {ev.notes.map((n) => <li key={n}>• {n}</li>)}
              </ul>
            )}
          </>
        )}

        {error && <p className="text-sm text-jw-danger" role="alert">{error}</p>}
        {confirm && (
          <div className="space-y-2 rounded-lg border border-jw-warn/40 bg-jw-surface-2 p-3 text-sm">
            <p>تغيّر السعر من <b><Riyal halalas={confirm.was} size={13} /></b> إلى <b><Riyal halalas={confirm.coins} size={13} /></b>. ما انخصم شي بعد.</p>
            <button type="button" className="jw-btn jw-btn-primary !min-h-9 text-sm" disabled={Boolean(busy)} onClick={() => void send(confirm.coins)}>أوافق وأكمل</button>
          </div>
        )}
        {blockers.length > 0 && picture && !busy && <p className="text-xs text-jw-warn">{blockers[0]}</p>}
        {short && <Link href="/jawad-ai/coins" className="text-xs text-jw-accent underline">اشحن رصيدك</Link>}

        <div className="sticky bottom-0 -mx-3 flex items-center gap-2 border-t border-jw-line bg-jw-surface px-3 pt-3 sm:-mx-4 sm:px-4">
          <button type="button" className="jw-btn jw-btn-primary !min-h-11 flex-1 gap-2" disabled={!picture || coins == null || blockers.length > 0 || Boolean(busy)} onClick={() => coins != null && void send(coins)}>
            <Icon name={def ? TOOL_TAB[tool].icon : "sparkles"} size={16} />
            {busy || (tool === IMG_INPAINT_ID ? (s.action === "replace" ? "بدّله" : "امسحه") : tool === IMG_OUTPAINT_ID ? "وسّعها" : "ارفع الدقة")}
            {coins != null && !busy && <Riyal halalas={coins} size={14} free={owner} />}
          </button>
          <button type="button" className="jw-btn jw-btn-quiet !min-h-11" disabled={Boolean(busy)} onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </Dialog>
  );
}

function Choice({ o, value, onChange }: { o: OptionState; value: SettingValue; onChange: (v: SettingValue) => void }) {
  if (o.kind !== "choice") return null;
  const id = `jw-tool-${o.key}`;
  return (
    <div>
      <span className="jw-label" id={id}>{o.label}</span>
      <div className="jw-seg flex-wrap" role="radiogroup" aria-labelledby={id}>
        {o.values.map((v) => {
          const why = o.disabledValues?.[v.value];
          return (
            <button key={v.value} type="button" role="radio" aria-checked={value === v.value} disabled={Boolean(why)} title={why ?? v.hint} onClick={() => onChange(v.value)}>
              <span dir={o.ltr ? "ltr" : undefined}>{v.label}</span>
              {v.hint && <span className="text-[10px] text-jw-faint">{v.hint}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** «وسّع الصورة»: the new shape drawn, the picture in its place, the part to be painted striped. */
function OutpaintPreview({ url, width, height, shape }: { url: string; width: number; height: number; shape: OutpaintShape }) {
  const plan = outpaintPlan(width, height, shape);
  if (!plan) {
    return <p className="rounded-lg border border-jw-line bg-jw-bg-2 p-3 text-sm text-jw-muted">الصورة أصلًا بشكل {OUTPAINT_SHAPE_LABEL[shape]}.</p>;
  }
  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
  return (
    <div className="mx-auto w-full max-w-sm">
      <div
        className="relative mx-auto max-h-[45dvh] overflow-hidden rounded-lg border border-dashed border-jw-accent/60"
        style={{ aspectRatio: `${plan.canvasW} / ${plan.canvasH}`, background: "repeating-linear-gradient(45deg, var(--jw-surface-2), var(--jw-surface-2) 8px, var(--jw-bg-2) 8px, var(--jw-bg-2) 16px)", width: plan.canvasW >= plan.canvasH ? "100%" : `min(100%, calc(45dvh * ${plan.canvasW / plan.canvasH}))` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="absolute object-fill" style={{ left: pct(plan.x, plan.canvasW), top: pct(plan.y, plan.canvasH), width: pct(plan.imgW, plan.canvasW), height: pct(plan.imgH, plan.canvasH) }} />
      </div>
      <p className="mt-1 text-center text-[11px] text-jw-faint">
        المخطّط يُرسم من جديد · <span dir="ltr" className="tabular-nums">{plan.canvasW}×{plan.canvasH}</span>
      </p>
    </div>
  );
}

// ───────────────────────────── the brush ─────────────────────────────

export interface MaskPainterHandle {
  /** The mask as a PNG file (white where painted, black elsewhere, the page's mask size), or null when nothing is painted. */
  export: () => Promise<File | null>;
}

type Mode = "brush" | "eraser" | "move";

function MaskPainter({
  ref,
  url,
  width,
  height,
  onChange,
  selectPrice,
  kind,
  uploadId,
  owner,
}: {
  ref: React.Ref<MaskPainterHandle>;
  url: string;
  width: number;
  height: number;
  onChange: (m: { painted: number; share: number }) => void;
  selectPrice: number | null | undefined;
  kind: ReturnType<typeof priceKindOf>;
  uploadId: string;
  owner: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("brush");
  const [size, setSize] = useState(36);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const undo = useRef<ImageData[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const stroke = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<{ d: number; zoom: number; mid: { x: number; y: number }; pan: { x: number; y: number } } | null>(null);
  const [words, setWords] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selectMsg, setSelectMsg] = useState("");
  const selectCoins = selectPrice == null ? null : coinsOf(selectPrice, kind);

  const ctx = () => canvas.current?.getContext("2d", { willReadFrequently: true }) ?? null;
  const measure = useCallback(() => {
    const c = ctx();
    if (!c) return;
    const { painted } = binaryMask(c.getImageData(0, 0, width, height).data, width, height);
    onChange({ painted, share: maskShare(painted, width, height) });
  }, [height, onChange, width]);

  const snapshot = () => {
    const c = ctx();
    if (!c) return;
    undo.current.push(c.getImageData(0, 0, width, height));
    if (undo.current.length > MAX_UNDO) undo.current.shift();
    setUndoCount(undo.current.length);
  };
  const back = () => {
    const c = ctx();
    const last = undo.current.pop();
    setUndoCount(undo.current.length);
    if (c && last) c.putImageData(last, 0, 0);
    measure();
  };
  const clear = () => {
    snapshot();
    ctx()?.clearRect(0, 0, width, height);
    measure();
  };

  // the handle the dialog asks for the mask when sending
  useImperativeHandle(ref, () => ({
    async export() {
      const c = ctx();
      if (!c) return null;
      const { data, painted } = binaryMask(c.getImageData(0, 0, width, height).data, width, height);
      if (!painted) return null;
      const out = document.createElement("canvas");
      out.width = width;
      out.height = height;
      out.getContext("2d")!.putImageData(new ImageData(maskToRgba(data) as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
      const blob = await new Promise<Blob | null>((ok) => out.toBlob(ok, "image/png"));
      return blob ? new File([blob], "mask.png", { type: "image/png" }) : null;
    },
  }));

  // a new picture: a clean mask
  useEffect(() => {
    undo.current = [];
    const t = setTimeout(() => {
      setUndoCount(0);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      measure();
    }, 0);
    return () => clearTimeout(t);
  }, [url, width, height, measure]);

  /** Keeps the zoomed picture covering the frame. */
  const clampPan = useCallback((p: { x: number; y: number }, z: number) => {
    const v = viewport.current;
    if (!v) return p;
    const w = v.clientWidth;
    const h = v.clientHeight;
    return { x: Math.min(0, Math.max(w - w * z, p.x)), y: Math.min(0, Math.max(h - h * z, p.y)) };
  }, []);
  const zoomAt = useCallback(
    (next: number, at?: { x: number; y: number }) => {
      const v = viewport.current;
      if (!v) return;
      const z = Math.min(6, Math.max(1, next));
      const c = at ?? { x: v.clientWidth / 2, y: v.clientHeight / 2 };
      setPan((p) => clampPan({ x: c.x - ((c.x - p.x) * z) / zoom, y: c.y - ((c.y - p.y) * z) / zoom }, z));
      setZoom(z);
    },
    [clampPan, zoom],
  );

  // the wheel zooms where the pointer is (a listener that may stop the page from scrolling)
  useEffect(() => {
    const v = viewport.current;
    if (!v) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = v.getBoundingClientRect();
      zoomAt(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    v.addEventListener("wheel", onWheel, { passive: false });
    return () => v.removeEventListener("wheel", onWheel);
  }, [zoom, zoomAt]);

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * width, y: ((e.clientY - r.top) / r.height) * height, k: width / r.width };
  };
  const paint = (from: { x: number; y: number }, to: { x: number; y: number }, k: number) => {
    const c = ctx();
    if (!c) return;
    c.globalCompositeOperation = mode === "eraser" ? "destination-out" : "source-over";
    c.strokeStyle = PAINT;
    c.fillStyle = PAINT;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.lineWidth = size * k;
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.lineTo(to.x, to.y);
    c.stroke();
    c.beginPath();
    c.arc(to.x, to.y, (size * k) / 2, 0, Math.PI * 2);
    c.fill();
  };
  const local = (e: React.PointerEvent) => {
    const r = viewport.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent) => {
    viewport.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 2) {
      // a second finger: no painting, a pinch (what the first finger just drew is taken back)
      if (stroke.current) {
        stroke.current = null;
        back();
      }
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, pan };
      return;
    }
    if (mode === "move") return;
    snapshot();
    const p = toCanvas(e);
    stroke.current = p;
    paint(p, p, p.k);
  };
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") setHover(local(e));
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    const now = local(e);
    pointers.current.set(e.pointerId, now);
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const p0 = pinch.current;
      const z = Math.min(6, Math.max(1, (p0.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / p0.d));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      setZoom(z);
      setPan(clampPan({ x: mid.x - ((p0.mid.x - p0.pan.x) * z) / p0.zoom, y: mid.y - ((p0.mid.y - p0.pan.y) * z) / p0.zoom }, z));
      return;
    }
    if (mode === "move") {
      setPan((p) => clampPan({ x: p.x + now.x - prev.x, y: p.y + now.y - prev.y }, zoom));
      return;
    }
    if (stroke.current) {
      const p = toCanvas(e);
      paint(stroke.current, p, p.k);
      stroke.current = p;
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (stroke.current && pointers.current.size === 0) {
      stroke.current = null;
      measure();
    }
  };

  /** «✨ تحديد ذكي»: what SAM found is added to what is painted. */
  async function select() {
    const w = words.trim();
    if (!w || selecting || selectCoins == null) return;
    setSelecting(true);
    setSelectMsg("");
    try {
      track("studio.smart_select");
      const r = await postJson<{ mask: string | null; concept: string | null; balance: number | null }>("/api/jawad/image-tools/select", { uploadId, words: w, expectedCoins: owner ? 0 : selectCoins });
      if (!r.ok) return setSelectMsg(r.status === 409 && typeof r.body.coins === "number" ? `تغيّر السعر إلى ${coinStr(r.body.coins)}؛ أعد المحاولة.` : r.body.error ?? "تعذّر التحديد.");
      if (r.body.balance != null) announceBalance(r.body.balance);
      if (!r.body.mask) return setSelectMsg("ما لقيته في الصورة؛ جرّب اسم ثاني أو لوّنه بالفرشاة. ما انخصم منك شي.");
      const img = new Image();
      img.src = r.body.mask;
      await img.decode();
      const tmp = document.createElement("canvas");
      tmp.width = width;
      tmp.height = height;
      const t = tmp.getContext("2d", { willReadFrequently: true })!;
      t.drawImage(img, 0, 0, width, height);
      const found = t.getImageData(0, 0, width, height);
      const c = ctx();
      if (!c) return;
      snapshot();
      const mine = c.getImageData(0, 0, width, height);
      const [pr, pg, pb] = [0xff, 0x3b, 0x5c];
      for (let i = 0; i < width * height; i++) {
        if (found.data[i * 4] >= 128) {
          mine.data[i * 4] = pr;
          mine.data[i * 4 + 1] = pg;
          mine.data[i * 4 + 2] = pb;
          mine.data[i * 4 + 3] = 255;
        }
      }
      c.putImageData(mine, 0, 0);
      measure();
      setSelectMsg("حددناه. صحّح بالفرشاة أو الممحاة إذا تبي.");
    } catch {
      setSelectMsg("انقطع الاتصال؛ جرّب مرة ثانية.");
    } finally {
      setSelecting(false);
    }
  }

  const tools: { id: Mode; label: string; icon: "wand" | "eraser" | "hand" }[] = [
    { id: "brush", label: "فرشاة", icon: "wand" },
    { id: "eraser", label: "ممحاة", icon: "eraser" },
    { id: "move", label: "تحريك", icon: "hand" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="jw-seg" role="radiogroup" aria-label="الأداة">
          {tools.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={mode === t.id} onClick={() => setMode(t.id)} className="!min-h-9">
              <span className="inline-flex items-center gap-1">{t.icon === "eraser" ? <span aria-hidden>🧽</span> : <Icon name={t.icon} size={14} />} {t.label}</span>
            </button>
          ))}
        </div>
        <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon !min-h-9" onClick={back} disabled={!undoCount} aria-label="تراجع" title="تراجع"><Icon name="undo" size={16} /></button>
        <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon !min-h-9" onClick={() => zoomAt(zoom * 1.4)} aria-label="تكبير" title="تكبير"><Icon name="zoomIn" size={16} /></button>
        <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon !min-h-9" onClick={() => zoomAt(zoom / 1.4)} disabled={zoom <= 1} aria-label="تصغير" title="تصغير"><Icon name="zoomOut" size={16} /></button>
        {zoom > 1 && <button type="button" className="jw-btn jw-btn-quiet !min-h-9 !px-2 text-xs" onClick={() => (setZoom(1), setPan({ x: 0, y: 0 }))}>كامل</button>}
        <button type="button" className="jw-btn jw-btn-quiet !min-h-9 !px-2 text-xs" onClick={clear}><Icon name="trash" size={14} /> امسح التلوين</button>
      </div>
      <label className="flex items-center gap-2 text-xs text-jw-muted">
        <span className="shrink-0">حجم الفرشاة</span>
        <input type="range" min={6} max={160} value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-1.5 flex-1 cursor-pointer accent-[var(--jw-accent)]" dir="ltr" aria-valuetext={`${size}`} />
        <span className="inline-block shrink-0 rounded-full border border-jw-line-strong" style={{ width: Math.min(28, size / 3 + 6), height: Math.min(28, size / 3 + 6), background: PAINT, opacity: 0.6 }} aria-hidden />
      </label>

      <div
        ref={viewport}
        className="relative mx-auto max-h-[55dvh] w-full overflow-hidden rounded-lg border border-jw-line bg-jw-bg-2 select-none"
        style={{ aspectRatio: `${width} / ${height}`, touchAction: "none", maxWidth: `calc(55dvh * ${width / height})`, cursor: mode === "move" ? "grab" : "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => setHover(null)}
      >
        <div className="absolute inset-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full object-fill" />
          <canvas ref={canvas} width={width} height={height} className="pointer-events-none absolute inset-0 size-full opacity-55" />
        </div>
        {hover && mode !== "move" && (
          <span className="pointer-events-none absolute rounded-full border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,.5)]" style={{ left: hover.x - size / 2, top: hover.y - size / 2, width: size, height: size }} aria-hidden />
        )}
      </div>
      <p className="text-center text-[11px] text-jw-faint">لوّن على الجزء · إصبعين للتكبير والتحريك · عجلة الفأرة للتكبير</p>

      {selectCoins != null && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-jw-line bg-jw-surface-2 p-2">
          <input className="jw-input !min-h-9 min-w-0 flex-1 text-sm" dir="auto" value={words} maxLength={200} placeholder="✨ تحديد ذكي: اكتب اسم الشي (مثل: الكوب، الشخص اللي يمين)" onChange={(e) => setWords(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void select())} />
          <button type="button" className="jw-btn !min-h-9 gap-1 text-xs" disabled={!words.trim() || selecting} onClick={() => void select()}>
            <Icon name="sparkles" size={14} /> {selecting ? "يحدد…" : "حدّد"} <Riyal halalas={selectCoins} size={12} free={owner} />
          </button>
          {selectMsg && <p className="w-full text-[11px] text-jw-muted">{selectMsg}</p>}
        </div>
      )}
    </div>
  );
}
