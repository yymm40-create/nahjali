"use client";

// «معرض الناس»: approved works of people (the featured first, then the newest), filtered صور / فيديو, each with its
// prompt shown and «جرّبه». On the public page «جرّبه» opens the studio filled (after signing in when signed out); in
// the studio's own window it fills the form in place (`onTry`). Shared by /jawad-ai/gallery and the studio.

import Link from "next/link";
import { useState } from "react";
import { shapeOf, tryHref, tryLoginHref, type GalleryCard, type GalleryKind } from "@config/jawad/gallery";
import { findStyle } from "@config/film-styles";
import { track } from "@/lib/feature-track";
import Icon from "../Icon";

type Filter = "all" | GalleryKind;
const FILTERS: { id: Filter; label: string; icon: string }[] = [
  { id: "all", label: "الكل", icon: "grid" },
  { id: "image", label: "صور", icon: "image" },
  { id: "video", label: "فيديو", icon: "video" },
];

/** The picture or video at its own shape (kept between portrait and wide so the columns stay tidy). */
export function GalleryMedia({ item, controls = true }: { item: Pick<GalleryCard, "kind" | "mediaUrl" | "width" | "height" | "settings" | "title">; controls?: boolean }) {
  const shape = shapeOf(item.settings);
  const [w, h] = item.width && item.height ? [item.width, item.height] : shape ? shape.split(":").map(Number) : [1, 1];
  const ratio = Math.min(16 / 9, Math.max(9 / 16, w / h || 1));
  return (
    <div className="relative overflow-hidden bg-jw-bg-2" style={{ aspectRatio: ratio }}>
      {item.kind === "video" ? (
        // never starts by itself; "#t=0.1" shows the first frame instead of a black box
        <video src={`${item.mediaUrl}#t=0.1`} controls={controls} muted={!controls} preload="metadata" playsInline className="size-full bg-black object-cover" aria-label={item.title || "فيديو"} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.mediaUrl} alt={item.title || "صورة من معرض الناس"} loading="lazy" className="size-full object-cover" />
      )}
    </div>
  );
}

function Card({ item, signedIn, onTry }: { item: GalleryCard; signedIn: boolean; onTry?: (item: GalleryCard) => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const style = item.styleId ? findStyle(item.styleId) : undefined;
  const shape = shapeOf(item.settings);
  const canTry = item.prompt.trim().length > 0;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("انسخ البرومبت:", item.prompt);
    }
  };
  return (
    <article className="jw-panel mb-3 break-inside-avoid overflow-hidden">
      <div className="relative">
        <GalleryMedia item={item} />
        {item.featured && <span className="absolute start-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-jw-gold">★ مختار</span>}
      </div>
      <div className="space-y-2 p-3">
        {item.title && <h3 className="text-sm font-semibold leading-snug" dir="auto">{item.title}</h3>}
        <div className="flex flex-wrap gap-1">
          <span className="jw-chip" dir="ltr">{item.generatorName}</span>
          {shape && <span className="jw-chip" dir="ltr">{shape}</span>}
          {style && <span className="jw-chip">{style.name}</span>}
        </div>
        {canTry ? (
          <>
            <p className={`whitespace-pre-wrap text-xs text-jw-muted ${open ? "" : "line-clamp-3"}`} dir="auto">{item.prompt}</p>
            <div className="flex flex-wrap items-center gap-1">
              {item.prompt.length > 140 && (
                <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
                  {open ? "أقل" : "البرومبت كامل"}
                </button>
              )}
              <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs" onClick={copy}>
                <Icon name={copied ? "check" : "copy"} size={14} /> {copied ? "انتسخ" : "انسخ"}
              </button>
              {onTry ? (
                <button type="button" className="jw-btn jw-btn-primary ms-auto !min-h-8 !px-3 text-xs" onClick={() => onTry(item)}>
                  <Icon name="sparkles" size={14} /> جرّبه
                </button>
              ) : (
                <Link href={signedIn ? tryHref(item.id) : tryLoginHref(item.id)} className="jw-btn jw-btn-primary ms-auto !min-h-8 !px-3 text-xs" onClick={() => track("studio.gallery_try")}>
                  <Icon name="sparkles" size={14} /> جرّبه
                </Link>
              )}
            </div>
            {item.refNames.length > 0 && <p className="text-[11px] text-jw-faint">تضيف صورك أنت مكان: <span dir="ltr">{item.refNames.map((r) => `@${r.name}`).join(" ")}</span></p>}
          </>
        ) : (
          <p className="text-[11px] text-jw-faint">برومبت هذا العمل خاص.</p>
        )}
      </div>
    </article>
  );
}

export default function GalleryBrowser({ initial, initialMore, signedIn, onTry, compact = false }: { initial: GalleryCard[]; initialMore: boolean; signedIn: boolean; onTry?: (item: GalleryCard) => void; compact?: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState(initial);
  const [more, setMore] = useState(initialMore);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(f: Filter, p: number) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/jawad/gallery?page=${p}${f === "all" ? "" : `&kind=${f}`}`, { cache: "no-store" });
      const body = (await res.json()) as { items?: GalleryCard[]; more?: boolean; error?: string };
      if (!res.ok) throw new Error(body.error ?? "تعذّر تحميل المعرض.");
      setItems((cur) => (p === 0 ? body.items ?? [] : [...cur, ...(body.items ?? [])]));
      setMore(Boolean(body.more));
      setPage(p);
    } catch (e) {
      setError(navigator.onLine ? (e as Error).message : "انقطع الاتصال.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="jw-seg" role="radiogroup" aria-label="نوع الأعمال">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className="!min-h-8 !px-2.5 !text-xs" onClick={() => {
                if (f.id === filter) return;
                setFilter(f.id);
                void load(f.id, 0);
              }}>
              <Icon name={f.icon} size={14} /> {f.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-jw-faint">كل عمل هنا وافقت عليه الإدارة. «جرّبه» ينسخ الإعدادات والبرومبت بس، وتضيف صورك أنت.</p>
      </div>
      {error && <p className="text-xs text-jw-danger" role="alert">{error}</p>}
      {items.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-jw-surface-2 text-jw-muted"><Icon name="image" size={22} /></span>
          <p className="font-semibold">{filter === "all" ? "المعرض فاضي للحين" : "ما فيه أعمال من هالنوع للحين"}</p>
          <p className="max-w-sm text-sm text-jw-muted">اصنع صورة أو فيديو في الاستوديو، ومن «أعمالي» اضغط «انشر وشارك» ← «انشر في المعرض».</p>
        </div>
      ) : (
        <div className={compact ? "columns-1 gap-3 sm:columns-2 lg:columns-3" : "columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4"}>
          {items.map((it) => (
            <Card key={it.id} item={it} signedIn={signedIn} onTry={onTry} />
          ))}
        </div>
      )}
      {loading && <div className="flex justify-center py-4"><span className="jw-spinner" /></div>}
      {more && !loading && (
        <div className="flex justify-center">
          <button type="button" className="jw-btn" onClick={() => load(filter, page + 1)}>عرض المزيد</button>
        </div>
      )}
    </div>
  );
}
