// Public site details used on the privacy and terms pages. Edit freely.

export const SITE_NAME = "عاداتي الخارقة";

/** Shown on /privacy and /terms for questions and deletion requests. */
export const CONTACT_EMAIL = "yymm40@gmail.com";

/** Date shown as "last updated" on the legal pages. */
export const LEGAL_UPDATED = "١ أكتوبر ٢٠٢٦";

/** Accounts that can open the owner's dashboard (/admin). */
/** «الرئيس»: the site's owner, above everyone. */
export const OWNER_EMAILS = ["yymm40@gmail.com"];
/**
 * «رئيس مشارك»: everything the owner can do (every section free and unlimited, the dashboard, access and permissions,
 * prices, coins), except anything aimed at the owner's own account — the owner stays above them.
 */
export const CO_OWNER_EMAILS = ["narjiszahra912@gmail.com"];
export const ADMIN_EMAILS = [...OWNER_EMAILS, ...CO_OWNER_EMAILS];
/** The site's owners: «الرئيس» and the «رئيس مشارك». */
export const isAdmin = (email: string | undefined | null) => Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()));
export const isOwner = (email: string | undefined | null) => Boolean(email && OWNER_EMAILS.includes(email.toLowerCase()));
export const isCoOwner = (email: string | undefined | null) => Boolean(email && CO_OWNER_EMAILS.includes(email.toLowerCase()));
/** May this admin change things for that account? Anyone but the owner's account, which only the owner may touch. */
export const mayActOn = (actor: string | undefined | null, target: string | undefined | null) => isOwner(actor) || !isOwner(target);
export const ABOVE_YOU = "هذا حساب الرئيس؛ ما يتغير إلا منه.";

/**
 * Guests the owner lets into JAWAD AI with everything free (no coins, no limits) until a set time; after it they are
 * like everyone else again. They do not get the dashboard.
 */
export const FREE_GUESTS: { email: string; until: string }[] = [
  // the owner's guest, until tomorrow 12:00 noon (Saudi time)
  { email: "emanalialali91@gmail.com", until: "2026-10-06T12:00:00+03:00" },
  // the owner's guest: the whole site free and unlimited for 24 hours from when it goes live (Vercel's daily deploy
  // limit holds it until 8 Oct, ~3 pm Saudi time)
  { email: "hassanirno44@gmail.com", until: "2026-10-09T15:15:00+03:00" },
];
export const isFreeGuest = (email: string | undefined | null) =>
  Boolean(email && FREE_GUESTS.some((g) => g.email === email.toLowerCase() && Date.now() < new Date(g.until).getTime()));
/** Makes things without paying: the owner, or a free guest while their time lasts. */
export const isUnlimited = (email: string | undefined | null) => isAdmin(email) || isFreeGuest(email);

/**
 * «كتيب نهج علي»'s pages and API. Who may open them (closed / given emails / everyone; closed by default, the
 * owner always) is set on /admin/limits — see bookletOpenFor in src/lib/film/limits.ts, used by src/proxy.ts.
 * While it isn't open for everyone, it stays listed and marked «تحت التطوير».
 */
export const BOOKLET_PATHS = ["/booklet", "/new", "/order", "/my-booklets", "/api/orders", "/api/feedback"];

/** Set by src/proxy.ts on requests for «الجواد الذكي!» (/jawad-ai): the root layout then renders none of the main site's chrome. */
export const OWN_CHROME_HEADER = "x-own-chrome";
/** The JAWAD AI path, set by the proxy only (lets its layout keep the sign-in page open while the platform is in development). */
export const JAWAD_PATH_HEADER = "x-jawad-path";
