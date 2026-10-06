"use client";

// «التعديل الذكي» inside «الممنتج الذكي»: cut the pieces that didn't work, lift each one straight up onto the red
// track (same place), write what to fix in each and pick «جزئي» or «كامل»; what JAWAD AI makes comes back on the green
// track over it, at the same place and length. Then the edit goes on as usual (arrange, export).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generatorById } from "@config/jawad/generators";
import { postJson } from "@/lib/fetch";
import { clipLength, findClip, FIX_NOTE_MAX, formatTime, type Clip, type Fix, type Timeline as TL } from "@/lib/editor/model";
import { EDIT_LIMITS, frameTimes, type EditRange } from "@/lib/jawad/smart-edit";
import { fixCut, fixedOffset, pieceRange } from "@/lib/editor/smart-fix";
import { stageLabel, type JobView, type OutputView } from "@/lib/jawad/labels";
import Dialog from "../Dialog";
import Icon from "../Icon";
import { grabFrames } from "../studio/frames";
import type { Run } from "./Inspector";
import type { PlayerLike } from "./Timeline";
import type { EditorAsset } from "./types";

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const POLL_MS = 10_000;
const STATE: Record<Fix["state"], { text: string; cls: string }> = {
  draft: { text: "ينتظر ملاحظتك", cls: "bg-jw-bg-2 text-jw-muted" },
  making: { text: "يُصنع الآن…", cls: "bg-amber-500/15 text-amber-600" },
  done: { text: "جاهز على الأخضر ✓", cls: "bg-emerald-500/15 text-emerald-600" },
  failed: { text: "ما نجح؛ أعد المحاولة", cls: "bg-red-500/15 text-red-600" },
};

type Quote = { coins: number; from: number | null } | { error: string };

interface Props {
  projectId: string;
  tl: TL;
  assets: Map<string, EditorAsset>;
  selected: string[];
  run: Run;
  player: PlayerLike | null;
  onAssets: (list: EditorAsset[]) => void;
  flash: (text: string, bad?: boolean) => void;
  readOnly: boolean;
  /** the videos page (where the edits being made are listed too) */
  studioPath: string | null;
}

export default function SmartFix({ projectId, tl, assets, selected, run, player, onAssets, flash, readOnly, studioPath }: Props) {
  const red = tl.tracks.find((t) => t.role === "fix") ?? null;
  const pieces = useMemo(() => red?.clips ?? [], [red]);
  const [open, setOpen] = useState(false);

  const sel = selected.length === 1 ? findClip(tl, selected[0]) : null;
  const selAsset = sel?.clip.assetId ? assets.get(sel.clip.assetId) : undefined;
  const canLift = !!sel && sel.track.kind === "video" && sel.track.role !== "fix" && selAsset?.kind === "video";
  // a video made in «الجواد الذكي!» can be fixed here even in an edit that didn't start from «التعديل الذكي»
  const fromJawad = !!selAsset?.jobId;

  // ---------- what is being made: asked about every few seconds, laid on the green track when ready ----------
  const making = pieces.filter((c) => c.fix?.state === "making" && c.fix.job);
  const makingKey = making.map((c) => `${c.id}:${c.fix!.job}`).join(",");
  const placing = useRef(new Set<string>());
  // where each job is (in the queue, generating, saving…), from the last check
  const [stages, setStages] = useState<Record<string, string>>({});
  const tlRef = useRef(tl);
  useEffect(() => {
    tlRef.current = tl;
  }, [tl]);
  const check = useCallback(async () => {
    const now = (tlRef.current.tracks.find((t) => t.role === "fix")?.clips ?? []).filter((c) => c.fix?.state === "making" && c.fix.job);
    if (!now.length) return;
    const ids = [...new Set(now.map((c) => c.fix!.job!))];
    const r = await fetch(`/api/jawad/jobs?ids=${ids.join(",")}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    const jobs = (r?.jobs ?? []) as JobView[];
    setStages((x) => ({ ...x, ...Object.fromEntries(jobs.map((j) => [j.id, stageLabel(j.status, j.providerStatus)])) }));
    for (const c of now) {
      const j = jobs.find((x) => x.id === c.fix!.job);
      if (!j || placing.current.has(j.id)) continue;
      if (j.status === "failed" || j.status === "cancelled") {
        run({ type: "update_clip", clipId: c.id, patch: { fix: { state: "failed" } } }, { label: "ما نجح التعديل" });
        flash(j.error ? `ما نجح تعديل جزء: ${j.error}` : "ما نجح تعديل جزء؛ النقاط ترجع لك.", true);
        continue;
      }
      const out = j.status === "succeeded" ? j.outputs.find((o) => o.kind === "video") : undefined;
      if (!out) continue;
      placing.current.add(j.id);
      try {
        const res = await postJson<{ assets: EditorAsset[] }>(`/api/jawad/editor/projects/${projectId}`, {
          action: "import",
          items: [{ source: "jawad", id: out.id, durationMs: out.durationMs, width: out.width, height: out.height, name: `المعدّل · ${formatTime(c.start)}` }],
        });
        const a = res.assets[0];
        if (!a) throw new Error("import");
        onAssets(res.assets);
        // the asset must be known to the timeline before the clip is laid on it
        await new Promise((ok) => setTimeout(ok, 0));
        const offset = fixedOffset(c, { start: (c.fix!.from ?? 0) / 1000 });
        if (run({ type: "place_fixed", clipId: c.id, assetId: a.id, offset })) flash("وصل تعديل جزء؛ تلقاه على المسار الأخضر ✓");
      } catch {
        placing.current.delete(j.id);
      }
    }
  }, [projectId, run, onAssets, flash]);
  useEffect(() => {
    if (!makingKey || readOnly) return;
    const first = setTimeout(check, 1500);
    const t = setInterval(check, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [makingKey, check, readOnly]);

  if (readOnly || (!red && !(fromJawad && canLift))) return null;

  const lift = () => sel && run({ type: "lift_fix", clipId: sel.clip.id });
  const cut = () => {
    if (!sel || !player) return;
    run({ type: "split", at: Math.round(player.ms), clipIds: [sel.clip.id] });
  };
  const counts = { all: pieces.length, making: making.length, done: pieces.filter((c) => c.fix?.state === "done").length };

  return (
    <>
      <div className="mx-2 mb-1 flex flex-wrap items-center gap-2 rounded-xl border border-red-500/30 bg-gradient-to-l from-red-500/10 via-transparent to-emerald-500/10 px-3 py-1.5 text-xs">
        <span className="flex items-center gap-1 font-bold">
          <Icon name="wand" size={14} /> التعديل الذكي
        </span>
        <span className="text-jw-muted">
          {red && !pieces.length ? "قص الجزء اللي ما عجبك ✂ ثم ارفعه ⬆ للمسار الأحمر — يبقى بنفس مكانه." : `${counts.all} على الأحمر${counts.making ? ` · ${counts.making} يُصنع` : ""}${counts.done ? ` · ${counts.done} على الأخضر` : ""}`}
        </span>
        <span className="flex-1" />
        {canLift && (
          <>
            <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs" onClick={cut} title="قص المقطع المحدد عند مؤشر الوقت">
              <Icon name="scissors" size={14} /> قص هنا
            </button>
            <button type="button" className="jw-btn !min-h-8 !border-red-500/60 !px-2 text-xs text-red-600" onClick={lift} title="يرفعه للمسار الأحمر بدون ما يتحرك يمين أو يسار">
              <Icon name="chevronUp" size={14} /> ارفع للأحمر
            </button>
          </>
        )}
        {pieces.length > 0 && (
          <button type="button" className="jw-btn !min-h-8 !px-3 text-xs !border-jw-accent/50 text-jw-accent" onClick={() => setOpen(true)}>
            <Icon name="type" size={14} /> اكتب التعديلات وأرسلها
          </button>
        )}
      </div>
      {making.length > 0 && (
        <div className="mx-2 mb-1 flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-400/10 px-3 py-1.5 text-xs" aria-live="polite">
          <span className="jw-spinner" />
          {making.map((c) => (
            <button key={c.id} type="button" className="rounded-full bg-amber-400/25 px-2 py-0.5 font-semibold hover:bg-amber-400/40" onClick={() => player?.seek(c.start)} title="روح للجزء">
              ⏳ {formatTime(c.start)}: {stages[c.fix!.job!] ?? "أُرسل، ينتظر دوره…"}
            </button>
          ))}
          <span className="text-jw-muted">نتابعه كل ١٠ ثواني، ويوصل للأخضر بنفسه.</span>
          <span className="flex-1" />
          {studioPath && (
            <a className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs" href={`${studioPath}#job-${making[0].fix!.job}`} target="_blank" rel="noreferrer">
              <Icon name="frames" size={14} /> تابعه في صفحة الفيديوهات
            </a>
          )}
        </div>
      )}
      {open && <FixDialog projectId={projectId} pieces={pieces} assets={assets} run={run} player={player} onAssets={onAssets} onClose={() => setOpen(false)} />}
    </>
  );
}

type Plan = { ok: false; why: string } | { ok: true; job: JobView; out: OutputView; mode: "parts" | "whole"; cut: { start: number; end: number; seconds: number }; videoSec: number; ranges: EditRange[] };

/** What a piece needs to be sent: its original job and result, and the part to make (or why it can't). */
function planOf(c: Clip, a: EditorAsset | undefined, j: JobView | undefined): Plan {
  if (!a?.jobId || !a.outputId) return { ok: false, why: "هذا الجزء مو من فيديو صنعته في «الجواد الذكي!» أو صانع الفيلم؛ ما يقدر يتعاد." };
  if (!j) return { ok: false, why: "ما قدرنا نقرأ الفيديو الأصلي؛ جرّب مرة ثانية." };
  const out = j.outputs.find((o) => o.id === a.outputId) ?? j.outputs.find((o) => o.kind === "video");
  if (!out?.url) return { ok: false, why: "الفيديو الأصلي ما عاد موجود." };
  const def = generatorById(j.generatorId);
  const dur = def?.options.find((o) => o.key === "duration" && o.kind === "int") as { min?: number; max?: number } | undefined;
  const videoSec = (out.durationMs ?? a.durationMs ?? 0) / 1000;
  const mode = c.fix?.mode ?? "parts";
  const cut = fixCut(c, mode, videoSec, dur?.min ?? 4, dur?.max ?? 15);
  if (!cut) return { ok: false, why: mode === "parts" ? `الجزء أطول من أطول مقطع يولّده ${def?.name ?? "المولد"} (${dur?.max ?? 15} ث)، أو الفيديو أقصر من ${dur?.min ?? 4} ث؛ اختر «كامل» أو قصّ الجزء أصغر.` : "تعذّر." };
  const r = pieceRange(c);
  return { ok: true, job: j, out, mode, cut, videoSec, ranges: [{ from: r.from, to: Math.min(r.to, videoSec), note: "" }] };
}

const loadJobs = async (ids: string[]) => {
  if (!ids.length) return [] as JobView[];
  const r = await fetch(`/api/jawad/jobs?ids=${ids.join(",")}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
  return (r?.jobs ?? []) as JobView[];
};
const askPrice = async (p: Extract<Plan, { ok: true }>): Promise<Quote> => {
  const body = { jobId: p.job.id, outputId: p.out.id, mode: p.mode, notes: "", ranges: p.ranges, quote: true };
  const res = await fetch("/api/jawad/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const r = res ? await res.json().catch(() => ({})) : {};
  if (!res) return { error: "ما وصلنا للخادم؛ تأكد من النت وجرّب مرة ثانية." };
  return res.ok ? { coins: r.coins, from: r.cut ? Math.round(r.cut.start * 1000) : p.mode === "whole" ? 0 : null } : { error: r.error ?? `تعذّر حساب السعر (${res.status}).` };
};

/** Every red piece: what to fix, «جزئي» or «كامل», its price; then one tap sends them all. */
function FixDialog({ projectId, pieces, assets, run, player, onAssets, onClose }: { projectId: string; pieces: Clip[]; assets: Map<string, EditorAsset>; run: Run; player: PlayerLike | null; onAssets: (list: EditorAsset[]) => void; onClose: () => void }) {
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(pieces.map((c) => [c.id, c.fix?.note ?? ""])));
  const [jobs, setJobs] = useState<Record<string, JobView>>({});
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const keys = useRef<Record<string, string>>({});
  const assetOf = (c: Clip) => (c.assetId ? assets.get(c.assetId) : undefined);

  // film videos get their JAWAD AI job first (once), then every original is read
  const jobIds = [...new Set(pieces.flatMap((c) => (assetOf(c)?.jobId ? [assetOf(c)!.jobId!] : [])))];
  const jobKey = jobIds.join(",");
  const unlinked = [...new Set(pieces.flatMap((c) => (c.assetId && assetOf(c)?.origin === "film" && !assetOf(c)?.jobId ? [c.assetId] : [])))];
  const unlinkedKey = unlinked.join(",");
  useEffect(() => {
    if (!unlinkedKey) return;
    let live = true;
    (async () => {
      for (const id of unlinkedKey.split(",")) {
        try {
          const r = await postJson<{ asset: EditorAsset }>(`/api/jawad/editor/projects/${projectId}`, { action: "fix_link", assetId: id });
          if (live) onAssets([r.asset]);
        } catch (e) {
          if (live) setErrors((x) => ({ ...x, ...Object.fromEntries(pieces.filter((c) => c.assetId === id).map((c) => [c.id, e instanceof Error ? e.message : "تعذّر تجهيز الفيديو."])) }));
        }
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlinkedKey]);
  useEffect(() => {
    if (!jobKey) return;
    let live = true;
    loadJobs(jobKey.split(",")).then((list) => live && setJobs((x) => ({ ...x, ...Object.fromEntries(list.map((j) => [j.id, j])) })));
    return () => {
      live = false;
    };
  }, [jobKey]);

  // ---------- prices (again when a piece's kind or length changes) ----------
  const open = pieces.filter((c) => c.fix && (c.fix.state === "draft" || c.fix.state === "failed"));
  const quoteKey = open.map((c) => `${c.id}:${c.fix!.mode}:${c.in}:${c.out}:${assetOf(c)?.jobId ?? ""}`).join("|") + `#${Object.keys(jobs).length}`;
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      for (const c of open) {
        const a = assetOf(c);
        if (!a?.jobId && a?.origin === "film") continue; // being linked
        if (a?.jobId && !jobs[a.jobId]) continue; // being read
        const p = planOf(c, a, a?.jobId ? jobs[a.jobId] : undefined);
        const q: Quote = p.ok ? await askPrice(p) : { error: p.why };
        if (!live) return;
        setQuotes((x) => ({ ...x, [c.id]: q }));
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const saveNote = (c: Clip) => {
    const note = (notes[c.id] ?? "").slice(0, FIX_NOTE_MAX);
    if (note !== c.fix?.note) run({ type: "update_clip", clipId: c.id, patch: { fix: { note } } }, { coalesce: `fix-note-${c.id}` });
  };
  const written = open.filter((c) => (notes[c.id] ?? "").trim().length >= 3);
  const priced = written.filter((c) => "coins" in (quotes[c.id] ?? {}));
  const total = priced.reduce((s, c) => s + (quotes[c.id] as { coins: number }).coins, 0);

  /** Sends one piece: everything it needs is (re)checked right now, so a slow price never blocks the button. */
  async function sendOne(c: Clip): Promise<string | null> {
    const note = (notes[c.id] ?? "").trim();
    let a = assetOf(c);
    if (a && !a.jobId && a.origin === "film") {
      setBusy("يجهّز فيديو الفيلم للتعديل…");
      try {
        a = (await postJson<{ asset: EditorAsset }>(`/api/jawad/editor/projects/${projectId}`, { action: "fix_link", assetId: a.id })).asset;
        onAssets([a]);
      } catch (e) {
        return e instanceof Error ? e.message : "تعذّر تجهيز الفيديو.";
      }
    }
    let j = a?.jobId ? jobs[a.jobId] : undefined;
    if (a?.jobId && !j) {
      j = (await loadJobs([a.jobId]))[0];
      if (j) setJobs((x) => ({ ...x, [j!.id]: j! }));
    }
    const p = planOf(c, a, j);
    if (!p.ok) return p.why;
    let q = quotes[c.id];
    if (!q || !("coins" in q)) {
      q = await askPrice(p);
      setQuotes((x) => ({ ...x, [c.id]: q! }));
      if (!("coins" in q)) return q.error;
    }
    const ranges = p.ranges.map((r) => ({ ...r, note: note.slice(0, EDIT_LIMITS.noteMax) }));
    const partCut = p.mode === "parts" ? p.cut : null;
    keys.current[c.id] ??= uid();
    const send: Record<string, unknown> = { jobId: p.job.id, outputId: p.out.id, mode: p.mode, notes: note, ranges, idempotencyKey: keys.current[c.id], expectedCoins: q.coins };
    try {
      const times = frameTimes(p.videoSec, ranges, partCut);
      const small = await grabFrames(p.out.url!, times, EDIT_LIMITS.frameWidth, 0.72);
      send.frames = times.map((t, i) => ({ t, data: small[i] }));
      if (partCut) {
        // the cut frames become the new clip's first and last frames: full quality, but kept under the request's size
        const [first, last] = await grabFrames(p.out.url!, [partCut.start, partCut.end], 1920, 0.9, { by: "side" });
        send.cutFrames = { first, last };
      }
    } catch {
      return "تعذّر قراءة لقطات الفيديو في المتصفح؛ جرّب مرة ثانية.";
    }
    const res = await fetch("/api/jawad/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(send) }).catch(() => null);
    const r = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && r.job?.id) {
      delete keys.current[c.id];
      run({ type: "update_clip", clipId: c.id, patch: { fix: { note, job: r.job.id, from: q.from ?? 0, state: "making" } } }, { label: "أرسلت جزءًا للتعديل" });
      return null;
    }
    if (res?.status === 409 && r.code === "price_changed") {
      setQuotes((x) => ({ ...x, [c.id]: { coins: r.coins, from: (q as { from: number | null }).from } }));
      return `تغيّر السعر إلى ${r.coins} نقدة؛ اضغط «اصنع» مرة ثانية للتأكيد.`;
    }
    if (res) delete keys.current[c.id];
    return r.error ?? (res ? `تعذّر الإرسال (${res.status}).` : "ما وصلنا للخادم؛ تأكد من النت وجرّب مرة ثانية (ما يتكرر الخصم).");
  }

  async function sendAll() {
    for (const c of open) saveNote(c);
    setErrors({});
    let sent = 0;
    const failed: Record<string, string> = {};
    for (const [i, c] of written.entries()) {
      setBusy(`يجهّز ويرسل الجزء ${i + 1} من ${written.length}…`);
      const why = await sendOne(c);
      if (why) failed[c.id] = why;
      else sent++;
    }
    setBusy(null);
    setErrors(failed);
    if (sent && !Object.keys(failed).length) onClose();
  }

  const failedList = Object.entries(errors);
  return (
    <Dialog open onClose={() => !busy && onClose()} title="التعديل الذكي · الأجزاء الحمراء" wide>
      <div className="space-y-3 p-4">
        <p className="text-xs text-jw-muted">
          اكتب لكل جزء شنو تبي يتعدل فيه، واختر <b>جزئي</b> (يتعاد هذا الجزء بس ويركب مكانه بقص نظيف) أو <b>كامل</b> (يتعاد الفيديو كله بالملاحظة). اللي ينصنع ينزل على <span className="font-bold text-emerald-600">المسار الأخضر</span> بنفس المكان.
        </p>
        <ol className="space-y-2">
          {pieces.map((c, i) => {
            const fix = c.fix ?? { note: "", mode: "parts" as const, job: null, from: null, state: "draft" as const };
            const q = quotes[c.id];
            const editable = fix.state === "draft" || fix.state === "failed";
            return (
              <li key={c.id} className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="grid size-6 place-items-center rounded-full bg-red-500 font-bold text-white">{i + 1}</span>
                  <span className="font-semibold" dir="ltr">
                    {formatTime(c.start)} → {formatTime(c.start + clipLength(c))}
                  </span>
                  <button type="button" className="jw-btn jw-btn-quiet !min-h-7 !px-2 text-[11px]" onClick={() => player?.seek(c.start)}>
                    <Icon name="play" size={12} /> روح له
                  </button>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATE[fix.state].cls}`}>{STATE[fix.state].text}</span>
                  <span className="flex-1" />
                  {editable && (
                    <div className="flex overflow-hidden rounded-lg border border-jw-line" role="radiogroup" aria-label="جزئي أو كامل">
                      {(["parts", "whole"] as const).map((m) => (
                        <button key={m} type="button" role="radio" aria-checked={fix.mode === m} className={`px-3 py-1 text-[11px] font-semibold ${fix.mode === m ? "bg-jw-accent text-white" : "text-jw-muted"}`} onClick={() => run({ type: "update_clip", clipId: c.id, patch: { fix: { mode: m } } })}>
                          {m === "parts" ? "جزئي" : "كامل"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {editable ? (
                  <textarea
                    className="jw-input min-h-16 w-full text-sm"
                    maxLength={FIX_NOTE_MAX}
                    placeholder="مثال: الشخص يلتفت فجأة ووجهه يتغير؛ خلّه يكمل المشي بهدوء ونفس الملامح"
                    value={notes[c.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
                    onBlur={() => saveNote(c)}
                  />
                ) : (
                  fix.note && <p className="text-xs text-jw-muted">«{fix.note}»</p>
                )}
                {editable && (!q ? <p className="text-[11px] text-jw-faint">يحسب السعر…</p> : "coins" in q ? <p className="text-[11px] text-jw-muted">السعر: {q.coins} نقدة</p> : <p className="text-xs font-semibold text-jw-danger">⚠ {q.error}</p>)}
                {errors[c.id] && <p className="rounded-lg bg-jw-danger/10 p-2 text-xs font-semibold text-jw-danger">✕ ما انرسل: {errors[c.id]}</p>}
              </li>
            );
          })}
        </ol>
        {failedList.length > 0 && !busy && (
          <p className="rounded-xl border border-jw-danger/40 bg-jw-danger/10 p-3 text-sm text-jw-danger" role="alert">
            ما انرسل {failedList.length === 1 ? "جزء" : `${failedList.length} أجزاء`} — السبب مكتوب تحت كل جزء. صلّحه واضغط «اصنع» مرة ثانية.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-jw-line pt-3">
          <button type="button" className="jw-btn jw-btn-primary" disabled={!!busy || !written.length} onClick={sendAll}>
            <Icon name="wand" size={16} /> {busy ?? (written.length ? `اصنع ${written.length} ${written.length === 1 ? "تعديل" : "تعديلات"}${priced.length === written.length ? ` · ${total} نقدة` : ""}` : "اكتب ملاحظة (٣ أحرف أو أكثر) لكل جزء")}
          </button>
          <span className="text-[11px] text-jw-faint">تقدر تكمل المونتاج وهو يصنع؛ كل جزء يوصل ينحط على الأخضر بنفسه، وتشوف حالته على الجزء الأحمر نفسه.</span>
        </div>
      </div>
    </Dialog>
  );
}
