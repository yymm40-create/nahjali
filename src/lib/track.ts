// Ad conversions and the visitor's source, for the browser. Client-safe and pure: `track` only talks to the pixels that
// Pixels.tsx loaded (each one only when its env var is set) and is a silent no-op otherwise, so nothing here can break a
// page. The server imports the constants and SOURCE_KEYS from here too.

/** The events the site reports, in Meta's names; TikTok and Snap get their own names (EVENT_NAMES). */
export type AdEvent = "PageView" | "CompleteRegistration" | "ViewContent" | "InitiateCheckout" | "Purchase" | "Lead";

export interface TrackParams {
  /** the amount, in `currency` */
  value?: number;
  currency?: string;
  content_name?: string;
  /** the order id: a server-side event with the same id is counted once (Meta eventID, TikTok event_id, Snap client_dedup_id) */
  event_id?: string;
}

/** Meta name → [TikTok name, Snap name]. Snap has no lead/contact event, so a WhatsApp lead is its CUSTOM_EVENT_1. */
const EVENT_NAMES: Record<Exclude<AdEvent, "PageView">, [tiktok: string, snap: string]> = {
  CompleteRegistration: ["CompleteRegistration", "SIGN_UP"],
  ViewContent: ["ViewContent", "VIEW_CONTENT"],
  InitiateCheckout: ["InitiateCheckout", "START_CHECKOUT"],
  Lead: ["Contact", "CUSTOM_EVENT_1"],
  Purchase: ["CompletePayment", "PURCHASE"],
};

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, params?: Record<string, unknown>, options?: Record<string, unknown>) => void; page: () => void };
    snaptr?: (...args: unknown[]) => void;
  }
}

/** Reports one event to every pixel on the page (none → nothing happens). */
export function track(event: AdEvent, params: TrackParams = {}): void {
  if (typeof window === "undefined") return;
  try {
    if (event === "PageView") {
      window.fbq?.("track", "PageView");
      window.ttq?.page();
      window.snaptr?.("track", "PAGE_VIEW");
      return;
    }
    const { event_id, ...p } = params;
    window.fbq?.(...(event_id ? ["track", event, p, { eventID: event_id }] : ["track", event, p]));
    const [tiktok, snap] = EVENT_NAMES[event];
    window.ttq?.track(tiktok, { ...p, ...(p.content_name ? { content_type: "product", content_id: p.content_name } : {}) }, event_id ? { event_id } : undefined);
    window.snaptr?.("track", snap, {
      ...(p.value !== undefined ? { price: p.value } : {}),
      ...(p.currency ? { currency: p.currency } : {}),
      ...(p.content_name ? { item_category: p.content_name, description: p.content_name } : {}),
      ...(event_id ? { transaction_id: event_id, client_dedup_id: event_id } : {}),
    });
  } catch {
    /* a pixel that throws never breaks the page */
  }
}

/** First touch: where this browser came from the first time (kept 90 days). */
export const SOURCE_COOKIE = "jw_src";
/** Last touch: the latest visit that carried a source. */
export const LAST_COOKIE = "jw_last";
/** Set by /auth/callback and /auth/confirm for an account made minutes ago; Pixels.tsx reads it once and clears it. */
export const NEW_SIGNUP_COOKIE = "jw_new";

/** What is taken from the landing address: the utm_* fields, a `ref`, and the networks' click ids (Snap sends ScCid). */
export const SOURCE_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref", "fbclid", "ttclid", "sccid"] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];
/** The source as it travels to the server: the first touch, the first page (`landing`) and the last touch in one line (`last`). */
export type VisitorSource = Partial<Record<SourceKey | "landing" | "last", string>>;

const DAYS_90 = 90 * 86400;

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

export function writeCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

export const clearCookie = (name: string) => writeCookie(name, "", 0);

function readJson(name: string): Record<string, string> | null {
  let raw = readCookie(name);
  if (!raw) {
    try {
      raw = localStorage.getItem(name);
    } catch {
      raw = null;
    }
  }
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, string>) : null;
  } catch {
    return null;
  }
}

function keep(name: string, o: Record<string, string>) {
  const json = JSON.stringify(o);
  writeCookie(name, json, DAYS_90);
  try {
    localStorage.setItem(name, json);
  } catch {
    /* no storage: the cookie is enough */
  }
}

/** The source fields in an address (lower-cased keys; Snap's `ScCid` becomes `sccid`), each cut to 100 characters. */
export function sourceFromUrl(url: URL): Partial<Record<SourceKey, string>> {
  const out: Partial<Record<SourceKey, string>> = {};
  for (const [k, v] of url.searchParams) {
    const key = k.toLowerCase() as SourceKey;
    if ((SOURCE_KEYS as readonly string[]).includes(key) && v.trim() && !out[key]) out[key] = v.trim().slice(0, 100);
  }
  return out;
}

/**
 * On a page load: the address's source goes into jw_last always, and into jw_src only when nothing is there yet (first
 * touch). Without any field, an outside referrer counts as `ref` (its host) so a plain link is attributed too.
 */
export function captureVisitorSource(href = location.href, referrer = document.referrer): void {
  try {
    const url = new URL(href);
    const found: Partial<Record<SourceKey, string>> = sourceFromUrl(url);
    if (!Object.keys(found).length && referrer) {
      const host = new URL(referrer).hostname;
      if (host && host !== url.hostname) found.ref = host.replace(/^www\./, "").slice(0, 100);
    }
    if (!Object.keys(found).length) return;
    keep(LAST_COOKIE, found);
    if (!readJson(SOURCE_COOKIE)) keep(SOURCE_COOKIE, { ...found, landing: url.pathname.slice(0, 100) });
  } catch {
    /* nothing captured */
  }
}

/** What the browser knows about where this person came from: the first touch, with the last touch in one line when it differs. */
export function visitorSource(): VisitorSource | null {
  const first = readJson(SOURCE_COOKIE);
  const last = readJson(LAST_COOKIE);
  if (!first && !last) return null;
  const out: VisitorSource = { ...(first ?? last) };
  if (first && last) {
    const line = (o: Record<string, string>) => [o.utm_source ?? o.ref, o.utm_medium, o.utm_campaign].filter(Boolean).join("/");
    const l = line(last);
    if (l && l !== line(first)) out.last = l.slice(0, 100);
  }
  return out;
}
