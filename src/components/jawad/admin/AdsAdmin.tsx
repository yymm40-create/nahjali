"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AdsGrid from "../AdsGrid";
import Icon from "../Icon";
import type { AdContent, AdSlot, AdView } from "@/lib/jawad/server/ads";
import { adminPost, captureFrame, uploadPublic } from "./client";

const SLOT_LABEL: Record<AdSlot, string> = { main: "الكبير (ثلثا العرض)", side_top: "الصغير العلوي", side_bottom: "الصغير السفلي" };

export interface AdminAd {
  id: string;
  draft: AdContent;
  live: AdContent | null;
  draftView: AdView;
  publishedAt: string | null;
}

export default function AdsAdmin({ ads, draftPreview, livePreview }: { ads: AdminAd[]; draftPreview: Record<AdSlot, AdView | null>; livePreview: Record<AdSlot, AdView | null> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState<"draft" | "live">("draft");

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="jw-panel space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">المعاينة</h2>
          <div className="jw-seg" role="radiogroup" aria-label="أي نسخة">
            <button type="button" role="radio" aria-checked={show === "draft"} onClick={() => setShow("draft")}>المسودة (قبل النشر)</button>
            <button type="button" role="radio" aria-checked={show === "live"} onClick={() => setShow("live")}>المنشور الآن</button>
          </div>
        </div>
        <AdsGrid ads={show === "draft" ? draftPreview : livePreview} emptyHint={<span className="text-xs">خانة فارغة</span>} />
        <p className="text-xs text-jw-faint">المسودة تعرض الإعلانات المفعّلة التي لها صورة أو فيديو، كل واحد في خانته. لا يراها الزوار قبل «انشر».</p>
      </section>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">الإعلانات ({ads.length})</h2>
        <button type="button" className="jw-btn jw-btn-primary" disabled={busy} onClick={() => run(() => adminPost("ad_create"))}>
          <Icon name="plus" size={16} /> إعلان جديد
        </button>
      </div>
      {error && <p className="error-box" role="alert">{error}</p>}
      {ads.length === 0 && <p className="jw-panel p-6 text-center text-sm text-jw-muted">لا توجد إعلانات بعد. الرئيسية تعرض ترحيبًا بسيطًا حتى تنشر أول إعلان.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {ads.map((a) => (
          <AdEditor key={a.id} ad={a} busy={busy} run={run} />
        ))}
      </div>
    </div>
  );
}

function AdEditor({ ad, busy, run }: { ad: AdminAd; busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const d = ad.draft;
  const [title, setTitle] = useState(d.title);
  const [href, setHref] = useState(d.href);
  const [slot, setSlot] = useState<AdSlot>(d.slot);
  const [enabled, setEnabled] = useState(d.enabled);
  const [progress, setProgress] = useState<number | null>(null);
  const [lastVideo, setLastVideo] = useState<File | null>(null);
  const dirty = title !== d.title || href !== d.href || slot !== d.slot || enabled !== d.enabled;
  const unpublished = JSON.stringify(ad.live) !== JSON.stringify(d);
  const media = ad.draftView.media;

  async function sendFile(which: "media" | "poster", file: File | Blob) {
    try {
      const path = await uploadPublic(which === "media" ? "ad_media" : "ad_poster", ad.id, file, setProgress);
      await adminPost("ad_file", { id: ad.id, which, path });
    } finally {
      setProgress(null);
    }
  }
  const upload = (which: "media" | "poster", file: File | Blob) => run(() => sendFile(which, file));

  return (
    <article className="jw-panel space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="jw-chip">{SLOT_LABEL[d.slot]}</span>
        {ad.live ? <span className="jw-chip text-jw-ok">منشور{ad.live.enabled ? "" : " (مخفي)"}</span> : <span className="jw-chip">غير منشور</span>}
        {ad.live && unpublished && <span className="jw-chip text-jw-warn">تعديلات غير منشورة</span>}
      </div>

      <div className="relative aspect-video overflow-hidden rounded-lg border border-jw-line bg-jw-bg-2">
        {media?.type === "video" ? (
          <video src={media.url} poster={ad.draftView.posterUrl ?? undefined} muted controls preload="metadata" className="size-full object-cover" />
        ) : media ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.url} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-sm text-jw-faint">بدون صورة أو فيديو</span>
        )}
        {progress != null && <span className="absolute inset-x-0 bottom-0 h-1 bg-jw-accent" style={{ width: `${Math.round(progress * 100)}%` }} />}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="jw-btn cursor-pointer">
          <Icon name="upload" size={16} /> {media ? "استبدل الصورة/الفيديو" : "ارفع صورة أو فيديو"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,video/mp4"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (f.type === "video/mp4") setLastVideo(f);
              upload("media", f);
            }}
          />
        </label>
        {media && (
          <button type="button" className="jw-btn jw-btn-quiet" disabled={busy} onClick={() => run(() => adminPost("ad_file", { id: ad.id, which: "media", path: null }))}>
            إزالة
          </button>
        )}
      </div>

      {media?.type === "video" && (
        <div className="space-y-2 rounded-lg border border-jw-line p-3">
          <p className="text-sm">صورة الغلاف {ad.draftView.posterUrl ? "✓" : <span className="text-jw-faint">(لا توجد)</span>}</p>
          <div className="flex flex-wrap gap-2">
            <label className="jw-btn cursor-pointer">
              ارفع غلافًا
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) upload("poster", f);
                }}
              />
            </label>
            <button type="button" className="jw-btn" disabled={busy} onClick={() => run(async () => sendFile("poster", await captureFrame(lastVideo ?? media.url)))}>
              التقط من الفيديو
            </button>
            {ad.draftView.posterUrl && (
              <button type="button" className="jw-btn jw-btn-quiet" disabled={busy} onClick={() => run(() => adminPost("ad_file", { id: ad.id, which: "poster", path: null }))}>
                إزالة الغلاف
              </button>
            )}
          </div>
          <p className="text-[11px] text-jw-faint">الفيديو يعمل دائمًا بلا صوت، ويتوقف خارج الشاشة، ولا يتحرك لمن فعّل «تقليل الحركة».</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="jw-label">العنوان (يظهر أسفل الصورة)</span>
          <input className="jw-input" dir="auto" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="sm:col-span-2">
          <span className="jw-label">الرابط عند الضغط</span>
          <input className="jw-input" dir="ltr" placeholder="/jawad-ai/video  أو  https://…" value={href} onChange={(e) => setHref(e.target.value)} />
        </label>
        <label>
          <span className="jw-label">الخانة</span>
          <select className="jw-select" value={slot} onChange={(e) => setSlot(e.target.value as AdSlot)}>
            {(Object.keys(SLOT_LABEL) as AdSlot[]).map((s) => (
              <option key={s} value={s}>{SLOT_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 accent-[var(--jw-accent)]" />
          <span className="text-sm">مفعّل (يظهر بعد النشر)</span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-jw-line pt-3">
        <button type="button" className="jw-btn" disabled={busy || !dirty} onClick={() => run(() => adminPost("ad_update", { id: ad.id, title, href, slot, enabled }))}>
          احفظ المسودة
        </button>
        <button type="button" className="jw-btn jw-btn-primary" disabled={busy || dirty} title={dirty ? "احفظ المسودة أولًا" : undefined} onClick={() => run(() => adminPost("ad_publish", { id: ad.id }))}>
          انشر
        </button>
        {ad.live && (
          <button type="button" className="jw-btn" disabled={busy} onClick={() => run(() => adminPost("ad_unpublish", { id: ad.id }))}>
            أخفِ من الموقع
          </button>
        )}
        <button
          type="button"
          className="jw-btn jw-btn-quiet ms-auto text-jw-danger"
          disabled={busy}
          onClick={() => confirm("حذف الإعلان نهائيًا مع ملفاته؟") && run(() => adminPost("ad_delete", { id: ad.id }))}
        >
          <Icon name="trash" size={16} /> حذف
        </button>
      </div>
    </article>
  );
}
