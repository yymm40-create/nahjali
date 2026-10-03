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
 * «كتيب نهج علي» is closed for now: still listed, marked «تحت التطوير», and nobody but the owner can open it.
 * Set to false to open it again. The paths below are blocked in src/proxy.ts (pages and API).
 */
export const BOOKLET_LOCKED = true;
export const BOOKLET_PATHS = ["/booklet", "/new", "/order", "/my-booklets", "/api/orders", "/api/feedback"];
export const bookletClosedFor = (email: string | undefined | null) => BOOKLET_LOCKED && !isAdmin(email);
