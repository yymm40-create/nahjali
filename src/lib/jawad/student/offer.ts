// «الطالب الذكي» · صادق يصنع من المحادثة — the same صادق who walked the student through the material, now in a chat. When
// the student asks him to make something, he answers in words and adds a marker line: [[MAKE]]{…} (what to make) or
// [[MERGE]] (put the finished PDFs in one file). The marker is cut out of what the student reads and becomes an OFFER
// under his message: a card with a button. Nothing is made, and nothing is charged, until the student presses it.
// Pure: reading and checking his marker, and the instruction that teaches it to him.

import { OUTPUT_KINDS, outputName, type OutputKind } from "@config/jawad/student";

export const OFFER_MAX = 4;
const NOTE_MAX = 600;

export interface OfferItem {
  kind: OutputKind;
  /** the student's special wishes for this output, in their words (may be empty) */
  note: string;
}
export interface Offer {
  items: OfferItem[];
  /** «ادمج النواتج في PDF واحد» */
  merge: boolean;
  state: "open" | "made" | "dismissed";
}

/** What صادق may make from a conversation: every output but the conversation itself and the sermon (which has its own steps). */
export const chatMakeKinds = (): OutputKind[] => OUTPUT_KINDS.map((k) => k.kind).filter((k) => k !== "chat" && k !== "sermon");

/** His reply without the markers, and the offer they hold (null when he made none, or none that is valid). */
export function splitOffer(reply: string, allowed: readonly string[] = chatMakeKinds()): { text: string; offer: Offer | null } {
  let text = String(reply ?? "");
  let merge = false;
  const m = text.indexOf("[[MERGE]]");
  if (m >= 0) {
    merge = true;
    text = text.slice(0, m) + text.slice(m + "[[MERGE]]".length);
  }
  const items: OfferItem[] = [];
  const k = text.indexOf("[[MAKE]]");
  if (k >= 0) {
    const rest = text.slice(k + "[[MAKE]]".length);
    text = text.slice(0, k);
    const json = rest.match(/\{[\s\S]*\}/)?.[0];
    try {
      const list = (JSON.parse(json ?? "null") as { outputs?: unknown } | null)?.outputs;
      for (const x of Array.isArray(list) ? list : []) {
        const o = (x ?? {}) as Record<string, unknown>;
        const kind = String(o.kind ?? "");
        if (!allowed.includes(kind) || items.some((i) => i.kind === kind)) continue;
        items.push({ kind: kind as OutputKind, note: String(o.note ?? "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX) });
        if (items.length >= OFFER_MAX) break;
      }
    } catch {
      /* a marker he wrote badly: no offer, his words still show */
    }
  }
  // the merge takes what is finished now: next to something still to be made it would leave that out, so it waits
  if (items.length) merge = false;
  text = text.trim();
  if (!items.length && !merge) return { text: text || String(reply ?? "").trim(), offer: null };
  return { text: text || "تمام.", offer: { items, merge, state: "open" } };
}

/** The `settings`-free request the project's «start» action takes for an offer: kinds, and the notes as the special request. */
export function startBody(offer: Pick<Offer, "items">) {
  return {
    action: "start",
    outputs: offer.items.map((i) => ({ kind: i.kind, settings: {} })),
    special: offer.items
      .filter((i) => i.note)
      .map((i) => `${outputName(i.kind)}: ${i.note}`)
      .join("\n"),
    design: {},
  };
}

/** What teaches صادق to make things: the menu, what already exists, and exactly when to use the markers. */
export function makeRules(made: { kind: string; title: string; status: string }[]): string {
  const menu = OUTPUT_KINDS.filter((k) => chatMakeKinds().includes(k.kind)).map((k) => `- ${k.kind}: ${k.name} — ${k.blurb}`);
  const have = made.filter((o) => o.kind !== "chat").map((o) => `${o.kind} («${o.title}», ${o.status})`);
  return [
    "MAKING THINGS FROM THIS CONVERSATION. You are the same صادق who walked the student through this whole material; this conversation is only another way to talk to you. Besides discussing, you can MAKE outputs for them. What can be made (kind: name — what it is):",
    ...menu,
    have.length ? `Already in this material: ${have.join("; ")}.` : "Nothing has been made yet in this material.",
    "When — and only when — the student asks you to make or prepare something (a summary, an explanation, a quiz, slides, a recording, a mind map, a book or PDF, a pre-lesson paper…), or says yes to what you offered, answer in one or two short sentences saying what you will make and how it follows what they asked, then finish the message with ONE marker line, alone on the last line:",
    '[[MAKE]]{"outputs":[{"kind":"summary","note":"their special wishes for it, in their words, or empty"}]}',
    "At most 4 outputs, one of each kind, kinds only from the menu above. Put in \"note\" only what the student actually asked for that output (its focus, its examples, its length, its tone); never invent wishes.",
    "To put the student's finished PDFs together in one file (when they ask to merge, combine or gather the outputs into one PDF), finish with the single line:",
    "[[MERGE]]",
    "The merge takes only what is finished now. If the student asks to make something AND merge, use the [[MAKE]] marker alone, and tell them to ask you for the merge once it is finished.",
    "Rules: never explain or mention the markers; never use them for discussion, advice, a question or when the student has not asked for a thing to be made; do not offer again what already exists unless they ask for another one; if you are unsure what they want made, ask first without a marker. The student confirms with a button, so nothing is made before they press it — say «اضغط نفّذ» in your own words when you add a marker.",
  ].join("\n");
}
