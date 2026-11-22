// «صورة الاختبار مرجع»: the style test picture of the chosen style, attached as a STYLE reference to the master and to every
// sheet drawn after it, so the sheets keep the look the person liked in the test (the owner, 22 November 2026: «يطلع لي في
// الصورة التجريبية حلو وبعدين في شيتات سيء حيل»). On by default, in every film (those made before too); the person may switch
// it off, or pick another test picture of the same style. Pure (the sheets page and the server alike).

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

/** The test picture attached to the sheets' drawing, or null (switched off, no style approved yet, or no picture of it). */
export function styleTestRef<P extends Picture>(style: StyleRow | null | undefined, assets: readonly P[], hasFile?: (p: P) => boolean): P | null {
  if (!style || style.status !== "approved" || !testRefOn(style)) return null;
  const pics = styleTestPictures(style, assets, hasFile);
  const wanted = style.data.testRef?.assetId;
  return (wanted ? pics.find((p) => p.id === wanted) : undefined) ?? pics.at(-1) ?? null;
}
