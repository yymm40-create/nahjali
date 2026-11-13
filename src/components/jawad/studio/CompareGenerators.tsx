"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { coinStr } from "@config/coins";
import { CREDITS } from "@config/credits";
import { generatorById } from "@config/jawad/generators";
import type { OutputKind, RefStyle, Settings } from "@config/jawad/types";
import Riyal from "@/components/Riyal";
import { evaluate } from "@/lib/jawad/engine";
import { COMPARE_MAX, COMPARE_MIN, comparePlan, compareRequest, type CompareQuote } from "@/lib/jawad/compare";
import { isOpenStatus, stageLabel, type JobView, type WorkItem } from "@/lib/jawad/labels";
import { track } from "@/lib/feature-track";
import { announceBalance } from "../CoinBalance";
import Dialog from "../Dialog";
import Icon from "../Icon";
import { refMeta, type RefItem, type StudioGenerator } from "./types";

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** One generator's run: its own click key (a retry never makes a second job), price, and job once made. */
interface Run {
  id: string;
  name: string;
  key: string;
  coins: number;
  job: JobView | null;
  error: string | null;
  /** the server's new price, when it changed since the quote (asked again) */
  newCoins: number | null;
  busy: boolean;
}

export interface CompareProps {
  kind: OutputKind;
  generators: StudioGenerator[];
  currentId: string;
  prices: Record<string, Record<string, number | null>>;
  owner: boolean;
  atCost: boolean;
  balance: number | null;
  /** why nothing can run now (signed out, uploads still going…), or null */
  blockedReason: string | null;
  prompt: string;
  instructions: string;
  /** the settings of the chosen generator as they would be sent, and each generator's own saved ones */
  settings: Settings;
  saved: Record<string, Settings>;
  refStyle: RefStyle;
  refs: RefItem[];
  styleId: string;
  /** the person's Claude model (sent like every generation) */
  model: string;
  /** more prompts are written («برومبت ثاني وثالث»): the comparison takes the first one only */
  hasExtra: boolean;
  /** the works list, to show the runs' latest state without asking twice */
  items: WorkItem[];
  onJobs: (jobs: JobView[]) => void;
  /** «كمّل بهذا»: the winner becomes the chosen generator */
  onPick: (generatorId: string) => void;
}

/**
 * «قارن المولّدات»: the same prompt on 2–4 generators of the current kind at once. Each one's price and the total are
 * shown before confirming; each run is a normal job (charged, refunded on failure, listed in «أعمالي»); the results
 * stand side by side with the generator's name, and one tap carries on with the winner.
 */
export default function CompareGenerators(p: CompareProps) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [polled, setPolled] = useState<Record<string, JobView>>({});

  const gens = useMemo(() => p.generators.filter((g) => generatorById(g.id)?.output === p.kind && (g.live || p.owner)), [p.generators, p.kind, p.owner]);
  const { prompt, instructions, settings, saved, refStyle, refs, prices, atCost } = p;

  // each generator's price for this very request (the same rules and price table as the generate button)
  const quotes = useMemo<CompareQuote[]>(() => {
    if (!open) return [];
    return gens.map((g) => {
      const def = generatorById(g.id)!;
      const req = compareRequest(def, { settings, saved: saved[g.id], refStyle, refs });
      const ev = evaluate(def, { settings: req.settings, prompt, instructions: def.extraText ? instructions : "", refStyle: req.refStyle, refs: req.refs.map(refMeta), atCost }, prices[g.id] ?? {});
      const reason = ev.issues[0]?.message ?? (ev.price.ok ? null : ev.price.reason);
      return { id: g.id, name: g.name, output: def.output, coins: !reason && ev.price.ok ? ev.price.coins : null, reason };
    });
  }, [open, gens, settings, saved, refStyle, refs, prompt, instructions, prices, atCost]);

  const picks = quotes.filter((q) => picked.includes(q.id));
  const plan = comparePlan(p.kind, picks);
  const short = plan.ok && !p.owner && p.balance != null && p.balance < plan.total;

  const openIt = () => {
    // the chosen generator ticked to start with
    if (!runs && !picked.length) setPicked([p.currentId]);
    setOpen(true);
  };
  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= COMPARE_MAX ? cur : [...cur, id]));

  /** Starts (or retries) one generator's job; returns it when made. */
  async function start(run: Run, expected: number): Promise<JobView | null> {
    const g = gens.find((x) => x.id === run.id);
    const def = generatorById(run.id);
    if (!g || !def) return null;
    const req = compareRequest(def, { settings, saved: saved[g.id], refStyle, refs });
    setRuns((cur) => cur && cur.map((r) => (r.id === run.id ? { ...r, busy: true, error: null, newCoins: null } : r)));
    try {
      const res = await fetch("/api/jawad/generate", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: run.key,
          sectionId: g.sectionId,
          generatorId: g.id,
          refStyle: req.refStyle,
          settings: req.settings,
          prompt,
          instructions: def.extraText ? instructions : "",
          refs: req.refs.filter((r) => r.uploadId).map((r) => ({ uploadId: r.uploadId, role: r.role, name: r.name })),
          expectedCoins: expected,
          model: p.model,
          ...(def.output !== "audio" && p.styleId ? { styleId: p.styleId } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { job?: JobView; balance?: number | null; code?: string; coins?: number; error?: string };
      if (res.ok && body.job) {
        announceBalance(body.balance ?? null);
        setRuns((cur) => cur && cur.map((r) => (r.id === run.id ? { ...r, busy: false, coins: expected, job: body.job! } : r)));
        return body.job;
      }
      const changed = res.status === 409 && body.code === "price_changed" && typeof body.coins === "number" ? body.coins : null;
      setRuns((cur) => cur && cur.map((r) => (r.id === run.id ? { ...r, busy: false, newCoins: changed, error: changed != null ? `تغيّر سعره إلى ${coinStr(changed)}. ما انخصم شي.` : body.error ?? "تعذّر بدء التوليد." } : r)));
    } catch {
      setRuns((cur) => cur && cur.map((r) => (r.id === run.id ? { ...r, busy: false, error: "انقطع الاتصال. أعد المحاولة (ما بيتكرر الخصم)." } : r)));
    }
    return null;
  }

  async function runAll() {
    if (!plan.ok || p.blockedReason || short) return;
    track("studio.compare_run");
    const list: Run[] = plan.items.map((q) => ({ id: q.id, name: q.name, key: uid(), coins: q.coins!, job: null, error: null, newCoins: null, busy: true }));
    setRuns(list);
    setPolled({});
    const made = (await Promise.all(list.map((r) => start(r, r.coins)))).filter((j): j is JobView => Boolean(j));
    if (made.length) p.onJobs(made);
  }

  async function retry(r: Run) {
    const j = await start(r, r.newCoins ?? r.coins);
    if (j) p.onJobs([j]);
  }

  // the freshest state of each run's job: the works list when it holds it, else this dialog asks the server itself
  const live = (j: JobView | null): JobView | null => {
    if (!j) return null;
    const inList = p.items.find((it) => it.type === "job" && it.id === j.id) as JobView | undefined;
    return inList ?? polled[j.id] ?? j;
  };
  const waiting = (runs ?? []).flatMap((r) => {
    const j = live(r.job);
    return j && isOpenStatus(j.status) && !p.items.some((it) => it.id === j.id) ? [j.id] : [];
  });
  const waitKey = open ? waiting.join(",") : "";
  useEffect(() => {
    if (!waitKey) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/jawad/jobs?ids=${waitKey}`, { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as { jobs?: JobView[] };
        if (!stop && res.ok && body.jobs) setPolled((cur) => ({ ...cur, ...Object.fromEntries(body.jobs!.map((j) => [j.id, j])) }));
      } catch {
        // offline: the next tick tries again
      }
    };
    const t = setInterval(tick, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [waitKey]);

  if (gens.length < COMPARE_MIN) return null;
  const label = p.kind === "image" ? "الصور" : p.kind === "video" ? "الفيديو" : "الصوت";

  return (
    <>
      <button type="button" className="jw-btn jw-btn-quiet !min-h-9 w-full gap-1.5 text-xs" onClick={openIt} aria-haspopup="dialog">
        <Icon name="compare" size={14} /> {runs ? "نتيجة المقارنة" : "قارن المولّدات: نفس البرومبت على أكثر من مولّد"}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="قارن المولّدات" wide={Boolean(runs)}>
        {open && !runs && (
          <div className="space-y-3 p-4">
            <p className="text-sm text-jw-muted">
              نفس البرومبت والمراجع والإعدادات على {COMPARE_MIN} إلى {COMPARE_MAX} مولّدات {label} مع بعض. كل واحد توليد عادي بسعره، ينخصم لما يبدأ ويرجع لك لو فشل، ويوصل «أعمالي».
            </p>
            {p.hasExtra && <p className="text-xs text-jw-warn">المقارنة تاخذ البرومبت الأول بس.</p>}
            {!prompt.trim() && <p className="text-xs text-jw-warn">اكتب البرومبت أول، بعدين قارن.</p>}
            <ul className="space-y-1.5">
              {quotes.map((q) => {
                const on = picked.includes(q.id);
                const full = !on && picked.length >= COMPARE_MAX;
                return (
                  <li key={q.id}>
                    <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${on ? "border-jw-accent bg-jw-accent-soft" : "border-jw-line hover:border-jw-line-strong"} ${full ? "opacity-60" : ""}`}>
                      <input type="checkbox" className="size-4 accent-[var(--jw-accent)]" checked={on} disabled={full} onChange={() => toggle(q.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold" dir="ltr" style={{ textAlign: "right" }}>{q.name}</span>
                        {q.reason && <span className="block text-[11px] text-jw-warn">{q.reason}</span>}
                      </span>
                      {q.coins != null ? <Riyal halalas={q.coins} size={13} className="text-sm" /> : <span className="text-xs text-jw-faint">—</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-jw-line pt-3">
              <span className="text-sm">
                {picks.length} من {COMPARE_MAX} · المجموع: {plan.ok ? <b><Riyal halalas={plan.total} size={14} /></b> : "—"}
              </span>
              {short ? (
                <Link href={`${CREDITS.base}?pack=try`} className="jw-btn jw-btn-primary">اشحن وكمّل ←</Link>
              ) : (
                <button type="button" className="jw-btn jw-btn-primary" disabled={!plan.ok || Boolean(p.blockedReason) || !prompt.trim()} onClick={() => void runAll()}>
                  <Icon name="sparkles" size={16} /> شغّلها كلها {plan.ok && <Riyal halalas={plan.total} size={14} />}
                </button>
              )}
            </div>
            <p className="text-xs text-jw-muted" aria-live="polite">
              {p.blockedReason ?? (!plan.ok && picks.length ? plan.error : short ? `رصيدك (${coinStr(p.balance ?? 0)}) ما يكفي للمجموع (${coinStr(plan.ok ? plan.total : 0)}).` : picks.length < COMPARE_MIN ? `اختر ${COMPARE_MIN} مولّدات على الأقل.` : "")}
            </p>
            {p.owner && <p className="text-[11px] text-jw-faint">كصاحب المنصة لا يُخصم منك؛ يُسجَّل السعر للمتابعة فقط.</p>}
          </div>
        )}
        {open && runs && (
          <div className="space-y-3 p-3 sm:p-4">
            <ul className={`grid gap-3 ${runs.length > 2 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2"}`}>
              {runs.map((r) => {
                const j = live(r.job);
                const out = j?.status === "succeeded" ? j.outputs[0] : undefined;
                return (
                  <li key={r.id} className="jw-panel flex flex-col overflow-hidden">
                    <div className="grid aspect-video place-items-center bg-jw-bg-2">
                      {out?.url && out.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={out.url} alt={`نتيجة ${r.name}`} className="size-full object-contain" />
                      ) : out?.url && out.kind === "video" ? (
                        <video src={`${out.url}#t=0.1`} controls preload="metadata" playsInline className="size-full bg-black object-contain" />
                      ) : out?.url && out.kind === "audio" ? (
                        <audio src={out.url} controls preload="metadata" className="w-[90%]" />
                      ) : r.busy || (j && isOpenStatus(j.status)) ? (
                        <span className="flex flex-col items-center gap-2 text-xs" role="status">
                          <span className="jw-spinner" /> {j ? stageLabel(j.status, j.providerStatus) : "يبدأ…"}
                        </span>
                      ) : (
                        <span className="flex flex-col items-center gap-1 px-3 text-center text-xs">
                          <Icon name="alert" size={18} className="text-jw-danger" />
                          {r.error ?? j?.error ?? (j ? stageLabel(j.status) : "")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold" dir="ltr">{r.name}</span>
                        <Riyal halalas={j?.priceCoins ?? r.coins} size={12} className="text-xs" />
                      </div>
                      {j && j.outputs.length > 1 && <span className="text-[11px] text-jw-faint">{j.outputs.length} نتائج، كلها في «أعمالي»</span>}
                      <div className="mt-auto flex flex-wrap gap-1">
                        {!j && !r.busy && (
                          <button type="button" className="jw-btn !min-h-8 !px-2 text-xs" onClick={() => void retry(r)} disabled={Boolean(p.blockedReason)}>
                            <Icon name="retry" size={14} /> {r.newCoins != null ? <>شغّله بـ <Riyal halalas={r.newCoins} size={12} /></> : "أعد المحاولة"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="jw-btn jw-btn-primary !min-h-8 !px-2 text-xs"
                          onClick={() => {
                            track("studio.compare_pick");
                            p.onPick(r.id);
                            setOpen(false);
                          }}
                        >
                          <Icon name="check" size={14} /> كمّل بهذا
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-jw-muted">{"كل نتيجة محفوظة في «أعمالي». «كمّل بهذا» يخلي مولّده هو المختار."}</p>
              <button
                type="button"
                className="jw-btn !min-h-8 text-xs"
                onClick={() => {
                  setRuns(null);
                  setPolled({});
                }}
              >
                <Icon name="compare" size={14} /> مقارنة جديدة
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
