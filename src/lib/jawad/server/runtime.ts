// «الجواد الذكي!» | JAWAD AI — the configuration in force: the code registry (config/jawad) with the owner's
// overrides from the database. Server only. Until migration 0017 is run every table read fails softly and the
// code defaults apply (generators stay off for users, the owner can still try them).

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanAccent, JAWAD } from "@config/jawad/brand";
import { GENERATORS } from "@config/jawad/generators";
import { DEFAULT_SECTIONS, isImplementation, SECTION_IMPLEMENTATIONS, sectionPath, type SectionImplementation } from "@config/jawad/sections";
import type { GeneratorDef, OutputKind } from "@config/jawad/types";
import { priceTable } from "../engine";
import { publicFileUrl } from "@/lib/storage/public";

export const JAWAD_BUCKET = "jawad";
export const JAWAD_PUBLIC_BUCKET = "jawad-public";

export const publicUrl = (path: string) => publicFileUrl(JAWAD_PUBLIC_BUCKET, path);

export interface RuntimeSection {
  id: string;
  name: string;
  icon: string;
  implementation: SectionImplementation;
  output: OutputKind | null;
  sort: number;
  enabled: boolean;
  path: string;
}

export interface RuntimeGenerator {
  id: string;
  name: string;
  sampleUrl: string | null;
  sectionId: string;
  sort: number;
  /** The owner's switch (off by default: nothing is shown to users before the owner tries it). */
  enabled: boolean;
  /** The provider's key is in the server's environment. */
  keyConfigured: boolean;
  /** Users can see and use it. */
  live: boolean;
  /** Why it is not live (for the owner). */
  reason: string | null;
}

export interface Runtime {
  migrated: boolean;
  brand: { logoUrl: string; accent: string; customLogo: boolean };
  sections: RuntimeSection[];
  generators: RuntimeGenerator[];
  prices: Record<string, Record<string, number | null>>;
}

/** Which environment variables hold each provider's key (the values never leave the server). */
export const PROVIDER_KEYS: Record<GeneratorDef["provider"]["id"], string[]> = {
  openai: ["OPENAI_API_KEY"],
  // ARK_API_KEY is the documented name; the film branch's Vercel project stores it as seedance_api
  "byteplus-modelark": ["ARK_API_KEY", "seedance_api", "SEEDANCE_API"],
  // ELEVENLABS_API_KEY is the documented name; the owner's own style of names is accepted too
  elevenlabs: ["ELEVENLABS_API_KEY", "elevenlabs_api", "ELEVENLABS_API", "XI_API_KEY"],
};
export const keyConfigured = (d: GeneratorDef) => PROVIDER_KEYS[d.provider.id].some((k) => Boolean(process.env[k]));

interface SectionRow { id: string; name: string; icon: string; implementation: string; sort: number; enabled: boolean }
interface GeneratorRow { id: string; display_name: string | null; sample_path: string | null; section_id: string | null; sort: number; enabled: boolean }
interface PriceRow { generator_id: string; price_key: string; centicoins: number }
interface SettingRow { key: string; value: Record<string, unknown> }

export const loadRuntime = cache(async (): Promise<Runtime> => {
  const db = createAdminClient();
  const [sec, gen, pri, set] = await Promise.all([
    db.from("jawad_sections").select("id,name,icon,implementation,sort,enabled"),
    db.from("jawad_generators").select("id,display_name,sample_path,section_id,sort,enabled"),
    db.from("jawad_price_rules").select("generator_id,price_key,centicoins"),
    db.from("jawad_settings").select("key,value"),
  ]);
  const migrated = !sec.error && !gen.error && !pri.error && !set.error;

  // Sections: code defaults, then the owner's rows (rename / reorder / hide / add)
  const byId = new Map(DEFAULT_SECTIONS.map((s) => [s.id, { ...s }]));
  for (const r of ((sec.data ?? []) as SectionRow[])) {
    if (!isImplementation(r.implementation)) continue;
    byId.set(r.id, { id: r.id, name: r.name, icon: r.icon, implementation: r.implementation, sort: r.sort, enabled: r.enabled });
  }
  const sections: RuntimeSection[] = [...byId.values()]
    .map((s) => ({ ...s, output: SECTION_IMPLEMENTATIONS[s.implementation].output, path: sectionPath(s) }))
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));

  const settings = Object.fromEntries(((set.data ?? []) as SettingRow[]).map((r) => [r.key, r.value]));
  const brandRow = (settings.brand ?? {}) as { logoPath?: string; accent?: string };

  const rows = new Map(((gen.data ?? []) as GeneratorRow[]).map((r) => [r.id, r]));
  const overrides: Record<string, Record<string, number>> = {};
  for (const p of (pri.data ?? []) as PriceRow[]) (overrides[p.generator_id] ??= {})[p.price_key] = p.centicoins;

  const generators: RuntimeGenerator[] = GENERATORS.map((d) => {
    const r = rows.get(d.id);
    const sectionId = r?.section_id && sections.some((s) => s.id === r.section_id && s.output === d.output) ? r.section_id : d.defaultSection;
    const section = sections.find((s) => s.id === sectionId);
    const enabled = Boolean(r?.enabled);
    const key = keyConfigured(d);
    const reason = !migrated
      ? "جداول JAWAD AI غير موجودة: شغّل ملف SQL رقم 0017."
      : !key
        ? `مفتاح ${d.provider.label} غير موجود في إعدادات الخادم.`
        : !enabled
          ? "مخفي عن المستخدمين (فعّله من لوحة التحكم بعد تجربته)."
          : !section?.enabled
            ? "قسمه غير مفعّل."
            : null;
    return {
      id: d.id,
      name: r?.display_name || d.name,
      sampleUrl: r?.sample_path ? publicUrl(r.sample_path) : null,
      sectionId,
      sort: r?.sort ?? 100,
      enabled,
      keyConfigured: key,
      live: reason === null,
      reason,
    };
  }).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

  const prices = Object.fromEntries(GENERATORS.map((d) => [d.id, priceTable(d, overrides[d.id])]));

  return {
    migrated,
    brand: {
      logoUrl: brandRow.logoPath ? publicUrl(brandRow.logoPath) : JAWAD.defaultLogo,
      accent: cleanAccent(brandRow.accent),
      customLogo: Boolean(brandRow.logoPath),
    },
    sections,
    generators,
    prices,
  };
});

/** Sections users can see (enabled; studio sections only when they have a live generator, unless `owner`). */
export function visibleSections(rt: Runtime, owner: boolean) {
  return rt.sections.filter((s) => s.enabled || owner);
}

/** The generators a studio section offers to this person (the owner also sees hidden ones, to try them). */
export function sectionGenerators(rt: Runtime, sectionId: string, owner: boolean) {
  return rt.generators.filter((g) => g.sectionId === sectionId && (g.live || (owner && g.keyConfigured && rt.migrated)));
}
