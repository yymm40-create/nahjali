// Public site details used on the privacy and terms pages. Edit freely.

export const SITE_NAME = "عاداتي الخارقة";

/** Shown on /privacy and /terms for questions and deletion requests. */
export const CONTACT_EMAIL = "yymm40@gmail.com";

/** Date shown as "last updated" on the legal pages. */
export const LEGAL_UPDATED = "١ أكتوبر ٢٠٢٦";

/** Accounts that can open the owner's dashboard (/admin). */
export const ADMIN_EMAILS = ["yymm40@gmail.com"];
export const isAdmin = (email: string | undefined | null) => Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()));
