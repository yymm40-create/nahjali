// «الأداء» in حيدرة كت — which part of the computer does what. The way the big editors do it (Premiere's Mercury
// Playback Engine with its «GPU acceleration» and export «Hardware encoding», Resolve's «GPU processing mode»,
// Puget Systems' hardware guides): the TIMELINE is the CPU's work (decoding, scrubbing, the logic), with the GPU for
// the picture shaders (colour, key, effects); the RENDER / EXPORT leans on the GPU's encoder (NVENC, Quick Sync,
// Apple's Media Engine) when there is one that works. In a browser the choice is a HINT: WebCodecs takes
// `hardwareAcceleration` («prefer-hardware» / «prefer-software» / «no-preference» — Chromium treats a preference as a
// requirement and fails when it can't be met, so every hint is checked with `isConfigSupported` before it is used and
// falls back to «no-preference»), and WebGL takes `powerPreference` («high-performance» = the big card on a laptop
// with two, «low-power» = the integrated one). The person chooses: automatic (the device is measured), the graphics
// card, the processor, or the integrated graphics; and how much of the computer the editor may take.
// Pure — the page measures the device and keeps the choice (perf-bench.ts).

export type PerfMode = "auto" | "gpu" | "cpu" | "integrated";
export const PERF_MODES: { id: PerfMode; ar: string; hint: string }[] = [
  { id: "auto", ar: "تلقائي", hint: "يقيس جهازك ويقرر: التايملاين على المعالج، والتصدير على كرت الشاشة إذا كان يشتغل" },
  { id: "gpu", ar: "كرت الشاشة", hint: "الكرت الخارجي (NVIDIA / AMD / Apple): الشيدرات والتصدير بالعتاد" },
  { id: "cpu", ar: "المعالج", hint: "كل شي على المعالج؛ الأبطأ بس الأضمن لو كرت الشاشة يعلّق" },
  { id: "integrated", ar: "الكرت المدمج", hint: "كرت اللابتوب المدمج (Intel / Radeon Graphics): أخف حرارة وبطارية" },
];
export const PERF_SHARES = [25, 50, 75, 100] as const;
export interface PerfPrefs {
  mode: PerfMode;
  /** how much of the computer the editor may take, 25–100 % */
  share: number;
}
export const DEFAULT_PERF: PerfPrefs = { mode: "auto", share: 100 };
export const PERF_KEY = "jw-editor-perf";

export function readPerf(raw: unknown): PerfPrefs {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mode = PERF_MODES.some((m) => m.id === o.mode) ? (o.mode as PerfMode) : DEFAULT_PERF.mode;
  const share = (PERF_SHARES as readonly number[]).includes(Number(o.share)) ? Number(o.share) : DEFAULT_PERF.share;
  return { mode, share };
}

export type GpuClass = "discrete" | "integrated" | "unified" | "software" | "none";
/**
 * What the WebGL renderer string says the GPU is: a discrete card (NVIDIA GeForce/RTX/Quadro, AMD Radeon RX/Pro),
 * an integrated one (Intel UHD/Iris/Arc in a laptop, AMD «Radeon Graphics»/Vega 8, phones' Mali/Adreno), Apple's
 * unified chips (M1–M4), or a software renderer (SwiftShader, llvmpipe) that is slower than the CPU itself.
 */
export function classifyGpu(renderer: string): GpuClass {
  const r = (renderer || "").toLowerCase();
  if (!r) return "none";
  if (/swiftshader|llvmpipe|softpipe|software|mesa offscreen|basic render/.test(r)) return "software";
  if (/apple (m\d|gpu|a\d\d)/.test(r) || /\bapple\b/.test(r)) return "unified";
  if (/intel|iris|uhd|hd graphics|mali|adreno|powervr|radeon graphics|radeon\(tm\) graphics|vega \d\b|radeon 6\d0m|radeon 7\d0m/.test(r)) return "integrated";
  if (/nvidia|geforce|rtx|gtx|quadro|tesla|radeon rx|radeon pro|radeon vii|rx \d{3,4}|arc a\d{3}|arc b\d{3}/.test(r)) return "discrete";
  return "integrated";
}

export interface DeviceReport {
  cores: number;
  renderer: string;
  webgl2: boolean;
  webcodecs: boolean;
  memoryGB?: number | null;
  /** how long the same keying work took on each side (ms for the same number of frames), when measured */
  bench?: { gpuMs: number; cpuMs: number } | null;
}
export type HwHint = "no-preference" | "prefer-hardware" | "prefer-software";
export type Phase = "timeline" | "render";

export interface PerfPlan {
  phase: Phase;
  gpuClass: GpuClass;
  /** the picture shaders (colour, key) run on the GPU; off = the CPU fallbacks */
  useGpu: boolean;
  /** WebGL's powerPreference for the editor's contexts */
  power: "high-performance" | "low-power" | "default";
  /** WebCodecs' hint for the encoder of an export or a light copy (checked before use, falls back by itself) */
  encode: HwHint;
  /** background jobs at once (light copies, waveforms) */
  parallel: number;
  /** the longest side the preview's GPU passes work at (the export always works at full size) */
  maxSide: number;
  /** Arabic, for the panel: what was decided and why */
  why: string[];
}

export const PREVIEW_SIDES: Record<number, number> = { 25: 720, 50: 1080, 75: 1440, 100: 1920 };

/** The decision for a phase, from the choice and what the device is. */
export function planFor(prefs: PerfPrefs, device: DeviceReport, phase: Phase): PerfPlan {
  const gpuClass: GpuClass = device.webgl2 ? classifyGpu(device.renderer) : "none";
  const cores = Math.max(1, Math.floor(device.cores || 4));
  const share = (PERF_SHARES as readonly number[]).includes(prefs.share) ? prefs.share : 100;
  const why: string[] = [];
  const realGpu = gpuClass === "discrete" || gpuClass === "integrated" || gpuClass === "unified";

  let useGpu = realGpu && prefs.mode !== "cpu";
  if (prefs.mode === "cpu") why.push("اختيارك: كل شي على المعالج.");
  else if (!realGpu) why.push(gpuClass === "software" ? "كرت الشاشة هنا برمجي (SwiftShader): المعالج أسرع منه، فالشيدرات على المعالج." : "ما فيه WebGL2 في هذا المتصفح: الشيدرات على المعالج.");
  if (prefs.mode === "auto" && useGpu && device.bench && device.bench.gpuMs > device.bench.cpuMs * 1.5) {
    useGpu = false;
    why.push(`القياس: الكرت أبطأ من المعالج (${Math.round(device.bench.gpuMs)} مقابل ${Math.round(device.bench.cpuMs)} ملّي ثانية)، فالشيدرات على المعالج.`);
  }

  let power: PerfPlan["power"] = "default";
  if (prefs.mode === "gpu") power = "high-performance";
  else if (prefs.mode === "integrated" || prefs.mode === "cpu") power = "low-power";
  else if (gpuClass === "discrete") power = phase === "render" ? "high-performance" : "default";
  if (phase === "timeline" && useGpu) why.push(power === "high-performance" ? "التايملاين: الصورة على الكرت الخارجي، والقص والتحريك على المعالج." : "التايملاين: القص والتحريك على المعالج، والتلوين والكي على كرت الشاشة.");
  else if (phase === "timeline") why.push("التايملاين: كل شي على المعالج.");

  let encode: HwHint = "no-preference";
  if (!device.webcodecs) why.push("التصدير: المتصفح بدون WebCodecs؛ يصدّر بطريقته.");
  else if (prefs.mode === "cpu") encode = "prefer-software";
  else if (prefs.mode === "gpu" || prefs.mode === "integrated" || realGpu) encode = "prefer-hardware";
  if (phase === "render" && device.webcodecs) why.push(encode === "prefer-hardware" ? "التصدير: ترميز بعتاد الكرت (NVENC / Quick Sync / Media Engine) بعد التأكد أنه يشتغل، وإلا يرجع للمتصفح." : encode === "prefer-software" ? "التصدير: ترميز على المعالج." : "التصدير: المتصفح يختار.");

  const parallel = Math.max(1, Math.min(4, Math.round((cores * share) / 100)));
  const maxSide = phase === "render" ? 1920 : PREVIEW_SIDES[share] ?? 1920;
  if (share < 100) why.push(`نسبة الاستخدام ${share}٪: ${parallel} ${parallel === 1 ? "مهمة خلفية" : "مهام خلفية"} بالمرة، والمعاينة على الكرت حتى ${maxSide} بكسل.`);
  return { phase, gpuClass, useGpu, power, encode, parallel, maxSide, why };
}

/** One Arabic line about the device, for the panel and the diagnosis. */
export function describeDevice(d: DeviceReport): string {
  const cls: Record<GpuClass, string> = { discrete: "كرت خارجي", integrated: "كرت مدمج", unified: "شريحة Apple موحّدة", software: "رسم برمجي", none: "بدون WebGL2" };
  const g = d.webgl2 ? classifyGpu(d.renderer) : "none";
  const name = (d.renderer || "").replace(/^ANGLE \((.*)\)$/, "$1").replace(/, (OpenGL|Direct3D|Vulkan|Metal).*$/, "").trim();
  return `${d.cores} ${d.cores === 1 ? "نواة" : "أنوية"}${d.memoryGB ? ` · ${d.memoryGB} GB` : ""} · ${cls[g]}${name ? ` (${name})` : ""} · WebCodecs ${d.webcodecs ? "✓" : "✗"}`;
}
