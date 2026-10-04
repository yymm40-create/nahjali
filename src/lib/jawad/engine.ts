// «الجواد الذكي!» | JAWAD AI — judges one generation request against the central registry (config/jawad).
// Pure and shared: the studio runs it on every change to show options, problems and the price, and the server runs
// the very same function on the stored files and the current prices before anything is charged.

import type {
  GeneratorDef,
  Issue,
  ModeDef,
  OptionState,
  PriceResult,
  RefKind,
  RefMeta,
  RefStyle,
  Settings,
} from "@config/jawad/types";

export interface EvalInput {
  settings: Settings;
  prompt: string;
  instructions: string;
  refStyle: RefStyle;
  refs: RefMeta[];
  /** Server: a sent value the generator does not support is refused (the studio instead falls back to the default). */
  strict?: boolean;
}

export interface Evaluation {
  mode: ModeDef;
  options: OptionState[];
  /** Settings as they would be sent (defaults, fixed values and clamps applied). */
  settings: Settings;
  issues: Issue[];
  notes: string[];
  /** Why a reference cannot be sent, by reference id. */
  refProblems: Record<string, string>;
  /** Whether "+" may add each kind now, and why not. */
  /** What "+" may add now; `needsPrice`: off only because the owner's price for it is missing. */
  refKinds: Record<RefKind, { allowed: boolean; reason?: string; needsPrice?: boolean }>;
  /** Reference styles this generator offers (besides none). */
  refStyles: RefStyle[];
  price: PriceResult;
}

const KIND_AR: Record<RefKind, string> = { image: "صورة", video: "فيديو", audio: "صوت" };
const KIND_AR_PL: Record<RefKind, string> = { image: "الصور", video: "الفيديو", audio: "الصوت" };
const fmtMb = (b: number) => `${Math.round(b / (1024 * 1024))}MB`;
const fmtSec = (ms: number) => `${Math.round(ms / 100) / 10} ث`;

/** Problems of one stored file against the generator's limits for its kind (empty: fine). */
export function fileProblem(def: GeneratorDef, r: RefMeta): string | null {
  const rule = def.files[r.kind];
  if (!rule) return `${def.name} لا يقبل مراجع ${KIND_AR_PL[r.kind]}.`;
  if (!rule.mimes.includes(r.mime)) return `صيغة ${r.mime || "غير معروفة"} غير مقبولة هنا.`;
  if (r.bytes > rule.maxBytes) return `الحجم أكبر من ${fmtMb(rule.maxBytes)}.`;
  const w = r.width ?? 0;
  const h = r.height ?? 0;
  if (r.kind !== "audio") {
    if (!w || !h) return "تعذّر قراءة أبعاد الملف.";
    if (rule.minSide && Math.min(w, h) < rule.minSide) return `أصغر ضلع لازم يكون ${rule.minSide} بكسل أو أكثر.`;
    if (rule.maxSide && Math.max(w, h) > rule.maxSide) return `أكبر ضلع لازم يكون ${rule.maxSide} بكسل أو أقل.`;
    const a = w / h;
    if (rule.minAspect && a < rule.minAspect - 1e-9) return `النسبة طولية جدًا (أقل حد ${rule.minAspect}).`;
    if (rule.maxAspect && a > rule.maxAspect + 1e-9) return `النسبة عرضية جدًا (أعلى حد ${rule.maxAspect}).`;
    if (rule.minPixels && w * h < rule.minPixels) return "دقة الملف أقل من المسموح.";
    if (rule.maxPixels && w * h > rule.maxPixels) return "دقة الملف أعلى من المسموح.";
  }
  if (r.kind !== "image") {
    const ms = r.durationMs ?? 0;
    if (!ms) return "تعذّر قراءة مدة الملف.";
    if (rule.minMs && ms < rule.minMs) return `المدة أقل من ${fmtSec(rule.minMs)}.`;
    if (rule.maxMs && ms > rule.maxMs) return `المدة أطول من ${fmtSec(rule.maxMs)}.`;
  }
  if (r.kind === "video" && r.fps != null) {
    if ((rule.minFps && r.fps < rule.minFps - 0.5) || (rule.maxFps && r.fps > rule.maxFps + 0.5)) {
      return `معدل الإطارات لازم يكون بين ${rule.minFps} و${rule.maxFps}.`;
    }
  }
  return null;
}

/** The value an option takes: the user's if valid, otherwise its default (ints are clamped). */
function normalize(o: OptionState, raw: unknown) {
  if (o.kind === "choice") return o.values.some((v) => v.value === raw) ? String(raw) : o.default;
  if (o.kind === "int") {
    const n = Math.round(Number(raw));
    return Number.isFinite(n) ? Math.min(o.max, Math.max(o.min, n)) : o.default;
  }
  return typeof raw === "boolean" ? raw : o.default;
}

export function evaluate(def: GeneratorDef, input: EvalInput, prices: Record<string, number | null>): Evaluation {
  const refs = input.refs;
  const mode = def.modeFor(input.refStyle, refs);
  const issues: Issue[] = [];
  const refProblems: Record<string, string> = {};

  // Options: first pass with the raw settings, so linked rules can see what the user picked
  const raw: Settings = {};
  for (const o of def.options) raw[o.key] = normalize(o as OptionState, input.settings[o.key]);
  const ruled = def.rules({ settings: raw, prompt: input.prompt, instructions: input.instructions, refs }, mode);
  const settings: Settings = {};
  for (const o of ruled.options) {
    if (o.hidden) continue;
    if (o.fixed) {
      settings[o.key] = o.fixed.value;
      continue;
    }
    const v = normalize(o, input.settings[o.key]);
    const why = o.kind === "choice" ? o.disabledValues?.[String(v)] : undefined;
    if (why) issues.push({ field: o.key, message: why });
    settings[o.key] = v;
  }
  if (input.strict) {
    for (const o of ruled.options) {
      const sent = input.settings[o.key];
      if (sent !== undefined && !o.hidden && sent !== settings[o.key]) issues.push({ field: o.key, message: `قيمة «${o.label}» غير مدعومة في هذا المولد أو الوضع.` });
    }
  }
  issues.push(...ruled.issues);

  // Text
  const prompt = input.prompt;
  if (mode.promptRequired && !prompt.trim()) issues.push({ field: "prompt", message: `اكتب ${def.prompt.label}.` });
  if (prompt.length > def.prompt.max) issues.push({ field: "prompt", message: `${def.prompt.label} أطول من ${def.prompt.max} حرف.` });
  if (def.extraText && input.instructions.length > def.extraText.max) {
    issues.push({ field: "instructions", message: `${def.extraText.label} أطول من ${def.extraText.max} حرف.` });
  }
  if (!def.extraText && input.instructions.trim()) issues.push({ field: "instructions", message: "هذا المولد لا يقبل وصف أداء منفصلًا." });

  // References: each file, then counts, totals, roles and combinations
  for (const r of refs) {
    if (r.status === "pending") refProblems[r.id] = "ما زال يُرفع أو يُفحص.";
    else if (r.status === "rejected") refProblems[r.id] = "الملف مرفوض؛ احذفه.";
    else {
      const allowed = mode.refs[r.kind];
      const p = !allowed || allowed.max === 0 ? `الوضع «${mode.label}» لا يقبل ${KIND_AR_PL[r.kind]}.` : fileProblem(def, r);
      // A file never takes part in a way the user can't see: frames mode uses only the two frame slots
      const role = mode.refStyle === "frames" ? (r.role === "reference" ? "في وضع «إطار أول / أخير» تُستخدم صورتا الإطارين فقط؛ احذف هذا المرجع." : null) : r.role !== "reference" ? "دور الإطار لا يُستخدم في هذا الوضع." : null;
      if (p || role) refProblems[r.id] = (p ?? role)!;
    }
  }
  if (refs.some((r) => r.status === "pending")) issues.push({ field: "refs", message: "انتظر حتى يكتمل رفع المراجع وفحصها." });
  if (refs.some((r) => r.status !== "pending" && refProblems[r.id])) {
    issues.push({ field: "refs", message: "فيه مراجع غير متوافقة مع هذا المولد أو الوضع؛ احذفها أو بدّل المولد." });
  }
  for (const kind of ["image", "video", "audio"] as RefKind[]) {
    const lim = mode.refs[kind];
    const list = refs.filter((r) => r.kind === kind);
    if (!lim) continue;
    if (list.length > lim.max) issues.push({ field: "refs", message: `الحد الأقصى ${lim.max} من ${KIND_AR_PL[kind]} في هذا الوضع.` });
    if (list.length < lim.min) issues.push({ field: "refs", message: `يحتاج هذا الوضع ${lim.min} ${KIND_AR[kind]} على الأقل.` });
    if (lim.totalMaxMs) {
      const sum = list.reduce((s, r) => s + (r.durationMs ?? 0), 0);
      if (sum > lim.totalMaxMs) issues.push({ field: "refs", message: `مجموع مدد ${KIND_AR_PL[kind]} أطول من ${fmtSec(lim.totalMaxMs)}.` });
    }
  }
  if (mode.needsOneOf && refs.length && !refs.some((r) => mode.needsOneOf!.includes(r.kind))) {
    issues.push({ field: "refs", message: `أضف ${mode.needsOneOf.map((k) => KIND_AR[k]).join(" أو ")} على الأقل مع المراجع.` });
  }
  if (mode.refStyle === "frames") {
    const first = refs.filter((r) => r.role === "first_frame").length;
    const last = refs.filter((r) => r.role === "last_frame").length;
    if (first !== 1) issues.push({ field: "refs", message: "حدّد صورة واحدة للإطار الأول." });
    if (last > 1) issues.push({ field: "refs", message: "صورة واحدة فقط للإطار الأخير." });
  }

  // What "+" may add now (for the current reference style)
  const styleModes = def.modes.filter((m) => m.refStyle !== "none" && (input.refStyle === "none" || m.refStyle === input.refStyle));
  const refKinds = {} as Evaluation["refKinds"];
  for (const kind of ["image", "video", "audio"] as RefKind[]) {
    const max = Math.max(0, ...styleModes.map((m) => m.refs[kind]?.max ?? 0));
    const have = refs.filter((r) => r.kind === kind).length;
    if (!def.files[kind] || max === 0) refKinds[kind] = { allowed: false, reason: `${def.name} لا يقبل ${KIND_AR_PL[kind]} في هذا الوضع.` };
    else if (have >= max) refKinds[kind] = { allowed: false, reason: `وصلت الحد (${max}).` };
    else if (kind === "video" && def.priceKeys.some((k) => k.key.startsWith("vref:")) && prices[`vref:sec:${settings.resolution}`] == null) {
      refKinds[kind] = { allowed: false, reason: "مراجع الفيديو بهذه الدقة موقوفة حتى يُحدَّد سعرها.", needsPrice: true };
    } else if (kind === "image" && def.priceKeys.some((k) => k.key === "ref:image") && prices["ref:image"] == null) {
      refKinds[kind] = { allowed: false, reason: "الصور المرجعية موقوفة حتى يُحدَّد سعرها.", needsPrice: true };
    } else refKinds[kind] = { allowed: true };
  }

  const price = def.price({ settings, prompt, instructions: input.instructions, refs }, mode, prices);
  if (!price.ok) issues.push({ field: "price", message: price.reason });

  return {
    mode,
    options: ruled.options,
    settings,
    issues,
    notes: ruled.notes,
    refProblems,
    refKinds,
    refStyles: [...new Set(def.modes.map((m) => m.refStyle).filter((s) => s !== "none"))],
    price,
  };
}

/** The effective price table of a generator: the owner's prices over the code defaults (null: not available). */
export function priceTable(def: GeneratorDef, overrides: Record<string, number> | undefined) {
  return Object.fromEntries(def.priceKeys.map((k) => [k.key, overrides?.[k.key] ?? k.defaultCenti])) as Record<string, number | null>;
}

/** A short fingerprint of the prices in force (stored with each job). */
export function priceVersion(table: Record<string, number | null>) {
  const s = Object.keys(table).sort().map((k) => `${k}=${table[k]}`).join("&");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
