"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { RefKind } from "@config/jawad/types";
import type { Evaluation } from "@/lib/jawad/engine";
import type { WorkItem, WorksFilter } from "@/lib/jawad/labels";
import { UPLOAD_MIMES } from "@/lib/jawad/media";
import Dialog from "../Dialog";
import Icon from "../Icon";

const KIND_AR: Record<RefKind, string> = { image: "صورة", video: "فيديو", audio: "صوت" };
const KIND_PL: Record<RefKind, string> = { image: "الصور", video: "الفيديو", audio: "الصوت" };
const ACCEPT: Record<RefKind, string> = { image: "image/png,image/jpeg,image/webp", video: "video/mp4,video/quicktime", audio: "audio/mpeg,audio/wav,audio/x-wav" };

/** One of the user's works that can become a reference: a JAWAD result or a film project's picture/video. */
export type WorkSource = { outputId: string } | { filmAssetId: string };

interface Candidate {
  key: string;
  source: WorkSource;
  kind: RefKind;
  url: string | null;
  label: string;
  /** Why it can't be used here (null = it can). */
  blocked: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Kinds the generator takes as files. */
  kinds: RefKind[];
  /** A slot that takes one kind only (a frame: images). */
  only?: RefKind;
  refKinds: Evaluation["refKinds"];
  owner: boolean;
  multiple: boolean;
  onFiles: (files: File[]) => void;
  /** Adds a work as a reference; resolves to an error message, or null when added. */
  onPickWork: (source: WorkSource) => Promise<string | null>;
}

/**
 * «أضف مرجعًا»: from the device (opens its file picker) or from the user's works, sorted by type.
 * A modal window, so nothing around it can hide or clip it.
 */
export default function RefAdder({ open, onClose, title, kinds: genKinds, only, refKinds, owner, multiple, onFiles, onPickWork }: Props) {
  const inputId = useId();
  const [tab, setTab] = useState<"device" | "works">("device");
  const [filter, setFilter] = useState<WorksFilter>("all");
  const [items, setItems] = useState<WorkItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // Previews that failed to load (missing file, expired link) show the kind's icon instead of a broken picture
  const [broken, setBroken] = useState<Set<string>>(() => new Set());

  const kinds = only ? [only] : genKinds;
  const allowed = kinds.filter((k) => refKinds[k]?.allowed);
  // Works are shown by category, all of them; what this generator can't take is greyed with its reason
  const filters: WorksFilter[] = only ? [only] : ["all", "image", "video", "audio"];

  async function load(f: WorksFilter, cursor: string | null) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/jawad/works?filter=${f}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { items?: WorkItem[]; next?: string | null; error?: string };
      if (!res.ok) throw new Error(body.error ?? "تعذّر تحميل أعمالك.");
      setItems((cur) => (cursor ? [...cur, ...(body.items ?? [])] : body.items ?? []));
      setNext(body.next ?? null);
      setLoaded(true);
    } catch (e) {
      setError(navigator.onLine ? (e as Error).message : "لا يوجد اتصال بالإنترنت.");
    } finally {
      setLoading(false);
    }
  }

  function showWorks() {
    setTab("works");
    const f = filters.includes(filter) ? filter : filters[0];
    setFilter(f);
    if (!loaded) load(f, null);
  }

  function choose(f: WorksFilter) {
    setFilter(f);
    load(f, null);
  }

  const why = (k: RefKind) => (only && k !== only ? `هنا ${KIND_AR[only]} فقط.` : refKinds[k]?.allowed ? null : refKinds[k]?.reason ?? "غير مدعوم هنا.");
  const candidates: Candidate[] = items.flatMap((it): Candidate[] => {
    if (it.type === "film") {
      return [{ key: `f-${it.id}`, source: { filmAssetId: it.id }, kind: it.kind, url: it.url, label: `الفيلم: ${it.projectTitle}${it.refKey ? ` · ${it.refKey}` : ""}`, blocked: why(it.kind) }];
    }
    if (it.status !== "succeeded") return [];
    return it.outputs.map((o) => ({
      key: `o-${o.id}`,
      source: { outputId: o.id },
      kind: o.kind,
      url: o.url,
      label: `${it.generatorName}${it.prompt ? `: ${it.prompt.slice(0, 60)}` : ""}`,
      blocked: UPLOAD_MIMES[o.mime] ? why(o.kind) : "هذه الصيغة لا تُستخدم كمرجع (المقبول MP3 وWAV للصوت).",
    }));
  });

  async function pick(c: Candidate) {
    if (c.blocked || busy) return;
    setBusy(c.key);
    setError("");
    const err = await onPickWork(c.source);
    setBusy(null);
    if (err) setError(err);
    else onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} wide={tab === "works"}>
      <div className="space-y-4 p-4">
        <div className="jw-seg" role="tablist" aria-label="مصدر المرجع">
          <button type="button" role="tab" aria-selected={tab === "device"} onClick={() => setTab("device")}>
            <Icon name="upload" size={15} /> من جهازك
          </button>
          <button type="button" role="tab" aria-selected={tab === "works"} onClick={showWorks}>
            <Icon name="grid" size={15} /> من أعمالي
          </button>
        </div>

        {tab === "device" ? (
          <div className="space-y-3">
            {allowed.length ? (
              // A label opens the device's file picker natively (no scripted click that a browser could block)
              <label
                htmlFor={inputId}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = [...e.dataTransfer.files];
                  if (files.length) {
                    onFiles(files);
                    onClose();
                  }
                }}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-jw-line-strong bg-jw-bg-2 px-4 py-10 text-center transition-colors hover:border-jw-accent hover:bg-jw-accent-soft"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-jw-accent-soft text-jw-accent"><Icon name="upload" size={22} /></span>
                <span className="font-semibold">اختر {multiple ? "ملفات" : "ملفًا"} من جهازك</span>
                <span className="text-xs text-jw-muted">أو اسحبه وأفلته هنا · {allowed.map((k) => KIND_AR[k]).join("، ")}</span>
              </label>
            ) : (
              <p className="rounded-xl border border-jw-line bg-jw-bg-2 px-4 py-8 text-center text-sm text-jw-muted">لا يمكن إضافة مراجع من الجهاز في هذا الوضع حاليًا.</p>
            )}
            <input
              id={inputId}
              type="file"
              className="sr-only"
              accept={allowed.map((k) => ACCEPT[k]).join(",")}
              multiple={multiple}
              disabled={!allowed.length}
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = "";
                if (files.length) {
                  onFiles(files);
                  onClose();
                }
              }}
            />
            {/* Kinds that are off right now, each with its reason */}
            {kinds
              .filter((k) => !refKinds[k]?.allowed)
              .map((k) => (
                <p key={k} className="flex items-start gap-2 text-xs text-jw-warn">
                  <Icon name="info" size={14} className="mt-0.5 shrink-0" />
                  <span>
                    {KIND_PL[k]}: {refKinds[k]?.reason}
                    {owner && refKinds[k]?.needsPrice && (
                      <>
                        {" "}
                        <Link href="/jawad-ai/admin/prices" className="underline">حدد السعر</Link>
                      </>
                    )}
                  </span>
                </p>
              ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filters.length > 1 && (
              <div className="jw-seg" role="tablist" aria-label="نوع العمل">
                {filters.map((f) => (
                  <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => choose(f)} className="!min-h-8 !px-2.5 !text-xs">
                    <Icon name={f === "all" ? "grid" : f} size={14} /> {f === "all" ? "الكل" : KIND_PL[f]}
                  </button>
                ))}
              </div>
            )}
            {error && <p className="text-xs text-jw-danger" role="alert">{error}</p>}
            {!loading && loaded && !candidates.length ? (
              <p className="py-10 text-center text-sm text-jw-muted">{filter === "all" ? "لا توجد أعمال جاهزة بعد." : `لا توجد أعمال من نوع «${KIND_PL[filter as RefKind]}» بعد.`}</p>
            ) : (
              <ul className="grid max-h-[55dvh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 lg:grid-cols-6">
                {candidates.map((c) => (
                  <li key={c.key}>
                    <button
                      type="button"
                      onClick={() => pick(c)}
                      disabled={Boolean(c.blocked) || Boolean(busy)}
                      aria-label={`${KIND_AR[c.kind]}: ${c.label}${c.blocked ? ` — ${c.blocked}` : ""}`}
                      title={c.blocked ?? c.label}
                      className="relative block aspect-square w-full overflow-hidden rounded-lg border border-jw-line bg-jw-bg-2 transition hover:border-jw-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-jw-line"
                    >
                      <Preview url={broken.has(c.key) ? null : c.url} kind={c.kind} onBroken={() => setBroken((b) => new Set(b).add(c.key))} />
                      <span className="absolute bottom-1 start-1 flex items-center gap-1 rounded bg-black/70 px-1 py-0.5 text-[10px] text-white">
                        <Icon name={c.source && "filmAssetId" in c.source ? "film" : c.kind === "video" ? "play" : c.kind} size={10} />
                      </span>
                      {busy === c.key && (
                        <span className="absolute inset-0 grid place-items-center bg-black/55">
                          <span className="jw-spinner" role="status" aria-label="يُضاف" />
                        </span>
                      )}
                    </button>
                  </li>
                ))}
                {loading && Array.from({ length: 6 }, (_, i) => <li key={`sk-${i}`} className="jw-skeleton aspect-square rounded-lg" />)}
              </ul>
            )}
            {next && !loading && (
              <div className="flex justify-center">
                <button type="button" className="jw-btn" onClick={() => load(filter, next)}>عرض المزيد</button>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

function Preview({ url, kind, onBroken }: { url: string | null; kind: RefKind; onBroken: () => void }) {
  if (url && kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" loading="lazy" onError={onBroken} className="size-full object-cover" />;
  }
  if (url && kind === "video") {
    return <video src={`${url}#t=0.1`} muted preload="metadata" playsInline tabIndex={-1} onError={onBroken} className="pointer-events-none size-full object-cover" />;
  }
  return <span className="grid size-full place-items-center text-jw-accent"><Icon name={kind} size={22} /></span>;
}
