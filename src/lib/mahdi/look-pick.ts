// «لأجل المهدي» — the style a person picked stays theirs. The account keeps it (profile.theme), but a database that has
// not run the design migrations (0062 / 0063) keeps only the older looks, and an unreachable server keeps nothing.
// So the pick is also kept on the device, in a cookie the server reads before the first paint: no flash of another
// style, no going back to the default on a refresh. It is only used while the account's own look is still the one it
// was when the person picked (`saw`): if the account changed since (the person picked on another device, or a reward
// switched it), the account wins. Pure — the cookie itself is written by the page (look-pick-client.ts).

import { MAHDI_THEMES, type MahdiTheme } from "@config/mahdi";

export const PICK_COOKIE = "mahdi-look";
/** a year: it is a preference, not a session */
export const PICK_MAX_AGE = 60 * 60 * 24 * 365;

export interface Pick {
  user: string;
  /** the style the person chose */
  pick: MahdiTheme;
  /** the style the account held when they chose (what the server answered) */
  saw: MahdiTheme;
}

const known = (v: string): v is MahdiTheme => MAHDI_THEMES.some((t) => t.key === v);

export const writePickValue = (p: Pick) => `${p.user}.${p.pick}.${p.saw}`;

/** The cookie's value, or null when it is missing or not ours. */
export function readPickValue(raw: string | undefined | null): Pick | null {
  if (!raw) return null;
  const parts = decodeURIComponent(raw).split(".");
  if (parts.length !== 3) return null;
  const [user, pick, saw] = parts;
  if (!user || !known(pick) || !known(saw)) return null;
  return { user, pick, saw };
}

/** The style to show: the person's pick while the account still holds what it held then; else the account's. */
export function resolveTheme(accountTheme: MahdiTheme, userId: string | null | undefined, raw: string | undefined | null): MahdiTheme {
  const p = readPickValue(raw);
  if (!p || !userId || p.user !== userId) return accountTheme;
  return p.saw === accountTheme ? p.pick : accountTheme;
}
