// «في حضرة السيدة زينب (ع)» — the server's part: the owner's environment sheet (Image 1 of every generation), «جواد»
// writing the prompt from the person's choices while looking at the references, the price of that very prompt, and a
// seal so the prompt that was priced is the one that is made. Server only.

import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { callClaudeJson, type ClaudePart, type ClaudeTurn } from "@/lib/film/anthropic";
import { UserError } from "@/lib/api";
import { assistantSystem } from "@config/jawad/assistant";
import { generatorById } from "@config/jawad/generators";
import { ZAYNAB_IMAGE, ZAYNAB_RECIPE, ZAYNAB_SHEET_FILE, zaynabBrief, zaynabPromptProblems, zaynabQuoteRefs, type ZaynabInput } from "@config/jawad/zaynab";
import { evaluate } from "../engine";
import { loadRuntime } from "./runtime";
import { uploadViews, type UploadRow } from "./uploads";

/** The environment sheet's picture (what every generation is sent first). */
export async function sheetBytes(): Promise<Uint8Array> {
  try {
    return new Uint8Array(await readFile(path.join(process.cwd(), ZAYNAB_SHEET_FILE)));
  } catch {
    throw new UserError("تعذّر قراءة شيت المكان؛ جرّب مرة ثانية.", 503);
  }
}

const SCHEMA = {
  type: "object",
  properties: { prompt: { type: "string" }, reply: { type: "string" } },
  required: ["prompt", "reply"],
  additionalProperties: false,
};

/**
 * «جواد» writes the final prompt: his own system prompt (what he is and knows about GPT Image 2), this request type's
 * recipe, then the references themselves (the sheet and every photo, in the order the generator numbers them) and the
 * person's choices. A fault the website can check (the greeting letter for letter, Image 1 named) goes back to him once.
 */
export async function jawadWritesZaynab(input: ZaynabInput, people: UploadRow[]): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("«جواد» غير متاح حاليًا لكتابة البرومبت.", 503);
  const def = generatorById(ZAYNAB_IMAGE)!;
  const sheet = Buffer.from(await sheetBytes()).toString("base64");
  const views = await uploadViews(people);
  const parts: ClaudePart[] = [
    { type: "text", text: "Image 1 — the environment sheet:" },
    { type: "image64", data: sheet, mediaType: "image/jpeg" },
    ...views.flatMap((v, i): ClaudePart[] => (v.url ? [{ type: "text", text: `Image ${i + 2} — a photo of the people:` }, { type: "image", url: v.url }] : [])),
    { type: "text", text: zaynabBrief(input, people.length) },
  ];
  const system = [
    assistantSystem("image", [def]),
    ZAYNAB_RECIPE,
    'HOW TO ANSWER: a JSON object with "prompt" = the whole final prompt for GPT Image 2, in English (the greeting lines stay in Arabic exactly as given), and "reply" = one short line in Arabic for the person.',
  ].join("\n\n---\n\n");
  let turns: ClaudeTurn[] = [{ role: "user", content: parts }];
  let last = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    let r;
    try {
      r = await callClaudeJson<{ prompt: string; reply: string }>({ system, turns, schema: SCHEMA, maxTokens: 8000 });
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      if (/credit balance is too low/i.test(m)) throw new UserError("رصيد مزوّد الذكاء الاصطناعي عند المنصة خلص، فما قدر «جواد» يكتب البرومبت. ما انخصم منك شي. صاحب المنصة لازم يشحن الرصيد.", 503);
      throw new UserError("«جواد» ما قدر يكتب البرومبت الحين؛ جرّب بعد شوي. ما انخصم منك شي.", 502);
    }
    last = String(r.data.prompt ?? "").trim();
    const left = zaynabPromptProblems(last, input);
    if (!left.length) return last;
    turns = [...turns, { role: "assistant", content: r.raw }, { role: "user", content: `Fix these and return the complete JSON again:\n- ${left.join("\n- ")}` }];
  }
  if (last && last.length <= 30_000) return last;
  throw new UserError("«جواد» ما قدر يكتب برومبت صالح؛ جرّب مرة ثانية. ما انخصم منك شي.", 502);
}

/** What a request costs: GPT Image 2 at the studio's price, for THIS prompt, the picture count and the references (sheet + photos). */
export async function zaynabQuote(input: ZaynabInput, photos: number, prompt: string) {
  const rt = await loadRuntime();
  const image = rt.generators.find((g) => g.id === ZAYNAB_IMAGE);
  const result = evaluate(generatorById(ZAYNAB_IMAGE)!, {
    settings: { aspect: input.aspect, resolution: "std", quality: "medium", count: input.count },
    prompt, instructions: "", refStyle: "references", refs: zaynabQuoteRefs(photos), strict: true,
  }, rt.prices[ZAYNAB_IMAGE]);
  if (!result.price.ok || result.issues.length) throw new UserError(result.issues[0]?.message ?? "تعذّر تسعير الصورة؛ جرّب لاحقًا.", 503);
  return { coins: result.price.coins, section: image?.sectionId ?? "images" };
}

const secret = () => process.env.JAWAD_WEBHOOK_SECRET || createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").update("zaynab-prompt").digest("hex");
/** A seal over the prompt «جواد» wrote and what it was written for, so the page can't change it between price and start. */
export function sealPrompt(userId: string, prompt: string, input: ZaynabInput, uploads: string[]): string {
  return createHmac("sha256", secret()).update(JSON.stringify([userId, prompt, input, uploads])).digest("hex");
}
export function promptSealed(seal: unknown, userId: string, prompt: string, input: ZaynabInput, uploads: string[]): boolean {
  if (typeof seal !== "string" || !/^[0-9a-f]{64}$/.test(seal)) return false;
  return timingSafeEqual(Buffer.from(seal, "hex"), Buffer.from(sealPrompt(userId, prompt, input, uploads), "hex"));
}
