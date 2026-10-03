import { DIR, LANG, t } from "@/lib/mahdi/i18n";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * The page shown when the app cannot be reached. It is one self-contained document (no scripts, no other files), because it
 * has to work with no connection at all; the service worker keeps a copy of it. Colours use the same --m-* token names as mahdi.css.
 */
export function GET() {
  const html = `<!doctype html>
<html lang="${LANG}" dir="${DIR}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${esc(t.pwa.offlineTitle)} · ${esc(t.brand)}</title>
<style>
:root{--m-bg:#0d0c0b;--m-surface:#1a1714;--m-ink:#f7f0e3;--m-muted:#cbc1b0;--m-line:rgba(255,234,196,.18);--m-gold:#e2bc66;--m-gold-2:#f4da95;--m-gold-ink:#1c1406;color-scheme:dark}
@media (prefers-color-scheme:light){:root{--m-bg:#faf6ee;--m-surface:#fff;--m-ink:#1f1b16;--m-muted:#675e52;--m-line:#e8ddcb;--m-gold:#bf9746;--m-gold-2:#ddbe72;--m-gold-ink:#1f1505;color-scheme:light}}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:var(--m-bg);color:var(--m-ink);font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;line-height:1.7}
.m-card{max-width:420px;width:100%;padding:28px 22px;text-align:center;background:var(--m-surface);border:1px solid var(--m-line);border-radius:20px}
.m-display{margin:0 0 6px;font-family:"Amiri","Noto Naskh Arabic",serif;font-size:2rem;color:var(--m-gold)}
h1{margin:0 0 10px;font-size:1.3rem}
p{margin:0 0 20px;color:var(--m-muted)}
.m-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border:0;border-radius:14px;font:inherit;font-weight:600;color:var(--m-gold-ink);background:linear-gradient(180deg,var(--m-gold-2),var(--m-gold));text-decoration:none;cursor:pointer}
.m-btn:focus-visible{outline:3px solid var(--m-gold);outline-offset:3px}
</style>
</head>
<body>
<main class="m-card">
<p class="m-display">${esc(t.brand)}</p>
<h1>${esc(t.pwa.offlineTitle)}</h1>
<p>${esc(t.pwa.offlineBody)}</p>
<a class="m-btn" href="/mahdi">${esc(t.pwa.offlineRetry)}</a>
</main>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
