"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { GeneratorDef, RefKind, RefRole, RefStyle } from "@config/jawad/types";
import type { Evaluation } from "@/lib/jawad/engine";
import Dialog from "../Dialog";
import Icon from "../Icon";
import type { RefItem } from "./types";

const KIND_AR: Record<RefKind, string> = { image: "صورة", video: "فيديو", audio: "صوت" };
const KIND_ICON: Record<RefKind, string> = { image: "image", video: "video", audio: "audio" };
const ACCEPT: Record<RefKind, string> = { image: "image/png,image/jpeg,image/webp", video: "video/mp4,video/quicktime", audio: "audio/mpeg,audio/wav,audio/x-wav" };
const ROLE_AR: Record<RefRole, string> = { first_frame: "الإطار الأول", last_frame: "الإطار الأخير", reference: "مرجع" };
const STYLE_AR: Record<RefStyle, string> = { none: "بدون", frames: "إطار أول / أخير", references: "مراجع متعددة" };

const sec = (ms: number | null) => (ms ? `${(ms / 1000).toFixed(1)} ث` : "");
const mb = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : `${Math.round(b / 1024)}KB`);

interface Props {
  def: GeneratorDef;
  ev: Evaluation;
  refStyle: RefStyle;
  onRefStyle: (s: RefStyle) => void;
  refs: RefItem[];
  canUpload: boolean;
  /** The owner gets a direct link to the prices page when a kind is off only for a missing price. */
  owner?: boolean;
  uploadBlockedReason: string | null;
  onAdd: (kind: RefKind, files: File[], role?: RefRole) => void;
  onRetry: (localId: string) => void;
  onRemove: (localId: string) => void;
  onRole: (localId: string, role: RefRole) => void;
}

function Thumb({ r, problem, big, onOpen, onRemove, onRetry }: { r: RefItem; problem?: string; big: boolean; onOpen: () => void; onRemove: () => void; onRetry: () => void }) {
  const size = big ? "size-28" : "size-[68px]";
  const bad = r.status === "rejected" || r.status === "error" || r.status === "missing" || Boolean(problem);
  return (
    <div className={`group relative ${size} shrink-0`}>
      <button
        type="button"
        onClick={onOpen}
        className={`relative block size-full overflow-hidden rounded-lg border bg-jw-bg-2 ${bad ? "border-jw-danger" : "border-jw-line-strong"}`}
        aria-label={`${KIND_AR[r.kind]}: ${r.fileName || "مرجع"}${problem ? ` — ${problem}` : ""}`}
        title={problem ?? r.error ?? r.fileName}
      >
        {r.url && r.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.url} alt="" className="size-full object-cover" />
        ) : r.url && r.kind === "video" ? (
          <video src={r.url} muted preload="metadata" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-jw-muted"><Icon name={KIND_ICON[r.kind]} size={big ? 26 : 20} /></span>
        )}
        {r.durationMs ? <span className="absolute bottom-1 start-1 rounded bg-black/70 px-1 text-[10px]" dir="ltr">{sec(r.durationMs)}</span> : null}
        {r.role !== "reference" && <span className="absolute inset-x-0 top-0 bg-black/70 px-1 text-center text-[10px]">{ROLE_AR[r.role]}</span>}
        {(r.status === "uploading" || r.status === "checking") && (
          <span className="absolute inset-0 grid place-items-center bg-black/55">
            {r.status === "uploading" ? (
              <span className="w-3/4">
                <span className="block h-1 overflow-hidden rounded bg-white/20">
                  <span className="block h-full bg-jw-accent" style={{ width: `${Math.round(r.progress * 100)}%` }} />
                </span>
                <span className="mt-1 block text-center text-[10px] tabular-nums" dir="ltr">{Math.round(r.progress * 100)}%</span>
              </span>
            ) : (
              <span className="jw-spinner" role="status" aria-label="يُفحص على الخادم" />
            )}
          </span>
        )}
        {bad && <span className="absolute inset-0 grid place-items-center bg-black/40 text-jw-danger"><Icon name="alert" size={18} /></span>}
      </button>
      <div className="absolute -end-1.5 -top-1.5 flex gap-1 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        {r.status === "error" && (
          <button type="button" onClick={onRetry} className="grid size-6 place-items-center rounded-full border border-jw-line-strong bg-jw-surface-3" aria-label="أعد المحاولة"><Icon name="retry" size={12} /></button>
        )}
        <button type="button" onClick={onRemove} className="grid size-6 place-items-center rounded-full border border-jw-line-strong bg-jw-surface-3" aria-label="احذف المرجع"><Icon name="x" size={12} /></button>
      </div>
    </div>
  );
}

/** The references rectangle under the generator card: starts compact, grows to show references clearly. */
export default function RefsStrip({ def, ev, refStyle, onRefStyle, refs, canUpload, owner = false, uploadBlockedReason, onAdd, onRetry, onRemove, onRole }: Props) {
  const [menu, setMenu] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<RefItem | null>(null);
  const [drag, setDrag] = useState(false);
  const [dropError, setDropError] = useState("");
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingRole = useRef<RefRole | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  if (!ev.refStyles.length) return null;

  const pick = (kind: RefKind, role?: RefRole) => {
    if (!canUpload) return;
    pendingRole.current = role;
    inputs.current[kind]?.click();
  };
  const kinds = (["image", "video", "audio"] as RefKind[]).filter((k) => def.files[k]);
  const frames = refStyle === "frames";
  const roleItem = (role: RefRole) => refs.find((r) => r.role === role);
  const problems = refs.flatMap((r) => (ev.refProblems[r.uploadId ?? r.localId] ? [{ r, msg: ev.refProblems[r.uploadId ?? r.localId] }] : []));
  const refIssues = ev.issues.filter((i) => i.field === "refs");

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    setDropError("");
    if (!canUpload) return setDropError(uploadBlockedReason ?? "");
    const files = [...e.dataTransfer.files];
    const { sniff } = await import("@/lib/jawad/media");
    for (const f of files) {
      const s = sniff(new Uint8Array(await f.slice(0, 64).arrayBuffer()));
      if (!s) {
        setDropError(`«${f.name}»: نوع غير مقبول.`);
        continue;
      }
      if (!ev.refKinds[s.kind].allowed) {
        setDropError(`«${f.name}»: ${ev.refKinds[s.kind].reason}`);
        continue;
      }
      onAdd(s.kind, [f], frames ? (roleItem("first_frame") ? "last_frame" : "first_frame") : undefined);
    }
  }

  return (
    <section aria-label="المراجع" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="jw-label mb-0">المراجع <span className="text-jw-faint">(اختياري)</span></span>
        {ev.refStyles.length > 1 && (
          <div className="jw-seg" role="radiogroup" aria-label="طريقة استخدام المراجع">
            {ev.refStyles.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={refStyle === s} onClick={() => onRefStyle(s)} className="!min-h-8 !px-2.5 !text-xs">
                {s === "frames" ? <Icon name="frames" size={14} /> : <Icon name="layers" size={14} />}
                {STYLE_AR[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`rounded-xl border border-dashed p-2.5 transition-colors ${drag ? "border-jw-accent bg-jw-accent-soft" : "border-jw-line-strong bg-jw-bg-2"}`}
      >
        {frames ? (
          <div className="grid grid-cols-2 gap-2.5">
            {(["first_frame", "last_frame"] as RefRole[]).map((role) => {
              const r = roleItem(role);
              return (
                <div key={role} className="space-y-1">
                  <span className="block text-[11px] text-jw-muted">{ROLE_AR[role]}{role === "first_frame" ? "" : " (اختياري)"}</span>
                  {r ? (
                    <Thumb r={r} big problem={ev.refProblems[r.uploadId ?? r.localId]} onOpen={() => setPreview(r)} onRemove={() => onRemove(r.localId)} onRetry={() => onRetry(r.localId)} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => pick("image", role)}
                      disabled={!canUpload || !ev.refKinds.image.allowed}
                      title={!canUpload ? uploadBlockedReason ?? "" : ev.refKinds.image.reason}
                      className="grid size-28 place-items-center rounded-lg border border-jw-line-strong bg-jw-surface text-jw-muted hover:text-jw-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex flex-col items-center gap-1 text-xs"><Icon name="plus" /> صورة</span>
                    </button>
                  )}
                </div>
              );
            })}
            {refs
              .filter((r) => r.role === "reference")
              .map((r) => (
                <Thumb key={r.localId} r={r} big={false} problem={ev.refProblems[r.uploadId ?? r.localId]} onOpen={() => setPreview(r)} onRemove={() => onRemove(r.localId)} onRetry={() => onRetry(r.localId)} />
              ))}
          </div>
        ) : (
          <div className={`flex items-center gap-2 ${expanded ? "flex-wrap" : "jw-scroll overflow-x-auto pb-1"}`}>
            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenu((m) => !m)}
                disabled={!canUpload}
                title={!canUpload ? uploadBlockedReason ?? "" : "أضف مرجعًا"}
                aria-haspopup="menu"
                aria-expanded={menu}
                className={`grid ${expanded ? "size-28" : "size-[68px]"} place-items-center rounded-lg border border-jw-line-strong bg-jw-surface text-jw-muted hover:text-jw-ink disabled:cursor-not-allowed disabled:opacity-50`}
                aria-label="أضف مرجعًا"
              >
                <Icon name="plus" size={22} />
              </button>
              {menu && (
                <div role="menu" className="jw-panel absolute start-0 top-full z-30 mt-1 w-64 p-1.5 shadow-2xl shadow-black/60">
                  {kinds.map((k) => {
                    const a = ev.refKinds[k];
                    return (
                      <div key={k}>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={!a.allowed}
                          onClick={() => {
                            setMenu(false);
                            pick(k);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm hover:bg-jw-surface-3 disabled:cursor-not-allowed disabled:text-jw-muted disabled:hover:bg-transparent"
                        >
                          <Icon name={KIND_ICON[k]} size={16} />
                          {KIND_AR[k]}
                        </button>
                        {/* Why it's off, readable, right under it (and, for the owner, where to fix it) */}
                        {!a.allowed && (
                          <p className="-mt-1 px-3 pb-2 ps-[38px] text-[11px] leading-relaxed text-jw-warn">
                            {a.reason}
                            {owner && a.needsPrice && (
                              <>
                                {" "}
                                <Link href="/jawad-ai/admin/prices" className="underline">حدد السعر</Link>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {refs.map((r) => (
              <Thumb key={r.localId} r={r} big={expanded} problem={ev.refProblems[r.uploadId ?? r.localId]} onOpen={() => setPreview(r)} onRemove={() => onRemove(r.localId)} onRetry={() => onRetry(r.localId)} />
            ))}
            {!refs.length && <span className="px-1 text-xs text-jw-faint">{canUpload ? `اسحب ملفًا هنا أو اضغط + (${kinds.map((k) => KIND_AR[k]).join("، ")})` : uploadBlockedReason}</span>}
          </div>
        )}
        {!frames && refs.length > 3 && (
          <button type="button" className="mt-1.5 flex items-center gap-1 text-[11px] text-jw-muted hover:text-jw-ink" onClick={() => setExpanded((x) => !x)}>
            <Icon name={expanded ? "chevronDown" : "expand"} size={12} /> {expanded ? "تصغير" : "توسيع"}
          </button>
        )}
      </div>

      {kinds.map((k) => (
        <input
          key={k}
          ref={(el) => {
            inputs.current[k] = el;
          }}
          type="file"
          accept={ACCEPT[k]}
          multiple={!frames}
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length) onAdd(k, files, pendingRole.current);
          }}
        />
      ))}

      {(dropError || problems.length > 0 || refIssues.length > 0) && (
        <ul className="space-y-1 text-xs text-jw-danger" role="alert">
          {dropError && <li>{dropError}</li>}
          {problems.map(({ r, msg }) => (
            <li key={r.localId}>«{r.fileName || KIND_AR[r.kind]}»: {r.error ?? msg}</li>
          ))}
          {refIssues.map((i) => (
            <li key={i.message}>{i.message}</li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.fileName || "مرجع"}>
        {preview && (
          <div className="space-y-3 p-4">
            <div className="grid max-h-[60dvh] place-items-center overflow-hidden rounded-lg bg-black">
              {preview.url && preview.kind === "image" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt="" className="max-h-[60dvh] object-contain" />
              )}
              {preview.url && preview.kind === "video" && <video src={preview.url} controls className="max-h-[60dvh]" />}
              {preview.url && preview.kind === "audio" && <audio src={preview.url} controls className="w-full p-4" />}
              {!preview.url && <span className="p-10 text-sm text-jw-muted">لا توجد معاينة بعد.</span>}
            </div>
            <p className="text-xs text-jw-muted" dir="ltr" style={{ textAlign: "right" }}>
              {[preview.mime, preview.width && preview.height ? `${preview.width}×${preview.height}` : "", sec(preview.durationMs), preview.fps ? `${preview.fps}fps` : "", preview.bytes ? mb(preview.bytes) : ""].filter(Boolean).join(" · ")}
            </p>
            {preview.error && <p className="error-box text-sm">{preview.error}</p>}
            {frames && preview.kind === "image" && (
              <div className="jw-seg" role="radiogroup" aria-label="دور الصورة">
                {(["first_frame", "last_frame"] as RefRole[]).map((role) => (
                  <button key={role} type="button" role="radio" aria-checked={preview.role === role} onClick={() => (onRole(preview.localId, role), setPreview({ ...preview, role }))}>
                    {ROLE_AR[role]}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button type="button" className="jw-btn" onClick={() => (onRemove(preview.localId), setPreview(null))}><Icon name="trash" size={16} /> حذف المرجع</button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
