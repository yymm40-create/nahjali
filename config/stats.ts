// The owner's statistics (/admin/stats): which pages are counted, and how a page's address is kept (the same page under one
// name: a project's or a game's own id is dropped). Pure.

/** The address kept for a visit, or null when the page is not counted (the dashboard, the API, files). */
export function visitPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const p = raw.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (!p.startsWith("/") || p.length > 200) return null;
  if (/^\/(admin|api|files|_next|auth)(\/|$)/.test(p) || p.startsWith("/jawad-ai/admin")) return null;
  if (p.startsWith("/play/")) return "/play";
  // a project, a film, a game build… one name per kind of page
  return p.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, "/:id");
}

/** The names the owner reads for the pages. */
export const PAGE_NAMES: Record<string, string> = {
  "/jawad-ai": "الصفحة الرئيسية",
  "/jawad-ai/course": "صفحة شراء الدورة",
  "/jawad-ai/credits": "صفحة شحن الرصيد (الباقات)",
  "/jawad-ai/coins": "صفحة الرصيد",
  "/jawad-ai/login": "تسجيل الدخول",
  "/play": "لعبة مبنية (رابط لعب)",
};
