"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { generatorById } from "@config/jawad/generators";
import { isStem, SMART_SPLIT_ID, STEM_LABEL } from "@config/jawad/smart-split";
import { isOpenStatus, stageLabel, type FilmItemView, type JobView, type OutputView, type WorkItem, type WorksFilter } from "@/lib/jawad/labels";
import SmartCoin from "@/components/SmartCoin";
import Dialog from "../Dialog";
import SmartEdit from "./SmartEdit";
import { smartEditInEditor } from "../editor/smart-open";
import SoundOnVideo from "./SoundOnVideo";
import Icon from "../Icon";
import LocalTime from "../LocalTime";
import LoginLink from "../LoginLink";

const FILTERS: { key: WorksFilter; label: string; icon: string }[] = [
  { key: "all", label: "الكل", icon: "grid" },
  { key: "image", label: "الصور", icon: "image" },
  { key: "video", label: "الفيديو", icon: "video" },
  { key: "audio", label: "الصوت", icon: "audio" },
];

// Thumbnail size of the works: "large" cards with details, or "small" squares (tap one for its card).
// Remembered on this device; works without storage too (then only for this visit).
type Density = "large" | "small";
const DENSITY_KEY = "jw-works-density";
const densityListeners = new Set<() => void>();
let densityMemory: Density | null = null;
function readDensity(): Density {
  if (densityMemory) return densityMemory;
  try {
    return localStorage.getItem(DENSITY_KEY) === "small" ? "small" : "large";
  } catch {
    return "large";
  }
}
function writeDensity(d: Density) {
  densityMemory = d;
  try {
    localStorage.setItem(DENSITY_KEY, d);
  } catch {
    // private mode or blocked storage: kept in memory for this visit
  }
  densityListeners.forEach((l) => l());
}
const subscribeDensity = (l: () => void) => {
  densityListeners.add(l);
  return () => {
    densityListeners.delete(l);
  };
};

/** Short, readable summary of the settings used (technical values left-to-right). */
function settingChips(j: JobView) {
  const def = generatorById(j.generatorId);
  const out: string[] = [];
  for (const o of def?.options ?? []) {
    const v = j.settings[o.key];
    if (v === undefined) continue;
    if (o.kind === "choice") {
      const known = o.values.find((x) => x.value === v)?.label;
      // A voice from the person's library or ElevenLabs' list (its name lives on the server)
      const voice = o.picker === "voice" && !known ? (String(v).startsWith("v:") ? "صوت من مكتبتي" : "صوت جاهز") : null;
      out.push(v === "adaptive" ? "نسبة الإطار الأول" : known ?? voice ?? String(v));
    }
    if (o.kind === "int") out.push(`${v} ${o.unit}`);
    if (o.kind === "bool" && v) out.push(o.label);
  }
  // A sound made another way than from the text alone («من فيديو»، «بمقطع مرجعي»)
  const mode = def?.output === "audio" ? def.modes.find((m) => m.id === j.mode) : undefined;
  if (mode && mode.refStyle !== "none") out.unshift(mode.label);
  return out;
}

export interface WorksPanelProps {
  items: WorkItem[];
  filter: WorksFilter;
  onFilter: (f: WorksFilter) => void;
  loading: boolean;
  hasMore: boolean;
  onMore: () => void;
  error: string | null;
  offline: boolean;
  signedIn: boolean;
  allowed: boolean;
  onReuse: (j: JobView) => void;
  /** The same request again, as a new result. */
  onVariation: (j: JobView) => void;
  onUseAsRef: (o: OutputView, j: JobView) => void;
  onCancel: (j: JobView) => void;
  onRetrySubmit: (j: JobView) => void;
  canUseAsRef: (o: OutputView) => string | null;
  /** «التعديل الذكي» made a new job. */
  onEdited: (j: JobView, balance: number | null) => void;
}

export default function WorksPanel(p: WorksPanelProps) {
  const [viewer, setViewer] = useState<{ job: JobView; index: number } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const density = useSyncExternalStore(subscribeDensity, readDensity, () => "large" as Density);
  const small = density === "small";
  // The card of a small square, kept live (its job keeps updating while open)
  const detail = detailId ? p.items.find((it) => itemKey(it) === detailId) ?? null : null;
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasMore, loading, onMore } = p;

  // Load the next page when the end of the list comes into view
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && !loading && onMore(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, onMore]);

  return (
    <section aria-label="أعمالي" className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-jw-line px-4 py-2.5">
        <h2 className="text-sm font-semibold">أعمالي</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="jw-seg" role="tablist" aria-label="تصفية الأعمال">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={p.filter === f.key} onClick={() => p.onFilter(f.key)} className="!min-h-8 !px-2.5 !text-xs">
                <Icon name={f.icon} size={14} /> {f.label}
              </button>
            ))}
          </div>
          <div className="jw-seg" role="radiogroup" aria-label="حجم المعاينات">
            <button type="button" role="radio" aria-checked={!small} onClick={() => writeDensity("large")} className="!min-h-8 !px-2" title="معاينات كبيرة مع التفاصيل">
              <Icon name="expand" size={14} /> <span className="sr-only sm:not-sr-only">كبيرة</span>
            </button>
            <button type="button" role="radio" aria-checked={small} onClick={() => writeDensity("small")} className="!min-h-8 !px-2" title="مربعات صغيرة">
              <Icon name="grid" size={14} /> <span className="sr-only sm:not-sr-only">صغيرة</span>
            </button>
          </div>
        </div>
      </div>

      <div className="jw-scroll min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {p.offline && (
          <p className="mb-3 flex items-center gap-2 rounded-lg border border-jw-warn/40 bg-jw-warn/10 px-3 py-2 text-xs text-jw-warn" role="status">
            <Icon name="alert" size={14} /> انقطع الاتصال. أعمالك محفوظة على الخادم، وستتحدث الحالة عند عودة الاتصال.
          </p>
        )}
        {!p.signedIn ? (
          <Empty icon="user" title="سجّل الدخول لترى أعمالك" text="تُحفظ كل أعمالك في حسابك وتبقى خاصة بك.">
            <LoginLink />
          </Empty>
        ) : !p.allowed ? (
          <Empty icon="lock" title="المنصة مغلقة لحسابك حاليًا" text="تواصل مع إدارة المنصة إذا كنت تتوقع أن تكون متاحة لك." />
        ) : p.items.length === 0 && !p.loading ? (
          p.error ? (
            <Empty icon="alert" title="تعذّر تحميل أعمالك" text={p.error} />
          ) : (
            <Empty icon="sparkles" title={p.filter === "all" ? "لا توجد أعمال بعد" : "لا توجد أعمال من هذا النوع"} text="اكتب وصفًا في الخانة واضغط «توليد»؛ أول عمل لك يظهر هنا خلال ثوانٍ إلى دقائق." />
          )
        ) : small ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {p.items.map((it) => (
              <li key={itemKey(it)} className="jw-fade-in">
                <Tile it={it} onOpen={() => setDetailId(itemKey(it))} />
              </li>
            ))}
            {p.loading && Array.from({ length: 6 }, (_, i) => <li key={`sk-${i}`} className="jw-skeleton aspect-square rounded-lg" />)}
          </ul>
        ) : (
          <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {p.items.map((it) =>
              it.type === "job" ? (
                <li key={it.id} className="jw-fade-in">
                  <JobCard j={it} onOpen={(index) => setViewer({ job: it, index })} {...p} />
                </li>
              ) : (
                <li key={`film-${it.id}`} className="jw-fade-in">
                  <FilmCard f={it} />
                </li>
              ),
            )}
            {p.loading &&
              Array.from({ length: 3 }, (_, i) => (
                <li key={`sk-${i}`} className="jw-panel overflow-hidden">
                  <div className="jw-skeleton aspect-video" />
                  <div className="space-y-2 p-3">
                    <div className="jw-skeleton h-3 w-1/2 rounded" />
                    <div className="jw-skeleton h-3 w-3/4 rounded" />
                  </div>
                </li>
              ))}
          </ul>
        )}
        {p.error && p.items.length > 0 && <p className="mt-3 text-center text-xs text-jw-danger">{p.error}</p>}
        <div ref={sentinel} aria-hidden className="h-4" />
        {hasMore && !loading && (
          <div className="mt-2 flex justify-center">
            <button type="button" className="jw-btn" onClick={onMore}>عرض المزيد</button>
          </div>
        )}
      </div>

      <Dialog open={Boolean(detail)} onClose={() => setDetailId(null)} title={detail ? (detail.type === "job" ? detail.generatorName : "الفيلم السينمائي") : ""}>
        {detail && (
          <div className="p-3">
            {detail.type === "job" ? (
              <JobCard
                j={detail}
                {...p}
                onOpen={(index) => {
                  setDetailId(null);
                  setViewer({ job: detail, index });
                }}
              />
            ) : (
              <FilmCard f={detail} />
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={Boolean(viewer)} onClose={() => setViewer(null)} title={viewer ? `${viewer.job.generatorName} · ${viewer.index + 1}/${viewer.job.outputs.length}` : ""} wide>
        {viewer && <Viewer job={viewer.job} index={viewer.index} onIndex={(index) => setViewer({ ...viewer, index })} />}
      </Dialog>
    </section>
  );
}

const itemKey = (it: WorkItem) => (it.type === "job" ? it.id : `film-${it.id}`);

/** A small square: the first result (or the job's state); tap for the full card. Videos never play here. */
function Tile({ it, onOpen }: { it: WorkItem; onOpen: () => void }) {
  const job = it.type === "job" ? it : null;
  const film = it.type === "film" ? it : null;
  const out = job?.status === "succeeded" ? job.outputs[0] : undefined;
  const url = job ? out?.url ?? null : film?.url ?? null;
  const kind = job ? out?.kind ?? job.outputKind : film?.kind ?? "image";
  const open = job ? isOpenStatus(job.status) : false;
  const failed = Boolean(job && !open && job.status !== "succeeded");
  const label = job ? `${job.generatorName}${job.prompt ? `: ${job.prompt.slice(0, 80)}` : ""} — ${stageLabel(job.status, job.providerStatus)}` : `الفيلم السينمائي: ${film?.projectTitle ?? ""}`;
  return (
    <button type="button" onClick={onOpen} aria-label={label} title={label} className="group relative block aspect-square w-full overflow-hidden rounded-lg border border-jw-line bg-jw-bg-2 transition hover:border-jw-accent focus-visible:border-jw-accent">
      {url && kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" className="size-full object-cover" />
      ) : url && kind === "video" ? (
        <video src={`${url}#t=0.1`} muted preload="metadata" playsInline tabIndex={-1} className="pointer-events-none size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-jw-muted">
          {open ? <span className="jw-spinner" /> : <Icon name={failed ? "alert" : kind === "audio" ? "audio" : kind === "video" ? "video" : "image"} size={22} className={failed && job?.status !== "cancelled" ? "text-jw-danger" : kind === "audio" ? "text-jw-accent" : ""} />}
        </span>
      )}
      {/* What kind of work, and how many results */}
      <span className="absolute bottom-1 start-1 flex items-center gap-1 rounded bg-black/70 px-1 py-0.5 text-[10px] text-white">
        <Icon name={it.type === "film" ? "film" : kind === "video" ? "play" : kind === "audio" ? "audio" : "image"} size={10} />
        {job && job.outputs.length > 1 && <span dir="ltr">{job.outputs.length}</span>}
      </span>
    </button>
  );
}

function Empty({ icon, title, text, children }: { icon: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-jw-surface-2 text-jw-muted"><Icon name={icon} size={22} /></span>
      <p className="font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-jw-muted">{text}</p>
      {children}
    </div>
  );
}

function OutputMedia({ o, onOpen, cover }: { o: OutputView; onOpen?: () => void; cover?: boolean }) {
  if (!o.url) return <div className="grid aspect-video place-items-center bg-jw-bg-2 text-xs text-jw-faint">الملف غير متاح</div>;
  if (o.kind === "image") {
    return (
      <button type="button" onClick={onOpen} className="block size-full" aria-label="تكبير الصورة">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={o.url} alt="" loading="lazy" className={`size-full ${cover ? "object-cover" : "object-contain"} bg-jw-bg-2`} />
      </button>
    );
  }
  // Players never start (or make sound) by themselves
  // "#t=0.1" makes browsers show the first frame instead of a black box
  if (o.kind === "video") return <video src={`${o.url}#t=0.1`} controls preload="metadata" playsInline className="size-full bg-black object-contain" />;
  return (
    <div className="flex h-full flex-col justify-center gap-2 bg-jw-bg-2 p-3">
      <Icon name="audio" size={28} className="mx-auto text-jw-accent" />
      <audio src={o.url} controls preload="metadata" className="w-full" />
    </div>
  );
}

function JobCard({ j, onOpen, onReuse, onVariation, onUseAsRef, onCancel, onRetrySubmit, canUseAsRef, onEdited }: { j: JobView; onOpen: (i: number) => void } & WorksPanelProps) {
  const [details, setDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(new URL(url, window.location.origin).href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("انسخ الرابط:", url);
    }
  };
  const [editing, setEditing] = useState(false);
  const [opening, setOpening] = useState(false);
  // a video: cut out the pieces to fix in «حيدر كات» (red track) and get them made again there (green track)
  const startEdit = async () => {
    if (j.outputKind !== "video") return setEditing(true);
    setOpening(true);
    const href = await smartEditInEditor(j.id, j.outputs[0]?.id);
    if (href) return window.location.assign(href);
    setOpening(false);
    setEditing(true);
  };
  const editable = j.status === "succeeded" && j.outputs.length > 0 && (j.outputKind === "video" || j.outputKind === "image");
  // Opened with ?edit=<this job> (e.g. a film video sent here): «التعديل الذكي» opens by itself
  useEffect(() => {
    if (!editable) return;
    const t = setTimeout(() => {
      const q = new URLSearchParams(window.location.search);
      if (q.get("edit") !== j.id) return;
      // once: a later filter change or remount doesn't open it again
      q.delete("edit");
      window.history.replaceState(null, "", `${window.location.pathname}${q.size ? `?${q}` : ""}`);
      setEditing(true);
      document.getElementById(`job-${j.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    return () => clearTimeout(t);
  }, [editable, j.id]);
  // Opened with #job-<this job> (e.g. from the editor, following an edit being made): shown once it is listed
  useEffect(() => {
    if (window.location.hash !== `#job-${j.id}`) return;
    const t = setTimeout(() => document.getElementById(`job-${j.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 400);
    return () => clearTimeout(t);
  }, [j.id]);
  // «الفصل الذكي»: each track by name; they can be watched under their video, together or one by one
  const [watching, setWatching] = useState(false);
  const sourceVideo = j.mode === "video_to_sfx" || j.generatorId === SMART_SPLIT_ID ? j.refs.find((r) => r.kind === "video") : undefined;
  const stemLabel = (o: OutputView) => (isStem(o.name) ? STEM_LABEL[o.name] : null);
  const tracks = j.status === "succeeded" && sourceVideo ? j.outputs.flatMap((o) => (o.url ? [{ id: o.id, label: stemLabel(o) ?? "الصوت", url: o.url, downloadUrl: o.downloadUrl }] : [])) : [];
  const stemmed = j.outputs.length > 1 && j.outputs.every((o) => o.kind === "audio");
  const open = isOpenStatus(j.status);
  const chips = settingChips(j);
  const outs = j.outputs;
  return (
    <article id={`job-${j.id}`} className="jw-panel overflow-hidden" aria-busy={open}>
      <div className={`relative ${j.outputKind === "audio" ? (stemmed && j.status === "succeeded" ? "" : "h-28") : "aspect-video"} bg-jw-bg-2`}>
        {j.status === "succeeded" && outs.length ? (
          stemmed ? (
            <ul className="space-y-1.5 p-2.5" aria-label="المسارات">
              {outs.map((o) => (
                <li key={o.id} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs font-medium">{stemLabel(o) ?? "الصوت"}</span>
                  {o.url ? <audio src={o.url} controls preload="metadata" className="h-9 min-w-0 flex-1" aria-label={stemLabel(o) ?? "الصوت"} /> : <span className="text-xs text-jw-faint">الملف غير متاح</span>}
                </li>
              ))}
            </ul>
          ) : outs.length === 1 ? (
            <OutputMedia o={outs[0]} onOpen={() => onOpen(0)} />
          ) : (
            <div className="grid size-full grid-cols-2 gap-px bg-jw-line">
              {outs.slice(0, 4).map((o, i) => (
                <div key={o.id} className="overflow-hidden">
                  <OutputMedia o={o} onOpen={() => onOpen(i)} cover />
                </div>
              ))}
            </div>
          )
        ) : open ? (
          <div className="flex size-full flex-col items-center justify-center gap-3" role="status" aria-live="polite">
            <span className="jw-spinner jw-spinner-lg" />
            <span className="text-sm">{stageLabel(j.status, j.providerStatus)}</span>
            {/* A percentage only when the provider reports real progress */}
            {j.progress != null && <span className="text-xs tabular-nums text-jw-muted" dir="ltr">{j.progress}%</span>}
          </div>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center">
            <Icon name="alert" size={22} className={j.status === "cancelled" ? "text-jw-muted" : "text-jw-danger"} />
            <span className="text-sm font-medium">{stageLabel(j.status)}</span>
            {j.error && <span className="text-xs text-jw-muted">{j.error}</span>}
          </div>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold" dir="ltr">{j.generatorName}</span>
          <LocalTime iso={j.createdAt} className="shrink-0 text-[11px] text-jw-faint" />
        </div>
        {j.prompt && <p className="line-clamp-2 text-xs text-jw-muted" dir="auto">{j.prompt}</p>}
        <div className="flex flex-wrap gap-1">
          {chips.map((c) => (
            <span key={c} className="jw-chip" dir="auto">{c}</span>
          ))}
          <span className="jw-chip">
            <SmartCoin size={12} />
            <span dir="ltr">{j.priceCoins}</span>
            {j.chargeState === "refunded" ? " · أُعيدت" : !j.charged ? " · بلا خصم" : ""}
          </span>
        </div>

        {details && (
          <div className="space-y-1.5 rounded-lg border border-jw-line bg-jw-bg-2 p-2.5 text-xs">
            <p className="text-jw-muted">البرومبت:</p>
            <p className="whitespace-pre-wrap" dir="auto">{j.prompt || "—"}</p>
            {j.instructions && (
              <>
                <p className="pt-1 text-jw-muted">وصف الأداء:</p>
                <p className="whitespace-pre-wrap" dir="auto">{j.instructions}</p>
              </>
            )}
            <p className="pt-1 text-jw-muted">الإعدادات:</p>
            <p dir="ltr" className="break-all font-mono text-[11px]" style={{ textAlign: "right" }}>{JSON.stringify(j.settings)}</p>
            {j.refs.length > 0 && (
              <p className="text-jw-muted">
                المراجع: <span dir="ltr">{j.refs.map((r) => (r.name ? `@${r.name}` : "—")).join(" · ")}</span>
              </p>
            )}
            {j.diction.length > 0 && (
              <>
                <p className="pt-1 text-jw-muted">النطق الدقيق (كلمات ضُبط نطقها):</p>
                <p className="leading-7" dir="rtl">
                  {j.diction.map((d, k) => (
                    <span key={k} className="me-2 inline-block">
                      {d.word} ← <span className="font-semibold text-jw-ink">{d.vocalized}</span>
                    </span>
                  ))}
                </p>
              </>
            )}
            {j.modelPrompt && (
              <>
                <p className="pt-1 text-jw-muted">{j.diction.length ? "كما وصل لـ ElevenLabs:" : "كما وصل للمولد (أسماء المراجع بصيغته):"}</p>
                {j.diction.length ? (
                  // The Arabic text with each phonetic word («/…/», left to right) kept in its place
                  <p className="whitespace-pre-wrap leading-7" dir="rtl">
                    {j.modelPrompt.split(/(\/[^/\n]+\/)/).map((part, k) =>
                      k % 2 ? (
                        <bdi key={k} dir="ltr" className="rounded bg-jw-bg-2 px-1 font-mono text-[11px]">
                          {part}
                        </bdi>
                      ) : (
                        part
                      ),
                    )}
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap" dir="auto">{j.modelPrompt}</p>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1 pt-1">
          <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs" onClick={() => setDetails((d) => !d)} aria-expanded={details}>
            <Icon name="eye" size={14} /> {details ? "إخفاء" : "التفاصيل"}
          </button>
          <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs" onClick={() => onReuse(j)}>
            <Icon name="retry" size={14} /> استخدم الإعدادات
          </button>
          {j.status === "succeeded" && (
            <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs" title="نفس الطلب مرة ثانية، نتيجة جديدة بنفس السعر" onClick={() => onVariation(j)}>
              <Icon name="sparkles" size={14} /> نسخة ثانية · {j.priceCoins}
            </button>
          )}
          {j.status === "succeeded" &&
            outs.map((o, i) => (
              <a key={o.id} href={o.downloadUrl} className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs" download>
                <Icon name="download" size={14} /> تنزيل{stemLabel(o) && outs.length > 1 ? ` ${stemLabel(o)}` : outs.length > 1 ? ` ${i + 1}` : ""}
              </a>
            ))}
          {j.status === "succeeded" && outs.length > 1 && (
            <button
              type="button"
              className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs"
              onClick={() => {
                // one click, every file (a moment apart so the browser accepts them all)
                outs.forEach((o, i) => setTimeout(() => { const a = document.createElement("a"); a.href = o.downloadUrl; a.download = ""; a.click(); }, i * 400));
              }}
            >
              <Icon name="download" size={14} /> نزّل الكل
            </button>
          )}
          {j.status === "succeeded" &&
            outs.map((o, i) => {
              const why = canUseAsRef(o);
              return (
                <button key={`ref-${o.id}`} type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs" disabled={Boolean(why)} title={why ?? "أضفه إلى المراجع"} onClick={() => onUseAsRef(o, j)}>
                  <Icon name="layers" size={14} /> كمرجع{outs.length > 1 ? ` ${stemLabel(o) ?? i + 1}` : ""}
                </button>
              );
            })}
          {j.status === "succeeded" && outs[0] && (
            <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs" title="رابط مؤقت (١٠ دقائق) ترسله لأي أحد" onClick={() => copyLink(outs[0].downloadUrl)}>
              <Icon name={copied ? "check" : "copy"} size={14} /> {copied ? "انسخ الرابط ✓" : "رابط مؤقت"}
            </button>
          )}
          {tracks.length > 0 && (
            <button type="button" className="jw-btn !min-h-8 !px-2 text-xs !border-jw-accent/50 text-jw-accent" onClick={() => setWatching(true)}>
              <Icon name="play" size={14} /> شاهد مع الفيديو
            </button>
          )}
          {editable && (
            <button type="button" className="jw-btn !min-h-8 !px-2 text-xs !border-jw-accent/50 text-jw-accent" disabled={opening} onClick={startEdit}>
              <Icon name="wand" size={14} /> {opening ? "يفتح حيدر كات…" : "التعديل الذكي"}
            </button>
          )}
          {j.cancellable && (
            <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs text-jw-danger" onClick={() => onCancel(j)}>
              <Icon name="stop" size={14} /> إلغاء (في الطابور)
            </button>
          )}
          {j.status === "validating" && j.error && (
            <button type="button" className="jw-btn !min-h-8 !px-2 text-xs" onClick={() => onRetrySubmit(j)}>
              <Icon name="retry" size={14} /> أعد الإرسال
            </button>
          )}
        </div>
        {j.status === "validating" && j.error && <p className="text-xs text-jw-warn">{j.error}</p>}
      </div>
      {tracks.length > 0 && sourceVideo && <SoundOnVideo uploadId={sourceVideo.uploadId} tracks={tracks} open={watching} onClose={() => setWatching(false)} />}
      {editable && (
        <SmartEdit
          job={j}
          open={editing}
          onClose={() => setEditing(false)}
          onCreated={(nj, balance) => {
            setEditing(false);
            onEdited(nj, balance);
          }}
        />
      )}
    </article>
  );
}

function FilmCard({ f }: { f: FilmItemView }) {
  return (
    <article className="jw-panel overflow-hidden">
      <div className="aspect-video bg-jw-bg-2">
        {f.url ? (
          f.kind === "video" ? (
            <video src={`${f.url}#t=0.1`} controls preload="metadata" playsInline className="size-full bg-black object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.url} alt="" loading="lazy" className="size-full object-contain" />
          )
        ) : (
          <div className="grid size-full place-items-center text-xs text-jw-faint">الملف غير متاح</div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold"><Icon name="film" size={14} className="text-jw-accent" /> الفيلم السينمائي</span>
          <LocalTime iso={f.createdAt} className="shrink-0 text-[11px] text-jw-faint" />
        </div>
        <p className="truncate text-xs text-jw-muted" dir="auto">من مشروع: {f.projectTitle} {f.refKey && <span dir="ltr">· {f.refKey}</span>}</p>
        <div className="flex flex-wrap gap-1">
          <Link href={f.href} className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs"><Icon name="external" size={14} /> فتح المشروع</Link>
          {f.downloadUrl && <a href={f.downloadUrl} className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs" download><Icon name="download" size={14} /> تنزيل</a>}
        </div>
      </div>
    </article>
  );
}

function Viewer({ job, index, onIndex }: { job: JobView; index: number; onIndex: (i: number) => void }) {
  const o = job.outputs[index];
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && index < job.outputs.length - 1) onIndex(index + 1);
      if (e.key === "ArrowRight" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index, job.outputs.length, onIndex]);
  if (!o) return null;
  return (
    <div className="space-y-3 p-3">
      <div className="grid max-h-[75dvh] place-items-center overflow-hidden rounded-lg bg-black">
        {o.kind === "image" && o.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={o.url} alt="" className="max-h-[75dvh] object-contain" />
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          <button type="button" className="jw-btn jw-btn-icon" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label="السابقة"><Icon name="chevronRight" /></button>
          <button type="button" className="jw-btn jw-btn-icon" disabled={index >= job.outputs.length - 1} onClick={() => onIndex(index + 1)} aria-label="التالية"><Icon name="chevronLeft" /></button>
        </div>
        <span className="text-xs text-jw-muted" dir="ltr">{o.width && o.height ? `${o.width}×${o.height}` : ""}</span>
        <a href={o.downloadUrl} className="jw-btn jw-btn-primary" download><Icon name="download" size={16} /> تنزيل</a>
      </div>
    </div>
  );
}
