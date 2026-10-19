// «صانع الألعاب الذكي» · the game's counter, the parts both sides share: where a player came from, their device, and the
// numbers of a game worked out from its sittings.

export const PLAYS = {
  /** a sitting's heartbeat while the game is on screen */
  tickSeconds: 20,
  /** the most one heartbeat may add (a sleeping tab woken up doesn't count its sleep) */
  maxAdd: 60,
  /** a sitting closer than this to the last one of the same browser goes on (a reload is not a new open) */
  resumeMs: 30 * 60_000,
  /** the most one sitting counts */
  maxSeconds: 6 * 3600,
  /** the days on the chart */
  days: 14,
} as const;

export type Device = "" | "phone" | "tablet" | "desktop";

export const SOURCE_LABEL: Record<string, string> = {
  whatsapp: "واتساب",
  instagram: "إنستقرام",
  snapchat: "سناب",
  tiktok: "تيك توك",
  x: "إكس",
  facebook: "فيسبوك",
  telegram: "تيليقرام",
  google: "قوقل",
  youtube: "يوتيوب",
  site: "من الموقع",
  direct: "رابط مباشر",
};
export const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? s;

const HOSTS: [RegExp, string][] = [
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)snapchat\.com$/, "snapchat"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "x"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, "facebook"],
  [/(^|\.)(t\.me|telegram\.org|telegram\.me)$/, "telegram"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
];

/** Where the player came from: the link's own word (?ref= / utm_source), the app they opened it in, or the page before. */
export function playSource(o: { referrer?: string; ua?: string; search?: string; host?: string }): string {
  const q = new URLSearchParams(o.search ?? "");
  const tagged = (q.get("ref") || q.get("utm_source") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
  if (tagged) return HOSTS.find(([, k]) => k === tagged)?.[1] ?? (tagged === "wa" ? "whatsapp" : tagged === "ig" ? "instagram" : tagged);
  const ua = o.ua ?? "";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/Snapchat/i.test(ua)) return "snapchat";
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return "tiktok";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";
  if (/WhatsApp/i.test(ua)) return "whatsapp";
  if (/Telegram/i.test(ua)) return "telegram";
  let host = "";
  try {
    host = o.referrer ? new URL(o.referrer).hostname.toLowerCase() : "";
  } catch {}
  if (!host) return "direct";
  const own = (o.host ?? "").toLowerCase().replace(/^www\./, "");
  if (own && host.replace(/^www\./, "") === own) return "site";
  return HOSTS.find(([re]) => re.test(host))?.[1] ?? host.replace(/^www\./, "").slice(0, 40);
}

export function deviceOf(ua: string): Device {
  if (!ua) return "";
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/Mobi|iPhone|Android/i.test(ua)) return "phone";
  return "desktop";
}

export interface PlayRow {
  visitor: string;
  user_id: string | null;
  source: string;
  device: string;
  seconds: number;
  started_at: string;
}

export interface GameStats {
  /** sittings */
  opens: number;
  /** different browsers */
  players: number;
  /** different site accounts among them */
  signedIn: number;
  /** players who came back (opened it on more than one sitting) */
  returning: number;
  minutes: number;
  avgMinutes: number;
  today: number;
  /** the last `PLAYS.days` days, oldest first: the date (YYYY-MM-DD) and its opens and players */
  days: { day: string; opens: number; players: number }[];
  sources: { source: string; label: string; opens: number }[];
  devices: { device: Device; opens: number }[];
  lastPlayed: string | null;
}

const dayOf = (iso: string, tz: number) => new Date(new Date(iso).getTime() + tz * 60_000).toISOString().slice(0, 10);

/** A game's numbers from its sittings (`tz`: the viewer's offset from UTC, in minutes; Saudi Arabia is +180). */
export function statsOf(rows: PlayRow[], now = new Date(), tz = 180): GameStats {
  const visitors = new Map<string, number>();
  const users = new Set<string>();
  const sources = new Map<string, number>();
  const devices = new Map<Device, number>();
  let seconds = 0;
  let last: string | null = null;
  const today = dayOf(now.toISOString(), tz);
  const days = new Map<string, { opens: number; players: Set<string> }>();
  for (let i = PLAYS.days - 1; i >= 0; i--) days.set(dayOf(new Date(now.getTime() - i * 86_400_000).toISOString(), tz), { opens: 0, players: new Set() });
  for (const r of rows) {
    visitors.set(r.visitor, (visitors.get(r.visitor) ?? 0) + 1);
    if (r.user_id) users.add(r.user_id);
    const s = r.source || "direct";
    sources.set(s, (sources.get(s) ?? 0) + 1);
    const d = (["phone", "tablet", "desktop"].includes(r.device) ? r.device : "") as Device;
    devices.set(d, (devices.get(d) ?? 0) + 1);
    seconds += Math.max(0, Math.min(PLAYS.maxSeconds, r.seconds || 0));
    if (!last || r.started_at > last) last = r.started_at;
    const day = days.get(dayOf(r.started_at, tz));
    if (day) {
      day.opens++;
      day.players.add(r.visitor);
    }
  }
  const minutes = Math.round(seconds / 6) / 10;
  return {
    opens: rows.length,
    players: visitors.size,
    signedIn: users.size,
    returning: [...visitors.values()].filter((n) => n > 1).length,
    minutes,
    avgMinutes: rows.length ? Math.round((seconds / rows.length / 60) * 10) / 10 : 0,
    today: days.get(today)?.opens ?? 0,
    days: [...days].map(([day, v]) => ({ day, opens: v.opens, players: v.players.size })),
    sources: [...sources].sort((a, b) => b[1] - a[1]).map(([source, opens]) => ({ source, label: sourceLabel(source), opens })),
    devices: [...devices].sort((a, b) => b[1] - a[1]).map(([device, opens]) => ({ device, opens })),
    lastPlayed: last,
  };
}
