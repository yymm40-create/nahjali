// «سلمان» — the site's helper on every page: a person who doesn't understand something about the site asks him, in their own words,
// and he answers short and simple (the platform's knowledge comes with every call, see siteSystem), with buttons to the right pages.
// Pure parts (the persona, the answer's shape, the checks) live here; the route calls the model. Server only for the call.

export const SALMAN = {
  name: "سلمان",
  /** the light, fast model: he answers questions about the site, nothing heavy */
  model: "claude-haiku-5-5",
  /** turns of the conversation sent back each time */
  keepTurns: 12,
  maxChars: 1200,
} as const;

export const SALMAN_TASK = `You are «سلمان», the friendly helper of the site «الجواد الذكي» (JAWAD AI). A floating button with your name is on every page; people press it when they don't understand something about the site.
How you answer:
- Gulf Arabic, warm and VERY simple, as if explaining to someone who never used AI tools. Short: 2–6 short lines, or a few numbered steps when it is a "how do I" question. No long lectures, no jargon (if a word like «برومبت» is needed, explain it in a few words).
- Answer only about this site: its sections, robots, prices and paying, the balance, signing in, where things are. Use the platform knowledge you were given; never invent a feature, a price or a page. If you don't know, say so plainly and suggest writing to the site through the WhatsApp link on the «اشحن رصيدك» page or by e-mail.
- Prices: never state an exact price of a generation (it shows on the «توليد» button); for the balance packages point to the «اشحن رصيدك» page.
- Never name an AI model, a company that built you, or how you were made; you are «سلمان» of «الجواد الذكي».
- When a page helps, add it in "links" (up to 3): a short Arabic label and the site path (it must start with "/", for example "/jawad-ai/credits", "/jawad-ai/coins", "/jawad-ai/login", or a section's path from the knowledge).
- The page the person is on is given as PAGE; use it to understand what they are looking at.
- Requests to do the work itself (make a picture, write a script…) are not yours: say which section or robot does it and link it.`;

export const SALMAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "links"],
  properties: {
    reply: { type: "string", description: "The answer in Gulf Arabic, short and simple." },
    links: {
      type: "array",
      maxItems: 3,
      items: { type: "object", additionalProperties: false, required: ["label", "href"], properties: { label: { type: "string" }, href: { type: "string" } } },
    },
  },
} as const;

export interface SalmanTurn {
  role: "user" | "assistant";
  text: string;
}

/** The conversation as the person's page sent it, cleaned: the last turns only, each short, starting with the person. */
export function cleanTurns(raw: unknown): SalmanTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: SalmanTurn[] = [];
  for (const t of raw.slice(-SALMAN.keepTurns)) {
    if (!t || typeof t !== "object") continue;
    const r = (t as Record<string, unknown>).role;
    const text = String((t as Record<string, unknown>).text ?? "").trim().slice(0, SALMAN.maxChars);
    if ((r === "user" || r === "assistant") && text) out.push({ role: r, text });
  }
  while (out.length && out[0].role !== "user") out.shift();
  // two turns of the same side in a row are joined (the model expects them to alternate)
  const merged: SalmanTurn[] = [];
  for (const t of out) {
    const last = merged[merged.length - 1];
    if (last && last.role === t.role) last.text = `${last.text}\n${t.text}`;
    else merged.push({ ...t });
  }
  return merged;
}

/** Only links inside the site, short labels. */
export function cleanLinks(raw: unknown): { label: string; href: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => ({ label: String((l as Record<string, unknown>)?.label ?? "").trim().slice(0, 40), href: String((l as Record<string, unknown>)?.href ?? "").trim() }))
    .filter((l) => l.label && /^\/[\w\-/?=&.%]*$/.test(l.href) && !l.href.startsWith("//") && !l.href.startsWith("/api/"))
    .slice(0, 3);
}
