// «في حضرة السيدة زينب (ع)» — the server's part: the chosen view of the courtyard (a tile of the owner's environment
// sheet, shipped in public/zaynab/views), sent with every generation as the first reference, and the price of a request.
// Server only.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { UserError } from "@/lib/api";
import { generatorById } from "@config/jawad/generators";
import { ZAYNAB_IMAGE, ZAYNAB_VIEWS, zaynabPrompt, zaynabQuoteRefs, zaynabViewFile, type ZaynabInput } from "@config/jawad/zaynab";
import { evaluate } from "../engine";
import { loadRuntime } from "./runtime";

/** The chosen view's picture (what every generation is sent first). */
export async function viewBytes(id: string): Promise<Uint8Array> {
  if (!ZAYNAB_VIEWS.some((view) => view.id === id)) throw new UserError("اختر المنظر.", 400);
  try {
    return new Uint8Array(await readFile(path.join(process.cwd(), zaynabViewFile(id))));
  } catch {
    throw new UserError("تعذّر قراءة صورة المنظر؛ جرّب مرة ثانية.", 503);
  }
}

/** What a request costs: GPT Image 2 at the studio's price, for the picture count asked (the people's photos + the view). */
export async function zaynabQuote(input: ZaynabInput, photos: number) {
  const rt = await loadRuntime();
  const image = rt.generators.find((g) => g.id === ZAYNAB_IMAGE);
  const result = evaluate(generatorById(ZAYNAB_IMAGE)!, {
    settings: { aspect: input.aspect, resolution: "std", quality: "medium", count: input.count },
    prompt: zaynabPrompt(input, photos), instructions: "", refStyle: "references", refs: zaynabQuoteRefs(photos), strict: true,
  }, rt.prices[ZAYNAB_IMAGE]);
  if (!result.price.ok || result.issues.length) throw new UserError(result.issues[0]?.message ?? "تعذّر تسعير الصورة؛ جرّب لاحقًا.", 503);
  return { coins: result.price.coins, section: image?.sectionId ?? "images" };
}
