"use client";

// «انشر وشارك» on a finished picture or video in «أعمالي»: «انشر في المعرض» (waits for the owner's approval; the prompt,
// generator, style and shape go with it — never the references) and «رابط دائم» (a public page for this one work that
// its owner turns off here). Until the gallery's table (0112) is run, it says so in one line.

import { useCallback, useEffect, useState } from "react";
import { STATUS_LABEL, TITLE_MAX, cleanTitle, type GalleryStatus } from "@config/jawad/gallery";
import type { JobView } from "@/lib/jawad/labels";
import { track } from "@/lib/feature-track";
import Dialog from "../Dialog";
import Icon from "../Icon";

interface Mine {
  id: string;
  status: GalleryStatus;
  featured: boolean;
  title: string;
  shareUrl: string | null;
}

async function post(body: unknown): Promise<{ ok: boolean; item?: Mine; error?: string }> {
  try {
    const res = await fetch("/api/jawad/gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const b = (await res.json().catch(() => ({}))) as { item?: Mine; error?: string };
    return { ok: res.ok, item: b.item, error: b.error };
  } catch {
    return { ok: false, error: "انقطع الاتصال، جرّب مرة ثانية." };
  }
}

export default function PublishShare({ job, open, onClose }: { job: JobView; open: boolean; onClose: () => void }) {
  const outs = job.outputs.filter((o) => o.kind === "image" || o.kind === "video");
  const [pick, setPick] = useState(0);
  const out = outs[Math.min(pick, outs.length - 1)];
  const [state, setState] = useState<{ ready: boolean; items: Record<string, Mine> } | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const mine = out ? state?.items[out.id] : undefined;

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/jawad/gallery/mine?ids=${outs.map((o) => o.id).join(",")}`, { cache: "no-store" });
      const b = (await res.json()) as { ready?: boolean; items?: Record<string, Mine>; error?: string };
      if (!res.ok) throw new Error(b.error ?? "تعذّر التحميل.");
      setState({ ready: Boolean(b.ready), items: b.items ?? {} });
    } catch (e) {
      setError((e as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);
  useEffect(() => {
    if (!open || state) return;
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [open, state, load]);

  // the title box follows the chosen result's saved title
  const [titleFor, setTitleFor] = useState<string | null>(null);
  if (out && state && titleFor !== out.id) {
    setTitleFor(out.id);
    setTitle(state.items[out.id]?.title ?? "");
  }

  async function run(body: Record<string, unknown>, what: string) {
    if (!out) return;
    setBusy(what);
    setError("");
    const r = await post({ ...body, outputId: out.id });
    setBusy("");
    if (!r.ok || !r.item) return setError(r.error ?? "تعذّر.");
    setState((s) => (s ? { ...s, items: { ...s.items, [out.id]: r.item! } } : s));
  }

  const copy = async (url: string) => {
    const full = new URL(url, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("انسخ الرابط:", full);
    }
  };

  const status = mine?.status ?? "none";
  const inGallery = status === "pending" || status === "approved";
  const hidden = status === "hidden";
  const clean = cleanTitle(title);

  return (
    <Dialog open={open} onClose={onClose} title="انشر وشارك">
      <div className="space-y-4 p-4">
        {outs.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="اختر النتيجة">
            {outs.map((o, i) => (
              <button key={o.id} type="button" role="radio" aria-checked={i === pick} onClick={() => setPick(i)} className={`size-16 shrink-0 overflow-hidden rounded-lg border ${i === pick ? "border-jw-accent" : "border-jw-line"}`}>
                {o.url && o.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.url} alt={`النتيجة ${i + 1}`} className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center text-xs">{i + 1}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {!state && !error && <div className="flex justify-center py-6"><span className="jw-spinner" /></div>}
        {error && <p className="text-xs text-jw-danger" role="alert">{error}</p>}
        {state && !state.ready && <p className="rounded-lg border border-jw-line bg-jw-surface-2 px-3 py-2 text-xs text-jw-muted" role="status">معرض الناس والرابط الدائم بيفتحون قريب.</p>}

        {state?.ready && out && (
          <>
            <label className="block">
              <span className="jw-label">عنوان قصير (اختياري)</span>
              <input className="jw-input" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="مثلًا: قطّ رائد فضاء على القمر" disabled={hidden} dir="auto" />
            </label>

            <section className="space-y-2 rounded-xl border border-jw-line bg-jw-surface-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Icon name="grid" size={15} className="text-jw-accent" /> معرض الناس</h3>
                <span className={`jw-chip ${status === "approved" ? "text-jw-ok" : status === "pending" ? "text-jw-warn" : hidden || status === "rejected" ? "text-jw-danger" : ""}`}>
                  {STATUS_LABEL[status]}{mine?.featured ? " · ★ مختار" : ""}
                </span>
              </div>
              <p className="text-xs text-jw-muted">ما يظهر لأحد إلا بعد موافقة الإدارة. يظهر العمل وعنوانه والبرومبت والمولّد والمقاس والستايل، ومراجعك (صورك) ما تنعرض ولا تنتقل لأحد أبدًا.</p>
              {!hidden && (
                <div className="flex flex-wrap gap-2">
                  {(!inGallery || clean !== (mine?.title ?? "")) && (
                    <button
                      type="button"
                      className="jw-btn jw-btn-primary !min-h-9 text-sm"
                      disabled={Boolean(busy)}
                      onClick={() => {
                        track("studio.gallery_publish");
                        void run({ action: "publish", title }, "publish");
                      }}
                    >
                      {busy === "publish" ? <span className="jw-spinner" /> : <Icon name="upload" size={15} />}
                      {inGallery ? "حدّث العنوان (يرجع للمراجعة)" : status === "rejected" ? "أرسله للمراجعة مرة ثانية" : "انشر في المعرض"}
                    </button>
                  )}
                  {inGallery && (
                    <button type="button" className="jw-btn !min-h-9 text-sm" disabled={Boolean(busy)} onClick={() => run({ action: "withdraw" }, "withdraw")}>
                      {busy === "withdraw" ? <span className="jw-spinner" /> : <Icon name="x" size={15} />} اسحبه من المعرض
                    </button>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-2 rounded-xl border border-jw-line bg-jw-surface-2 p-3">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Icon name="link" size={15} className="text-jw-accent" /> رابط دائم</h3>
              <p className="text-xs text-jw-muted">صفحة لهذا العمل بس: الصورة أو الفيديو وعنوانه وزر «جرّبه في الجواد» (اللي يفتحه يقدر يجرّب نفس البرومبت). يشتغل لين تقفله أنت من هنا.</p>
              {hidden ? (
                <p className="text-xs text-jw-danger">الإدارة أخفت هذا العمل، فما ينفع تشاركه.</p>
              ) : mine?.shareUrl ? (
                <>
                  <p className="truncate rounded-lg border border-jw-line bg-jw-bg-2 px-2 py-1.5 text-xs" dir="ltr">{new URL(mine.shareUrl, typeof window === "undefined" ? "https://x" : window.location.origin).href}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="jw-btn jw-btn-primary !min-h-9 text-sm" onClick={() => copy(mine.shareUrl!)}>
                      <Icon name={copied ? "check" : "copy"} size={15} /> {copied ? "انتسخ ✓" : "انسخ الرابط"}
                    </button>
                    <a href={mine.shareUrl} target="_blank" rel="noopener" className="jw-btn !min-h-9 text-sm"><Icon name="external" size={15} /> افتحه</a>
                    <button type="button" className="jw-btn jw-btn-quiet !min-h-9 text-sm text-jw-danger" disabled={Boolean(busy)} onClick={() => run({ action: "share", on: false }, "unshare")}>
                      {busy === "unshare" ? <span className="jw-spinner" /> : <Icon name="lock" size={15} />} اقفل الرابط
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="jw-btn !min-h-9 text-sm"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    track("studio.share_permanent");
                    void run({ action: "share", on: true, title }, "share");
                  }}
                >
                  {busy === "share" ? <span className="jw-spinner" /> : <Icon name="link" size={15} />} سوّ رابط دائم
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </Dialog>
  );
}
