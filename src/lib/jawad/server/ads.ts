// «الجواد الذكي!» | JAWAD AI — the home page's three ads. Server only.
// The owner edits a draft (previewed on the admin page) and publishes it; visitors only ever see published ads.

import { createAdminClient } from "@/lib/supabase/admin";
import { publicUrl } from "./runtime";

export const AD_SLOTS = ["main", "side_top", "side_bottom"] as const;
export type AdSlot = (typeof AD_SLOTS)[number];
export const AD_SLOT_LABEL: Record<AdSlot, string> = { main: "الكبير (ثلثا العرض)", side_top: "الصغير العلوي", side_bottom: "الصغير السفلي" };

export interface AdMedia {
  path: string;
  type: "image" | "video";
  mime: string;
  width?: number | null;
  height?: number | null;
}
export interface AdContent {
  title: string;
  href: string;
  slot: AdSlot;
  enabled: boolean;
  media: AdMedia | null;
  /** A cover picture for a video (uploaded, or captured from the video in the admin page). */
  poster: { path: string } | null;
}
export interface AdRow {
  id: string;
  draft: AdContent;
  live: AdContent | null;
  published_at: string | null;
  updated_at: string;
}

/** What the ad grid shows (ready-to-use links). */
export interface AdView {
  id: string;
  title: string;
  href: string;
  external: boolean;
  media: { url: string; type: "image" | "video"; mime: string; width: number | null; height: number | null } | null;
  posterUrl: string | null;
}

export const emptyAd = (slot: AdSlot = "main"): AdContent => ({ title: "", href: "", slot, enabled: false, media: null, poster: null });

/** Allowed ad links: a path on this site, or an https address. Returns the clean link or null. */
export function cleanAdHref(href: unknown): string | null {
  const s = typeof href === "string" ? href.trim() : "";
  if (!s) return "";
  if (s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") && !/[\s<>"']/.test(s)) return s.slice(0, 500);
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !/[\s<>"']/.test(s) ? u.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}

export function adView(id: string, c: AdContent): AdView {
  return {
    id,
    title: c.title,
    href: c.href,
    external: /^https:\/\//.test(c.href),
    media: c.media ? { url: publicUrl(c.media.path), type: c.media.type, mime: c.media.mime, width: c.media.width ?? null, height: c.media.height ?? null } : null,
    posterUrl: c.poster ? publicUrl(c.poster.path) : null,
  };
}

export async function adRows(): Promise<AdRow[]> {
  const { data, error } = await createAdminClient().from("jawad_ads").select("*").order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as AdRow[];
}

/** The published, enabled ad of each slot (null: nothing published there). */
export async function liveAds(): Promise<Record<AdSlot, AdView | null>> {
  const out: Record<AdSlot, AdView | null> = { main: null, side_top: null, side_bottom: null };
  for (const r of await adRows()) {
    const c = r.live;
    if (c?.enabled && c.media && AD_SLOTS.includes(c.slot) && !out[c.slot]) out[c.slot] = adView(r.id, c);
  }
  return out;
}
