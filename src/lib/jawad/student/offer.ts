// «الطالب الذكي» · صادق يصنع من المحادثة — the same صادق who walked the student through the material, now in a chat. When
// the student asks him to make something, he answers in words and adds a marker line: [[MAKE]]{…} (what to make) or
// [[MERGE]] (put the finished PDFs in one file). The marker is cut out of what the student reads and becomes an OFFER
// under his message: a card with a button. Nothing is made, and nothing is charged, until the student presses it.
// Pure: reading and checking his marker, and the instruction that teaches it to him.

import { MAX_NAME, OUTPUT_KINDS, maxAvailable, outputName, type OutputKind } from "@config/jawad/student";
import { canTogether } from "./merge-parts";

export const OFFER_MAX = 4;
const NOTE_MAX = 600;

export interface OfferItem {
  kind: OutputKind;
  /** the student's special wishes for this output, in their words (may be empty) */
  note: string;
  /** made by «حيدرا ماكس» (Claude Code designs it in code, then it opens in the editor) */
  maker?: "max";
}
export interface Offer {
  items: OfferItem[];
  /** «ادمج النواتج في PDF واحد» */
  merge: boolean;
  /** the outputs made here come out together in ONE PDF (put together by the page once they are all finished) */
  together?: boolean;
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
  let together = false;
  const k = text.indexOf("[[MAKE]]");
  if (k >= 0) {
    const rest = text.slice(k + "[[MAKE]]".length);
    text = text.slice(0, k);
    const json = rest.match(/\{[\s\S]*\}/)?.[0];
    try {
      const parsed = JSON.parse(json ?? "null") as { outputs?: unknown; together?: unknown } | null;
      together = parsed?.together === true;
      const list = parsed?.outputs;
      for (const x of Array.isArray(list) ? list : []) {
        const o = (x ?? {}) as Record<string, unknown>;
        const kind = String(o.kind ?? "");
        if (!allowed.includes(kind) || items.some((i) => i.kind === kind)) continue;
        const max = (o.maker === "max" || o.max === true) && maxAvailable(kind);
        items.push({ kind: kind as OutputKind, note: String(o.note ?? "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX), ...(max ? { maker: "max" as const } : {}) });
        if (items.length >= OFFER_MAX) break;
      }
    } catch {
      /* a marker he wrote badly: no offer, his words still show */
    }
  }
  // the merge takes what is finished now: next to something still to be made it would leave that out, so it waits
  if (items.length) merge = false;
  // "all in one PDF" needs two outputs that make a PDF
  together = together && canTogether(items.map((i) => i.kind));
  text = text.trim();
  if (!items.length && !merge) return { text: text || String(reply ?? "").trim(), offer: null };
  return { text: text || "تمام.", offer: { items, merge, ...(together ? { together } : {}), state: "open" } };
}

/** The `settings`-free request the project's «start» action takes for an offer: kinds, and the notes as the special request. */
export function startBody(offer: Pick<Offer, "items" | "together">) {
  return {
    action: "start",
    ...(offer.together ? { together: true } : {}),
    outputs: offer.items.map((i) => ({ kind: i.kind, settings: i.maker === "max" ? { maker: "max", ...(i.kind === "slides" ? { render: "design" } : {}) } : {} })),
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
    '[[MAKE]]{"outputs":[{"kind":"summary","note":"their special wishes for it, in their words, or empty"},{"kind":"brochure","note":"","maker":"max"}]}',
    `EVERY output except the recording (audio) can be made by «${MAX_NAME}» — the option "maker":"max". ${MAX_NAME} designs the output page by page IN CODE (free layout built for THIS content, drawn in a real browser, looked at, measured and fixed), and the student then edits it by hand in the editor («محرر العرض») and downloads the PDF (slides also as an editable PPTX). Add "maker":"max" ONLY when the student asks for it by any of its names («حيدرا ماكس», «ماكس», «كلاود كود», «حيدرا ماكس», «صممه بالكود», «تصميم احترافي حر») — otherwise leave it out, the standard way is cheaper. If the student asks "make EVERYTHING / all the options" you may put up to 4 outputs in one marker (the menu's most useful), and say that more can follow. A Max output is a PDF only (no Word file), and its page count follows the content.`,
    `The brochure («مطوية», kind "brochure") is one A4 landscape sheet printed on both sides and folded in three (6 panels) or in two (4 panels); the student can say which fold in "note" ("ثنائية الطي" or "ثلاثية الطي").`,
    "At most 4 outputs, one of each kind, kinds only from the menu above. Put in \"note\" only what the student actually asked for that output (its focus, its examples, its length, its tone); never invent wishes.",
    "When the student wants SEVERAL outputs to come out together in ONE PDF (\"في ملف واحد\", \"PDF واحد\", \"كلها مع بعض\"), put \"together\":true next to \"outputs\" in the same marker (only with two or more of: summary, explain, preread, transcript, book, slides, quiz, brochure); the page then puts them in one PDF by itself when they are all finished.",
    "To put the student's finished PDFs together in one file (when they ask to merge, combine or gather the outputs into one PDF), finish with the single line:",
    "[[MERGE]]",
    "The merge takes only what is finished now. If the student asks to make something AND merge, use the [[MAKE]] marker alone, and tell them to ask you for the merge once it is finished.",
    "Rules: never explain or mention the markers; never use them for discussion, advice, a question or when the student has not asked for a thing to be made; do not offer again what already exists unless they ask for another one; if you are unsure what they want made, ask first without a marker. The student confirms with a button, so nothing is made before they press it — say «اضغط نفّذ» in your own words when you add a marker.",
  ].join("\n");
}
