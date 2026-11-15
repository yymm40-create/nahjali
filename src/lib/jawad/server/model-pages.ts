// «المولدات»: what the public generator pages show, read from the live runtime (the owner's switches, prices and samples)
// and the generators' own definitions (config/jawad/generators.ts). Only generators that are live for users get a page.
// Server only.

import { cache } from "react";
import { generatorById } from "@config/jawad/generators";
import type { GeneratorDef, OptionDef } from "@config/jawad/types";
import { MODEL_ABOUT, ONE_OF } from "@config/jawad/model-pages";
import { evaluate, priceTable } from "@/lib/jawad/engine";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { loadPricing } from "@/lib/coins";
import { thumbOf } from "@/lib/storage/public";

export interface ModelPage {
  id: string;
  name: string;
  output: "image" | "video" | "audio";
  provider: string;
  family: string;
  about: string;
  best: string[];
  /** a small WebP of the owner's sample picture (images only), or null */
  sample: string | null;
  sampleLarge: string | null;
  /** halalas for one result at the studio's default settings, or null when a price needs the person's own files */
  price: number | null;
  /** what that price is for, in words («صورة وحدة · 1:1 · جودة متوسطة») */
  priceFor: string;
  modes: string[];
  options: { label: string; values: string }[];
  arabic: boolean;
  arabicNote: string | null;
}

const valuesOf = (o: OptionDef): string => {
  if (o.kind === "choice") return o.values.map((v) => v.label).join("، ");
  if (o.kind === "int") return `${o.min}–${o.max} ${o.unit}`.trim();
  return "تشغيل أو إيقاف";
};

/** The default settings in words: the choice options' default labels and the numbers with their units. */
function defaultsInWords(def: GeneratorDef, settings: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const o of def.options) {
    const v = settings[o.key];
    if (o.kind === "choice") {
      const label = o.values.find((x) => x.value === v)?.label;
      if (label && !o.picker) parts.push(label);
    } else if (o.kind === "int" && typeof v === "number") parts.push(`${v} ${o.unit}`.trim());
  }
  return parts.slice(0, 4).join(" · ");
}

function build(def: GeneratorDef, rt: Awaited<ReturnType<typeof loadRuntime>> | null, sampleUrl: string | null): ModelPage {
  const about = MODEL_ABOUT[def.id];
  const table = rt?.prices[def.id] ?? priceTable(def, undefined);
  let price: number | null = null;
  let priceFor = "";
  try {
    const e = evaluate(def, { settings: {}, prompt: "x".repeat(200), instructions: "", refStyle: "none", refs: [] }, table);
    if (e.price.ok && e.price.coins > 0) {
      price = e.price.coins;
      const words = defaultsInWords(def, e.settings as Record<string, unknown>);
      priceFor = `${ONE_OF[def.output as "image" | "video" | "audio"] ?? "نتيجة"} وحدة${words ? ` · ${words}` : ""}`;
    }
  } catch {
    // a generator that needs the person's own files to be priced (an edit, a real face, an upscale…)
  }
  const isPicture = !!sampleUrl && /\.(png|jpe?g|webp)$/i.test(sampleUrl.split("?")[0]);
  return {
    id: def.id,
    name: def.name,
    output: def.output as ModelPage["output"],
    provider: def.provider.label,
    family: def.model.family,
    about: about?.about ?? `${def.name} من ${def.provider.label}، متوفر في الاستوديو الإبداعي في الجواد الذكي.`,
    best: about?.best ?? [],
    sample: isPicture ? thumbOf(sampleUrl, 480) : null,
    sampleLarge: isPicture ? thumbOf(sampleUrl, 960) : null,
    price,
    priceFor,
    modes: def.modes.map((m) => m.label),
    options: def.options.filter((o) => !(o.kind === "choice" && o.picker)).map((o) => ({ label: o.label, values: valuesOf(o) })),
    arabic: def.prompt.arabic,
    arabicNote: def.prompt.arabicNote ?? null,
  };
}

/** Every generator live for users, in the studio's order. */
export const livePages = cache(async (): Promise<ModelPage[]> => {
  await loadPricing().catch(() => null);
  const rt = await loadRuntime().catch(() => null);
  if (!rt) return [];
  return rt.generators
    .filter((g) => g.live)
    .sort((a, b) => a.sort - b.sort)
    .flatMap((g) => {
      const def = generatorById(g.id);
      return def && ["image", "video", "audio"].includes(def.output) ? [{ ...build(def, rt, g.sampleUrl), name: g.name || def.name }] : [];
    });
});

export async function livePage(id: string): Promise<ModelPage | null> {
  return (await livePages()).find((p) => p.id === id) ?? null;
}
