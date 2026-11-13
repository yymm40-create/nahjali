// JAWAD AI — «قارن المولّدات»: the same prompt on 2 to 4 generators of one kind, each a normal job with its own price.
// Pure and shared (the studio and the tests): how a draft is carried to each generator, and the plan the person
// confirms (every price known, one kind, the total = the sum). The server checks every job again as usual.

import { fitSettings } from "@config/jawad/ready-apps";
import type { GeneratorDef, OutputKind, RefRole, RefStyle, Settings } from "@config/jawad/types";

export const COMPARE_MIN = 2;
export const COMPARE_MAX = 4;

/** One generator ticked, with its price for this request (null: it can't run it now, `reason` says why). */
export interface CompareQuote {
  id: string;
  name: string;
  output: OutputKind;
  coins: number | null;
  reason: string | null;
}

export type ComparePlan = { ok: true; items: CompareQuote[]; total: number } | { ok: false; error: string };

const KIND_AR: Record<OutputKind, string> = { image: "صور", video: "فيديو", audio: "صوت" };

/**
 * The plan to confirm: 2–4 different generators, all of the kind being made, each with its price. The total shown before
 * confirming is the sum of the prices each one will be charged (the same prices the generate button shows).
 */
export function comparePlan(kind: OutputKind, picks: CompareQuote[]): ComparePlan {
  const ids = new Set(picks.map((p) => p.id));
  if (ids.size !== picks.length) return { ok: false, error: "كل مولّد مرة وحدة بس." };
  if (picks.length < COMPARE_MIN) return { ok: false, error: `اختر ${COMPARE_MIN} مولّدات على الأقل.` };
  if (picks.length > COMPARE_MAX) return { ok: false, error: `أكثر شي ${COMPARE_MAX} مولّدات في المقارنة الوحدة.` };
  const other = picks.find((p) => p.output !== kind);
  if (other) return { ok: false, error: `المقارنة بين مولّدات ${KIND_AR[kind]} بس؛ «${other.name}» مولّد ${KIND_AR[other.output]}.` };
  const blocked = picks.find((p) => p.coins == null);
  if (blocked) return { ok: false, error: `«${blocked.name}»: ${blocked.reason ?? "ما يقدر يسوي هالطلب الحين."}` };
  return { ok: true, items: picks, total: picks.reduce((t, p) => t + (p.coins ?? 0), 0) };
}

/**
 * The draft as one generator takes it: the person's settings carried over where this generator has them (shape,
 * duration, resolution, sound… else its own defaults), the same way of using the references when it has it (else its
 * first one), and the references' roles fitted to that way (first/last frame only with frames).
 */
export function compareRequest<R extends { kind: string; role: RefRole }>(def: GeneratorDef, d: { settings: Settings; saved?: Settings; refStyle: RefStyle; refs: R[] }): { settings: Settings; refStyle: RefStyle; refs: R[] } {
  const settings = fitSettings(def, { ...(d.saved ?? {}), ...d.settings });
  const styles = def.modes.map((m) => m.refStyle);
  const refStyle: RefStyle = styles.includes(d.refStyle) ? d.refStyle : d.refs.length ? styles.find((s) => s !== "none") ?? "none" : "none";
  let first = false;
  let last = false;
  const refs = d.refs.map((r) => {
    if (refStyle !== "frames" || r.kind !== "image") return r.role === "reference" ? r : { ...r, role: "reference" as RefRole };
    if (r.role === "first_frame" && !first) return (first = true), r;
    if (r.role === "last_frame" && !last) return (last = true), r;
    if (!first) return (first = true), { ...r, role: "first_frame" as RefRole };
    if (!last) return (last = true), { ...r, role: "last_frame" as RefRole };
    return { ...r, role: "reference" as RefRole };
  });
  return { settings, refStyle, refs };
}
