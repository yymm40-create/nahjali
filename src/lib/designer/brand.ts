// «المصمم الذكي كاظم» — the majlis's own brand kit («هوية المأتم»): its name, invitation words, place, the women's and
// the stream lines, and its logo, saved once per person and put into every new invitation (the person can still change
// any of it per design). Kept in designer_kv under brand:<user id>. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { MAJLIS_FIELDS, type MajlisFieldKey } from "@config/designer-majlis";

/** The fields of a design that belong to the majlis itself (not to one night). */
export const BRAND_FIELDS: MajlisFieldKey[] = ["host", "invite", "pre", "place", "women", "live"];

export interface Brand {
  fields: Partial<Record<MajlisFieldKey, string>>;
  /** a jawad_uploads id */
  logo?: string;
}

const key = (userId: string) => `brand:${userId}`;

export function readBrand(raw: unknown): Brand {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const f = (o.fields ?? {}) as Record<string, unknown>;
  const fields: Brand["fields"] = {};
  for (const k of BRAND_FIELDS) if (MAJLIS_FIELDS.some((d) => d.key === k) && typeof f[k] === "string" && f[k]) fields[k] = (f[k] as string).replace(/\s+/g, " ").trim().slice(0, 120);
  return { fields, ...(typeof o.logo === "string" && /^[0-9a-f-]{36}$/i.test(o.logo) ? { logo: o.logo } : {}) };
}

export async function getBrand(userId: string): Promise<Brand> {
  const { data } = await createAdminClient().from("designer_kv").select("value").eq("key", key(userId)).maybeSingle();
  try {
    return readBrand(JSON.parse(String(data?.value ?? "{}")));
  } catch {
    return { fields: {} };
  }
}

export async function setBrand(userId: string, raw: unknown): Promise<Brand> {
  const b = readBrand(raw);
  const { error } = await createAdminClient().from("designer_kv").upsert({ key: key(userId), value: JSON.stringify(b), updated_at: new Date().toISOString() });
  if (error) throw error;
  return b;
}
