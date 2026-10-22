// Phone numbers as people type them (05…, 5…, +966…, 00966…, other countries with + or 00) → the digits WhatsApp's link wants.

/** The digits for `wa.me/…` (country code first, no plus), or null when it cannot be a phone number. */
export function waDigits(raw: string): string | null {
  let s = String(raw ?? "").trim().replace(/[\s\-().]/g, "");
  if (!s) return null;
  const plus = s.startsWith("+");
  s = s.replace(/\D/g, "");
  if (s.startsWith("00")) s = s.slice(2);
  else if (!plus) {
    // no country code: the site's own (a Saudi number written 05xxxxxxxx or 5xxxxxxxx)
    if (/^05\d{8}$/.test(s)) s = `966${s.slice(1)}`;
    else if (/^5\d{8}$/.test(s)) s = `966${s}`;
    else if (s.startsWith("0")) s = `966${s.slice(1)}`;
  }
  return s.length >= 8 && s.length <= 15 ? s : null;
}

/** The link that opens a WhatsApp chat with this number (null when it is not a number). */
export const waLink = (raw: string): string | null => {
  const d = waDigits(raw);
  return d ? `https://wa.me/${d}` : null;
};
