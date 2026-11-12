"use client";

// «🎨 ذوقي» and «طبّق هويتي» in «الاستوديو الإبداعي», beside «الستايل».
//   «ذوقي»: a taste made once from 3–20 of the person's pictures (uploads or results from «أعمالي»): Claude writes the
//   look in words for a fixed price shown first (given back on failure), and up to 4 pictures are kept. Applied, its
//   words go into the prompt like a library style and its pictures go in as STYLE references where the generator takes
//   them (config/jawad/taste.ts).
//   «هويتي»: the person's colours, logo, fonts and brand voice; the toggle adds them (and, when asked, the logo).
// Before the database file 0116 runs, both show one quiet line and nothing else.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { coinStr } from "@config/coins";
import {
  BRAND_COLORS_MAX,
  BRAND_FONT_CHOICES,
  BRAND_FONTS_MAX,
  BRAND_VOICE_MAX,
  cleanTasteName,
  lookRefNames,
  pickLookRefs,
  picturesProblem,
  styleRefRoom,
  TASTE_ANALYSE_COINS,
  TASTE_LIMIT,
  TASTE_NAME_MAX,
  TASTE_PICTURES,
  takesStyleRefs,
  tasteNameProblem,
} from "@config/jawad/taste";
import type { GeneratorDef, OutputKind, RefMeta, RefStyle, Settings } from "@config/jawad/types";
import { fileProblem } from "@/lib/jawad/engine";
import type { BrandView, LookPicture, LookState, TasteView } from "@/lib/jawad/server/taste";
import { track } from "@/lib/feature-track";
import Coined from "@/components/Coined";
import { announceBalance } from "../CoinBalance";
import Dialog from "../Dialog";
import Icon from "../Icon";
import RefAdder, { type WorkSource } from "./RefAdder";
import type { RefItem, UploadView } from "./types";
import { probeFile, putWithProgress } from "./upload";

export interface BrandUse {
  on: boolean;
  /** put the logo in (pictures that take references) */
  logo: boolean;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
async function api<T>(url: string, body?: unknown): Promise<{ ok: boolean; status: number; body: T & { error?: string; code?: string; coins?: number } }> {
  const res = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, body: (await res.json().catch(() => ({}))) as T & { error?: string; code?: string; coins?: number } };
}

/** One picture of the person's, uploaded and checked by the server like any reference; its view. */
async function uploadImage(file: File, onProgress?: (p: number) => void): Promise<UploadView> {
  const probe = await probeFile(file, "image");
  const s = await api<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: "image", mime: probe.mime, bytes: file.size, fileName: file.name });
  if (!s.ok) throw new Error(s.body.error || "تعذّر بدء الرفع.");
  await putWithProgress(s.body.signedUrl, file, probe.mime, onProgress ?? (() => {}));
  const c = await api<{ upload?: UploadView }>("/api/jawad/uploads/confirm", { id: s.body.id });
  if (!c.ok || !c.body.upload) throw new Error(c.body.error || "تعذّر فحص الصورة.");
  if (c.body.upload.status !== "ready") throw new Error(c.body.upload.error || "الصورة مرفوضة.");
  return c.body.upload;
}

/** An SVG logo drawn into a PNG (generators and uploads take PNG/JPG/WEBP), 1024 px on its long side. */
async function svgToPng(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w0 = img.naturalWidth || 1024;
    const h0 = img.naturalHeight || 1024;
    const k = 1024 / Math.max(w0, h0);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(64, Math.round(w0 * k));
    canvas.height = Math.max(64, Math.round(h0 * k));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
    if (!blob) throw new Error("تعذّر تحويل الشعار.");
    return new File([blob], file.name.replace(/\.svg$/i, "") + ".png", { type: "image/png" });
  } catch {
    throw new Error("تعذّر قراءة ملف SVG؛ جرّب PNG.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The person's tastes and brand kit (null while loading or signed out). */
export function useLook(enabled: boolean) {
  const [look, setLook] = useState<LookState | null>(null);
  const reload = useCallback(async () => {
    const r = await api<LookState>("/api/jawad/taste").catch(() => null);
    if (r?.ok) setLook(r.body);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => void reload(), 0);
    return () => clearTimeout(t);
  }, [enabled, reload]);
  return { look: enabled ? look : null, setLook, reload };
}

const metaOf = (p: LookPicture): RefMeta => ({ id: p.id, kind: "image", role: "reference", mime: p.mime, bytes: p.bytes, width: p.width, height: p.height, status: "ready" });

/**
 * The extra references a generation gets from the taste and the logo — the same choice the server makes (so the quote
 * matches the charge): the logo first, then the taste's pictures, as far as this generator takes them and has room.
 */
export function lookRefItems(def: GeneratorDef, refStyle: RefStyle, settings: Settings, refs: RefItem[], look: LookState | null, tasteId: string | undefined, brand: BrandUse | undefined): RefItem[] {
  if (!look?.migrated || def.output === "audio") return [];
  const taste = tasteId ? look.tastes.find((t) => t.id === tasteId) : undefined;
  const logo = brand?.on && brand.logo ? look.brand.logo : null;
  if (!taste?.pictures.length && !logo) return [];
  const room = styleRefRoom(def, refStyle, settings, refs.filter((r) => r.kind === "image").length);
  const byId = new Map([...(taste?.pictures ?? []), ...(logo ? [logo] : [])].map((p) => [p.id, p]));
  const picked = pickLookRefs({ room, logo: logo ? metaOf(logo) : null, taste: (taste?.pictures ?? []).map(metaOf), fits: (r) => !fileProblem(def, r) });
  const names = lookRefNames(refs.map((r) => r.name), picked.taste.length, Boolean(picked.logo));
  const item = (m: RefMeta, name: string): RefItem => {
    const p = byId.get(m.id)!;
    return { localId: `look:${m.id}`, uploadId: m.id, kind: "image", name, role: "reference", fileName: name, status: "ready", progress: 1, error: null, url: p.url, mime: p.mime, bytes: p.bytes, width: p.width, height: p.height, durationMs: null, fps: null };
  };
  return [...(picked.logo ? [item(picked.logo, names.logo!)] : []), ...picked.taste.map((m, i) => item(m, names.taste[i]))];
}

/** Every upload of the person's tastes and logo (a reused job's references among them are left out of the draft). */
export const lookUploadIds = (look: LookState | null) => new Set([...(look?.tastes.flatMap((t) => t.pictures.map((p) => p.id)) ?? []), ...(look?.brand.logo ? [look.brand.logo.id] : [])]);

interface Props {
  look: LookState | null;
  onLook: (next: LookState) => void;
  owner: boolean;
  def: GeneratorDef;
  refStyle: RefStyle;
  settings: Settings;
  /** the extra references going with this generation now */
  extra: RefItem[];
  tasteId: string;
  onTaste: (id: string) => void;
  brand: BrandUse;
  onBrand: (b: BrandUse) => void;
}

export default function TasteBrand({ look, onLook, owner, def, refStyle, settings, extra, tasteId, onTaste, brand, onBrand }: Props) {
  const [picking, setPicking] = useState(false);
  const [editingBrand, setEditingBrand] = useState(false);
  const output: OutputKind = def.output;
  // a taste or a kit that is gone (deleted elsewhere) stops being applied
  const taste = look?.tastes.find((t) => t.id === tasteId);
  useEffect(() => {
    if (look?.migrated && tasteId && !taste) onTaste("");
  }, [look, tasteId, taste, onTaste]);

  if (!look || output === "audio") return null;
  if (!look.migrated) return <p className="text-[11px] text-jw-faint">🎨 «ذوقي» و«هويتي» قيد التجهيز وتفتح قريبًا.</p>;

  const styleRefsHere = takesStyleRefs(def, refStyle, settings);
  const tasteGoing = extra.filter((r) => r.localId.startsWith("look:") && r.name.startsWith("taste_")).length;
  const kit = look.brand;
  const hasKit = Boolean(kit.colors.length || kit.fonts.length || kit.voice || kit.logo);
  const logoPossible = output === "image" && styleRefsHere && Boolean(kit.logo);

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">🎨 ذوقي <span className="text-xs font-normal text-jw-muted">(اختياري)</span></p>
        <button type="button" className="flex w-full items-center gap-3 rounded-xl border border-jw-line bg-jw-surface-2 p-2 text-start hover:border-jw-accent" onClick={() => setPicking(true)} aria-haspopup="dialog">
          {taste ? (
            <>
              <Thumbs pictures={taste.pictures} size="sm" />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-sm">{taste.name}</b>
                <span className="line-clamp-1 text-xs text-jw-muted">{taste.summary || "ذوقك من صورك"}</span>
              </span>
            </>
          ) : (
            <span className="flex-1 px-1 py-3 text-sm text-jw-muted">بدون ذوق — اصنع ذوقك من صورك أو اختر واحدًا</span>
          )}
          <span className="text-xs text-jw-accent">{taste ? "غيّر" : "اختر"}</span>
        </button>
        {taste && (
          <p className="text-[11px] text-jw-faint">
            {tasteGoing
              ? `وصف ذوقك ينضاف للبرومبت، و${tasteGoing} من صوره تنرسل مراجع للستايل فقط (ما ينقل منها أشخاص ولا أشياء).`
              : styleRefsHere
                ? "وصف ذوقك ينضاف للبرومبت؛ ما بقى مكان لصوره بين مراجعك."
                : "وصف ذوقك ينضاف للبرومبت؛ هذا المولد ما يأخذ صور الذوق كمراجع للستايل."}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-jw-line bg-jw-surface-2 px-3 py-2">
        <label className={`flex flex-1 items-center gap-2 text-sm ${hasKit ? "" : "opacity-60"}`}>
          <input
            type="checkbox"
            className="size-4 accent-[var(--jw-accent)]"
            checked={brand.on && hasKit}
            disabled={!hasKit}
            onChange={(e) => {
              onBrand({ ...brand, on: e.target.checked });
              if (e.target.checked) track("studio.brand_use");
            }}
          />
          <span className="font-semibold">طبّق هويتي</span>
          {hasKit ? <Swatches colors={kit.colors} /> : <span className="text-xs text-jw-muted">احفظ ألوانك وشعارك أولًا</span>}
        </label>
        <button type="button" className="jw-btn !min-h-8 text-xs" onClick={() => setEditingBrand(true)}>
          <Icon name="palette" size={14} /> {hasKit ? "عدّل هويتي" : "اصنع هويتي"}
        </button>
        {brand.on && logoPossible && (
          <label className="flex w-full items-center gap-2 text-xs text-jw-muted">
            <input type="checkbox" className="size-4 accent-[var(--jw-accent)]" checked={brand.logo} onChange={(e) => onBrand({ ...brand, logo: e.target.checked })} />
            حط الشعار في الصورة (للبوسترات والثامبنيل)
          </label>
        )}
      </div>

      {picking && (
        <TastesDialog
          tastes={look.tastes}
          owner={owner}
          current={tasteId}
          onClose={() => setPicking(false)}
          onPick={(id) => {
            onTaste(id);
            setPicking(false);
            if (id) track("studio.taste_use");
          }}
          onTastes={(tastes) => onLook({ ...look, tastes })}
        />
      )}
      {editingBrand && (
        <BrandDialog
          kit={kit}
          onClose={() => setEditingBrand(false)}
          onSaved={(b) => {
            onLook({ ...look, brand: b });
            setEditingBrand(false);
            track("studio.brand_save");
            if (!brand.on && (b.colors.length || b.fonts.length || b.voice || b.logo)) onBrand({ ...brand, on: true });
          }}
        />
      )}
    </div>
  );
}

function Thumbs({ pictures, size }: { pictures: LookPicture[]; size: "sm" | "lg" }) {
  const box = size === "sm" ? "size-10" : "aspect-square w-full";
  return (
    <span className={`grid shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-lg bg-jw-bg-2 ${size === "sm" ? "w-[5.25rem]" : "w-full"}`}>
      {Array.from({ length: 4 }, (_, i) => {
        const p = pictures[i];
        // eslint-disable-next-line @next/next/no-img-element
        return p?.url ? <img key={i} src={p.url} alt="" className={`${box} object-cover`} /> : <span key={i} className={`${box} bg-jw-surface-3`} />;
      })}
    </span>
  );
}

const Swatches = ({ colors }: { colors: string[] }) => (
  <span className="flex items-center gap-0.5" dir="ltr">
    {colors.map((c) => (
      <span key={c} className="size-3.5 rounded-full border border-jw-line" style={{ background: c }} title={c} />
    ))}
  </span>
);

// ───────────────────────────── «ذوقي»: choose, rename, delete, make ─────────────────────────────

function TastesDialog({ tastes, owner, current, onClose, onPick, onTastes }: { tastes: TasteView[]; owner: boolean; current: string; onClose: () => void; onPick: (id: string) => void; onTastes: (t: TasteView[]) => void }) {
  const [making, setMaking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function rename(t: TasteView) {
    const raw = prompt("الاسم الجديد للذوق:", t.name);
    if (raw == null) return;
    const name = cleanTasteName(raw);
    const why = tasteNameProblem(name, tastes, t.id);
    if (why) return setError(why);
    setBusy(t.id);
    const r = await api("/api/jawad/taste", { action: "rename", id: t.id, name });
    setBusy(null);
    if (!r.ok) return setError(r.body.error || "تعذّر تغيير الاسم.");
    track("studio.taste_manage");
    onTastes(tastes.map((x) => (x.id === t.id ? { ...x, name: name! } : x)));
  }
  async function remove(t: TasteView) {
    if (!confirm(`حذف ذوق «${t.name}» وصوره؟ الأعمال اللي انصنعت فيه تبقى.`)) return;
    setBusy(t.id);
    const r = await api("/api/jawad/taste", { action: "delete", id: t.id });
    setBusy(null);
    if (!r.ok) return setError(r.body.error || "تعذّر الحذف.");
    track("studio.taste_manage");
    onTastes(tastes.filter((x) => x.id !== t.id));
    if (current === t.id) onPick("");
  }

  return (
    <Dialog open onClose={onClose} title={making ? "ذوق جديد من صورك" : "🎨 ذوقي"} wide>
      {making ? (
        <MakeTaste
          tastes={tastes}
          owner={owner}
          onBack={() => setMaking(false)}
          onMade={(t) => {
            onTastes([t, ...tastes]);
            setMaking(false);
            onPick(t.id);
          }}
        />
      ) : (
        <div className="space-y-4 p-4">
          <p className="text-xs text-jw-muted">
            الذوق مثل لوحة الإلهام: تختار من ٣ إلى ٢٠ صورة تحبها، ونقرأها مرة وحدة ونكتب شكلها (الألوان، الإضاءة، الملمس، التكوين، الإحساس) بدون ما ننقل أشخاصها. بعدها تطبّقه على أي توليد صورة أو فيديو.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="jw-btn jw-btn-primary" disabled={tastes.length >= TASTE_LIMIT} onClick={() => setMaking(true)}>
              <Icon name="plus" size={15} /> ذوق جديد
            </button>
            {current && (
              <button type="button" className="jw-btn" onClick={() => onPick("")}>
                بدون ذوق
              </button>
            )}
          </div>
          {tastes.length >= TASTE_LIMIT && <p className="text-xs text-jw-muted">وصلت حد الأذواق ({TASTE_LIMIT}). احذف واحدًا لتصنع غيره.</p>}
          {error && <p className="text-xs text-jw-danger" role="alert">{error}</p>}
          {tastes.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {tastes.map((t) => (
                <li key={t.id} className={`jw-panel overflow-hidden ${t.id === current ? "border-jw-accent" : ""}`}>
                  <button type="button" className="block w-full text-start" onClick={() => onPick(t.id)} aria-pressed={t.id === current}>
                    <Thumbs pictures={t.pictures} size="lg" />
                    <span className="block space-y-1 p-2">
                      <b className="block truncate text-sm">{t.id === current ? "✓ " : ""}{t.name}</b>
                      {t.palette.length > 0 && <Swatches colors={t.palette.slice(0, 6)} />}
                      {t.summary && <span className="line-clamp-2 block text-[11px] text-jw-muted">{t.summary}</span>}
                    </span>
                  </button>
                  <div className="flex items-center justify-end gap-1 border-t border-jw-line px-1 py-1">
                    <button type="button" className="jw-btn jw-btn-quiet !min-h-8 text-xs" disabled={busy === t.id} onClick={() => void rename(t)}>
                      سمّه
                    </button>
                    <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" disabled={busy === t.id} onClick={() => void remove(t)} aria-label={`احذف ${t.name}`}>
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-jw-muted">ما عندك أذواق بعد. اضغط «ذوق جديد».</p>
          )}
        </div>
      )}
    </Dialog>
  );
}

interface Pic {
  key: string;
  url: string | null;
  uploadId: string | null;
  status: "uploading" | "ready" | "error";
  error?: string;
}

function MakeTaste({ tastes, owner, onBack, onMade }: { tastes: TasteView[]; owner: boolean; onBack: () => void; onMade: (t: TasteView) => void }) {
  const inputId = useId();
  const [name, setName] = useState("");
  const [pics, setPics] = useState<Pic[]>([]);
  const [fromWorks, setFromWorks] = useState(false);
  const [quote, setQuote] = useState(TASTE_ANALYSE_COINS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(uid());

  const ready = pics.filter((p) => p.status === "ready" && p.uploadId);
  const ids = ready.map((p) => p.uploadId!);
  const uploading = pics.some((p) => p.status === "uploading");
  const room = TASTE_PICTURES.max - pics.length;
  const why = tasteNameProblem(cleanTasteName(name), tastes) ?? (uploading ? "انتظر حتى يكتمل رفع الصور." : picturesProblem(ids));

  const patch = (k: string, p: Partial<Pic>) => setPics((cur) => cur.map((x) => (x.key === k ? { ...x, ...p } : x)));
  function addFiles(files: File[]) {
    const take = files.slice(0, Math.max(0, room));
    if (files.length > take.length) setError(`الحد ${TASTE_PICTURES.max} صورة.`);
    const added = take.map((file) => ({ file, pic: { key: uid(), url: URL.createObjectURL(file), uploadId: null, status: "uploading" as const } }));
    setPics((cur) => [...cur, ...added.map((a) => a.pic)]);
    for (const { file, pic } of added) {
      uploadImage(file)
        .then((v) => patch(pic.key, { uploadId: v.id, status: "ready" }))
        .catch((e: Error) => patch(pic.key, { status: "error", error: e.message }));
    }
  }
  async function addWork(source: WorkSource): Promise<string | null> {
    if (room <= 0) return `الحد ${TASTE_PICTURES.max} صورة.`;
    const r = await api<{ upload?: UploadView }>("/api/jawad/uploads/from-output", source);
    if (!r.ok || !r.body.upload) return r.body.error || "تعذّر إضافتها.";
    const v = r.body.upload;
    if (v.kind !== "image" || v.status !== "ready") return "اختر صورة.";
    setPics((cur) => (cur.some((p) => p.uploadId === v.id) ? cur : [...cur, { key: uid(), url: v.url, uploadId: v.id, status: "ready" }]));
    return null;
  }
  function removePic(p: Pic) {
    if (p.url?.startsWith("blob:")) URL.revokeObjectURL(p.url);
    setPics((cur) => cur.filter((x) => x.key !== p.key));
    // the uploaded copy goes too (it was made only for this taste)
    if (p.uploadId) void fetch(`/api/jawad/uploads/${p.uploadId}`, { method: "DELETE" }).catch(() => {});
  }

  async function make() {
    if (why || busy) return;
    setBusy(true);
    setError("");
    const r = await api<{ taste?: TasteView; balance?: number | null }>("/api/jawad/taste", { action: "make", key: key.current, name, uploadIds: ids, expectedCoins: quote });
    setBusy(false);
    if (r.status === 409 && r.body.code === "price_changed" && typeof r.body.coins === "number") {
      setQuote(r.body.coins);
      return setError(`تغيّر سعر التحليل إلى ${coinStr(r.body.coins)}. اضغط مرة ثانية إذا تبيه.`);
    }
    if (!r.ok || !r.body.taste) {
      key.current = uid();
      return setError(r.body.error || "تعذّر تحليل الصور.");
    }
    announceBalance(r.body.balance ?? null);
    track("studio.taste_make");
    onMade(r.body.taste);
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <label className="jw-label" htmlFor={`${inputId}-name`}>اسم الذوق</label>
        <input id={`${inputId}-name`} className="jw-input" value={name} maxLength={TASTE_NAME_MAX} placeholder="مثال: دافي وسينمائي" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">
          الصور <span className="text-xs font-normal text-jw-muted">({pics.length} من {TASTE_PICTURES.max} · أقل شي {TASTE_PICTURES.min})</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <label className={`jw-btn cursor-pointer ${room <= 0 ? "pointer-events-none opacity-40" : ""}`} htmlFor={`${inputId}-files`}>
            <Icon name="upload" size={15} /> من جهازك
          </label>
          <input
            id={`${inputId}-files`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => {
              addFiles([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          <button type="button" className="jw-btn" disabled={room <= 0} onClick={() => setFromWorks(true)}>
            <Icon name="grid" size={15} /> من أعمالي
          </button>
        </div>
        {pics.length > 0 && (
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {pics.map((p) => (
              <li key={p.key} className="relative overflow-hidden rounded-lg border border-jw-line bg-jw-bg-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.url ? <img src={p.url} alt="" className={`aspect-square w-full object-cover ${p.status === "uploading" ? "opacity-50" : ""}`} /> : <span className="block aspect-square" />}
                {p.status === "uploading" && <span className="absolute inset-0 grid place-items-center"><span className="jw-spinner" /></span>}
                {p.status === "error" && <span className="absolute inset-x-0 bottom-0 bg-black/70 p-1 text-[10px] text-white">{p.error}</span>}
                <button type="button" className="absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white" onClick={() => removePic(p)} aria-label="احذف الصورة">
                  <Icon name="x" size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-jw-faint">نقرأ الصور مرة وحدة ونكتب شكلها فقط، ونحتفظ بأوضح ٤ منها مراجع للستايل؛ الباقي يُحذف بعد التحليل.</p>
      </div>
      {error && <p className="text-xs text-jw-danger" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="jw-btn jw-btn-primary" disabled={Boolean(why) || busy} onClick={() => void make()} title={why ?? undefined}>
          {busy ? <span className="jw-spinner" /> : <Icon name="sparkles" size={15} />}
          {busy ? "يقرأ صورك…" : <Coined text={`حلّل واحفظ · ${owner ? "مجانًا لك" : coinStr(quote)}`} />}
        </button>
        <button type="button" className="jw-btn jw-btn-quiet" disabled={busy} onClick={onBack}>
          رجوع
        </button>
        {why && !busy && <span className="text-xs text-jw-muted">{why}</span>}
      </div>
      <p className="text-[11px] text-jw-faint">
        <Coined text={`السعر ${coinStr(TASTE_ANALYSE_COINS)} للتحليل مرة وحدة؛ إذا ما نجح يرجع لك كامل.`} />
      </p>
      <RefAdder
        open={fromWorks}
        onClose={() => setFromWorks(false)}
        title="صورة من أعمالك"
        kinds={["image"]}
        only="image"
        refKinds={{ image: { allowed: true }, video: { allowed: false, reason: "صور فقط." }, audio: { allowed: false, reason: "صور فقط." } }}
        owner={owner}
        multiple
        onFiles={addFiles}
        onPickWork={addWork}
      />
    </div>
  );
}

// ───────────────────────────── «هويتي» ─────────────────────────────

function BrandDialog({ kit, onClose, onSaved }: { kit: BrandView; onClose: () => void; onSaved: (b: BrandView) => void }) {
  const inputId = useId();
  const [colors, setColors] = useState<string[]>(kit.colors);
  const [fonts, setFonts] = useState<string[]>(kit.fonts);
  const [voice, setVoice] = useState(kit.voice);
  const [logo, setLogo] = useState<{ id: string | null; url: string | null }>({ id: kit.logo?.id ?? null, url: kit.logo?.url ?? null });
  const [logoBusy, setLogoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    setLogoBusy(true);
    setError("");
    try {
      const png = file.type === "image/svg+xml" || /\.svg$/i.test(file.name) ? await svgToPng(file) : file;
      if (png.type !== "image/png") throw new Error("الشعار: PNG أو SVG.");
      const v = await uploadImage(png);
      setLogo({ id: v.id, url: v.url ?? URL.createObjectURL(png) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLogoBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError("");
    const r = await api<{ brand?: BrandView }>("/api/jawad/taste", { action: "brand", colors, fonts, voice, logoUploadId: logo.id });
    setBusy(false);
    if (!r.ok || !r.body.brand) return setError(r.body.error || "تعذّر الحفظ.");
    onSaved(r.body.brand);
  }

  const groups = [...new Set(BRAND_FONT_CHOICES.map((f) => f.group))];
  return (
    <Dialog open onClose={onClose} title="هويتي">
      <div className="space-y-4 p-4">
        <p className="text-xs text-jw-muted">ألوانك وشعارك وخطوطك ونبرتك. «طبّق هويتي» في الاستوديو يضيفها للبرومبت.</p>
        <div className="space-y-2">
          <p className="jw-label">الألوان (حتى {BRAND_COLORS_MAX})</p>
          <div className="flex flex-wrap items-center gap-2">
            {colors.map((c, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full border border-jw-line bg-jw-bg-2 py-0.5 ps-0.5 pe-2">
                <input type="color" value={c} className="size-7 cursor-pointer rounded-full border-0 bg-transparent" aria-label={`اللون ${i + 1}`} onChange={(e) => setColors((cur) => cur.map((x, j) => (j === i ? e.target.value.toLowerCase() : x)))} />
                <span className="text-xs" dir="ltr">{c}</span>
                <button type="button" onClick={() => setColors((cur) => cur.filter((_, j) => j !== i))} aria-label={`احذف ${c}`}>
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
            {colors.length < BRAND_COLORS_MAX && (
              <button type="button" className="jw-btn !min-h-8 text-xs" onClick={() => setColors((cur) => [...cur, "#3b8cff"])}>
                <Icon name="plus" size={14} /> لون
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="jw-label">الشعار (PNG أو SVG)</p>
          <div className="flex flex-wrap items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo.url && <img src={logo.url} alt="الشعار" className="size-14 rounded-lg border border-jw-line bg-[repeating-conic-gradient(#8883_0_25%,transparent_0_50%)] bg-[length:12px_12px] object-contain" />}
            <label className={`jw-btn cursor-pointer ${logoBusy ? "pointer-events-none opacity-50" : ""}`} htmlFor={`${inputId}-logo`}>
              {logoBusy ? <span className="jw-spinner" /> : <Icon name="upload" size={15} />} {logo.id ? "بدّل الشعار" : "ارفع الشعار"}
            </label>
            <input id={`${inputId}-logo`} type="file" accept="image/png,image/svg+xml,.svg" className="sr-only" onChange={(e) => (void pickLogo(e.target.files?.[0]), (e.target.value = ""))} />
            {logo.id && (
              <button type="button" className="jw-btn jw-btn-quiet !min-h-8 text-xs" onClick={() => setLogo({ id: null, url: null })}>
                شيل الشعار
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="jw-label">الخطوط (حتى {BRAND_FONTS_MAX}: عنوان ونص)</p>
          {Array.from({ length: BRAND_FONTS_MAX }, (_, i) => (
            <select
              key={i}
              className="jw-select"
              aria-label={i === 0 ? "خط العناوين" : "خط النص"}
              value={fonts[i] ?? ""}
              disabled={i > 0 && !fonts[0]}
              onChange={(e) => setFonts((cur) => [...cur.slice(0, i), e.target.value, ...cur.slice(i + 1)].filter(Boolean).slice(0, BRAND_FONTS_MAX))}
            >
              <option value="">{i === 0 ? "خط العناوين — بدون" : "خط النص — بدون"}</option>
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {BRAND_FONT_CHOICES.filter((f) => f.group === g).map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          ))}
        </div>

        <div>
          <label className="jw-label" htmlFor={`${inputId}-voice`}>نبرة هويتك (سطر قصير)</label>
          <input id={`${inputId}-voice`} className="jw-input" value={voice} maxLength={BRAND_VOICE_MAX} placeholder="مثال: ودود وواثق، بسيط بلا مبالغة" onChange={(e) => setVoice(e.target.value)} />
        </div>

        {error && <p className="text-xs text-jw-danger" role="alert">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className="jw-btn jw-btn-primary" disabled={busy || logoBusy} onClick={() => void save()}>
            {busy ? <span className="jw-spinner" /> : <Icon name="check" size={15} />} احفظ هويتي
          </button>
          <button type="button" className="jw-btn jw-btn-quiet" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </Dialog>
  );
}
