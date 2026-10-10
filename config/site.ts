// Public site details used on the privacy and terms pages. Edit freely.

/**
 * «نهج علي» (the booklet, its logo, its pages and its place in the dashboard) is hidden for JAWAD AI's public launch: the site is
 * «الجواد الذكي» only. Nothing is deleted — its pages, data and code stay; `false` brings it all back.
 */
export const NAHJ_ALI_HIDDEN = true;

export const SITE_NAME = NAHJ_ALI_HIDDEN ? "الجواد الذكي" : "عاداتي الخارقة";

/** Shown on /privacy and /terms for questions and deletion requests. */
export const CONTACT_EMAIL = "yymm40@gmail.com";

/** Date shown as "last updated" on the legal pages. */
export const LEGAL_UPDATED = NAHJ_ALI_HIDDEN ? "١٠ أكتوبر ٢٠٢٦" : "١ أكتوبر ٢٠٢٦";

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
 * «كتيب نهج علي»'s pages and API: for those «السماح» (/admin/access, src/lib/access.ts) lets in, checked in
 * src/proxy.ts; everyone else sees «تحت التطوير».
 */
export const BOOKLET_PATHS = ["/booklet", "/new", "/order", "/my-booklets", "/api/orders", "/api/feedback"];

/** Set by src/proxy.ts on requests for «الجواد الذكي!» (/jawad-ai): the root layout then renders none of the main site's chrome. */
export const OWN_CHROME_HEADER = "x-own-chrome";
/** The JAWAD AI path, set by the proxy only (lets its layout keep the sign-in page open while the platform is in development). */
export const JAWAD_PATH_HEADER = "x-jawad-path";
