// «صورة الاختبار مرجع»: the style test picture of the chosen style, attached as a STYLE reference to the master and to every
// sheet drawn after it, so the sheets keep the look the person liked in the test (the owner, 22 November 2026: «يطلع لي في
// الصورة التجريبية حلو وبعدين في شيتات سيء حيل»). On by default, in every film (those made before too); the person may switch
// it off, or pick another test picture of the same style. Pure (the sheets page and the server alike).
// When it goes with a drawing it GOVERNS the look (the owner, 22 November 2026: «لما أختار يولّد مع صورة الستايل، يتغير
// البرومبت وتكون هي الحاكمة — في الألوان والشكل وغيره»): the written style is taken out of the prompt and every other
// reference becomes secondary in colors, shapes, proportions, rendering, light and texture (`promptWithTestStyle`). Above
// it only the person's own edits of that sheet («ويتبع تعديلاتي اللي أكتبها»), written last in their words.

import { CLIENT_CHANGES_HEAD, MASTER_STYLE_ONLY, MASTER_STYLE_SECONDARY, TEST_STYLE_FOR_MASTER, TEST_STYLE_FOR_SHEET, TEST_STYLE_LOCK } from "@config/film-prompts/sheet-maker";

export const STYLE_TEST_KEY = "STYLE-TEST";

/** What the person chose, kept on the approved style's row (`data.testRef`); none = on, with the latest picture. */
export interface TestRefChoice {
  on: boolean;
  /** a test picture of the chosen style; none = the latest one */
  assetId?: string;
}

type StyleRow = { status: string; data: { styleId?: string; testRef?: TestRefChoice } };
type Picture = { id: string; kind: string; ref_key: string; status: string; meta: Record<string, unknown>; created_at: string };

/** Whether the choice is on (it is, until the person switches it off). */
export const testRefOn = (style: StyleRow | null | undefined) => style?.data.testRef?.on !== false;

/** The chosen style's test pictures that can be a reference (drawn and kept), oldest first. */
export function styleTestPictures<P extends Picture>(style: StyleRow | null | undefined, assets: readonly P[], hasFile: (p: P) => boolean = () => true): P[] {
  const styleId = style?.data.styleId;
  if (!styleId) return [];
  return assets
    .filter((a) => a.kind === "image" && a.ref_key === STYLE_TEST_KEY && String(a.meta?.styleId ?? "") === styleId && a.status !== "generating" && a.status !== "failed" && hasFile(a))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** The test picture that would go with a drawing — the one the person picked, else the latest — whether or not it is on. */
export function styleTestCandidate<P extends Picture>(style: StyleRow | null | undefined, assets: readonly P[], hasFile?: (p: P) => boolean): P | null {
  if (!style || style.status !== "approved") return null;
  const pics = styleTestPictures(style, assets, hasFile);
  const wanted = style.data.testRef?.assetId;
  return (wanted ? pics.find((p) => p.id === wanted) : undefined) ?? pics.at(-1) ?? null;
}

/** The test picture attached to the sheets' drawing, or null (switched off, no style approved yet, or no picture of it). */
export function styleTestRef<P extends Picture>(style: StyleRow | null | undefined, assets: readonly P[], hasFile?: (p: P) => boolean): P | null {
  return testRefOn(style) ? styleTestCandidate(style, assets, hasFile) : null;
}

/**
 * One drawing's own choice («📎» on a sheet's card, ticked or not when «ولّد» is pressed) wins over the film's setting;
 * none (the chain that draws by itself) follows the setting.
 */
export function testRefFor<P extends Picture>(style: StyleRow | null | undefined, assets: readonly P[], useTest: boolean | undefined, hasFile?: (p: P) => boolean): P | null {
  if (useTest === false) return null;
  return useTest === true ? styleTestCandidate(style, assets, hasFile) : styleTestRef(style, assets, hasFile);
}

/** Whether a drawn picture really went with the test picture (written on it only once it was attached). */
export const drawnWithTest = (meta: Record<string, unknown> | null | undefined) => typeof meta?.style_test_ref === "string" && Boolean(meta.style_test_ref);

/**
 * The prompt a sheet's picture is drawn with. With the test frame attached, the approved style's written text (copied word
 * for word into every prompt) is replaced by «the look of the test frame», and the notes make the frame the authority on the
 * look; the prompt still decides what is drawn. Without it: the prompt as it was, the master (a sheet's LAST image) for style.
 */
export function promptWithTestStyle(prompt: string, o: { master: boolean; withTest: boolean; styleText?: string | null; edits?: readonly string[] }): string {
  let text = prompt;
  if (o.withTest) {
    const written = (o.styleText ?? "").trim();
    if (written.length >= 20) text = text.split(written).join(TEST_STYLE_LOCK);
    text += `\n\n${o.master ? TEST_STYLE_FOR_MASTER : TEST_STYLE_FOR_SHEET}`;
  }
  if (!o.master) text += `\n\n${o.withTest ? MASTER_STYLE_SECONDARY : MASTER_STYLE_ONLY}`;
  // the person's own edits of this sheet, last: above the test frame (without it the rewritten prompt already carries them)
  const edits = (o.edits ?? []).map((e) => e.trim()).filter(Boolean);
  if (o.withTest && edits.length) text += `\n\n${CLIENT_CHANGES_HEAD}\n${edits.map((e, i) => `${i + 1}. ${e}`).join("\n")}`;
  return text;
}

/** How a sheet's edit is written in the conversation («تعديل على CHR-01:» then the person's words). */
export const sheetEditHead = (sheetId: string) => `تعديل على ${sheetId}:`;

/**
 * The person's own words from the conversation's edits of this sheet, oldest first: the latest few, each kept short. A real
 * person's converted sheet wraps its edit in the site's instructions (its words are the last lines after them).
 */
export function sheetEdits(messages: readonly string[], sheetId: string, keep = 6): string[] {
  const head = sheetEditHead(sheetId);
  return messages
    .filter((m) => m.startsWith(head))
    .map((m) => {
      const rest = m.slice(head.length);
      const fence = rest.lastIndexOf("مع التعديل التالي");
      const words = fence >= 0 ? rest.slice(rest.indexOf("\n", fence) + 1) : rest;
      return words.trim().slice(0, 1500);
    })
    .filter(Boolean)
    .slice(-keep);
}
