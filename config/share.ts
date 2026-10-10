// «انشرنا واربح»: a person shares JAWAD AI in an Instagram story with a mention of the platform's account, comes
// back, presses «نشرت ✅» with their Instagram name, and the owner — told on Telegram — checks the story and confirms:
// the reward lands in their wallet once. Pure (pages and server alike).

export const SHARE = {
  /** the platform's Instagram account the story mentions */
  account: "jawad.ai.studio",
  /** the reward when the owner has set none, in riyals */
  defaultRewardSar: 10,
} as const;

export const instagramUrl = (handle: string) => `https://www.instagram.com/${handle.replace(/^@/, "")}/`;

/** An Instagram name as people type it («@ali.design», a link to the profile) → the bare name, or "" when it can't be one. */
export function cleanHandle(raw: unknown): string {
  let s = String(raw ?? "").trim();
  const m = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(s);
  if (m) s = m[1];
  s = s.replace(/^@+/, "").replace(/\/+$/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(s) && !/^\.|\.$|\.\./.test(s) ? s : "";
}

export type ShareStatus = "pending" | "approved" | "rejected";

/** The key a popup was put away under: the site's version (it comes back with every new version). */
export const shareSeenKey = (version: string) => `jw-share-seen:${version}`;
