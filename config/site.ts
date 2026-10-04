// Public site details used on the privacy and terms pages. Edit freely.

export const SITE_NAME = "عاداتي الخارقة";

/** Shown on /privacy and /terms for questions and deletion requests. */
export const CONTACT_EMAIL = "yymm40@gmail.com";

/** Date shown as "last updated" on the legal pages. */
export const LEGAL_UPDATED = "١ أكتوبر ٢٠٢٦";

/** Accounts that can open the owner's dashboard (/admin). */
export const ADMIN_EMAILS = ["yymm40@gmail.com"];
export const isAdmin = (email: string | undefined | null) => Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()));

/**
 * «كتيب نهج علي»'s pages and API. Who may open them (closed / given emails / everyone; closed by default, the
 * owner always) is set on /admin/limits — see bookletOpenFor in src/lib/film/limits.ts, used by src/proxy.ts.
 * While it isn't open for everyone, it stays listed and marked «تحت التطوير».
 */
export const BOOKLET_PATHS = ["/booklet", "/new", "/order", "/my-booklets", "/api/orders", "/api/feedback"];

/** Set by src/proxy.ts on requests for «الجواد الذكي!» (/jawad-ai): the root layout then renders none of the main site's chrome. */
export const OWN_CHROME_HEADER = "x-own-chrome";
