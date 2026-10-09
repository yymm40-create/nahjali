import { describe, expect, it } from "vitest";
import { isSalesAsk, nearestSalesExamples, SALES_EXAMPLES_COUNT, SALES_FORMATS, SALES_METHOD, salesExamples, salesExamplesBrief } from "@config/content-sales";
import { BAQIR_PERSONA } from "@config/content";
import { drawsRealWoman } from "@config/jawad/assistant";

// «محمد باقر» sells by the owner's four steps: the end result, the biggest problem, every risk killed, speed and a
// bonus with an easy entry price — a hook before, one call to action after, and the viewer kept all the way.
const WOMAN = /\b(woman|women|girl|female|lady|she|her)\b|بنت|امرأة|نساء|فتاة|سيدة|عباية|عبايات نسائية/iu;
const STEP_WORDS = ["النتيجة", "المشكلة", "المخاطر", "السرعة", "بونص"];

describe("the selling method", () => {
  it("carries the four steps in order, the hook before, the retention devices and the one CTA after", () => {
    const i = (w: string) => SALES_METHOD.indexOf(w);
    expect(i("1) بِع النتيجة النهائية")).toBeGreaterThan(0);
    expect(i("2) اضرب على أكبر مشكلة")).toBeGreaterThan(i("1) بِع النتيجة النهائية"));
    expect(i("3) اقتل كل المخاطر")).toBeGreaterThan(i("2) اضرب على أكبر مشكلة"));
    expect(i("4) زِد السرعة والبونص")).toBeGreaterThan(i("3) اقتل كل المخاطر"));
    expect(SALES_METHOD).toMatch(/قبل الخطوات/);
    expect(SALES_METHOD).toMatch(/أثناء الخطوات/);
    expect(SALES_METHOD).toMatch(/بعد الخطوات/);
    expect(SALES_METHOD).toMatch(/دعوة واحدة فقط/);
    expect(SALES_METHOD).toMatch(/القيمة = \(النتيجة الحلم × احتمال تحقيقها\)/);
  });

  it("explains the three formats and works a tea example out in full", () => {
    expect(SALES_FORMATS.map((f) => f.id)).toEqual(["carousel", "reel_script", "motion"]);
    for (const f of ["كاروسيل:", "سكربت ريل:", "موشن جرافيكس:"]) expect(SALES_METHOD).toContain(f);
    expect(SALES_METHOD).toMatch(/مثال كامل — شاي/);
    expect(SALES_METHOD).toMatch(/٠–٣ ث \(هوك\)/);
    expect(SALES_METHOD).toMatch(/آخر ثانيتين \(الدعوة\)/);
  });

  it("never invents numbers or guarantees, and asks the person what changes the result", () => {
    expect(SALES_METHOD).toMatch(/لا تخترع أرقامًا أو ضمانات أو شهادات/);
    expect(SALES_METHOD).toMatch(/\[يُؤكّد من العميل\]/);
    expect(SALES_METHOD).toMatch(/اسأل العميل دفعة واحدة/);
  });

  it("is part of محمد باقر's default persona", () => {
    expect(BAQIR_PERSONA).toMatch(/منهج البيع/);
    expect(BAQIR_PERSONA).toMatch(/بِع النتيجة النهائية/);
  });

  it("is brought in only when the person wants to sell", () => {
    expect(isSalesAsk("أبي كاروسيل يبيع شاي")).toBe(true);
    expect(isSalesAsk("اكتب لي إعلان لمتجري")).toBe(true);
    expect(isSalesAsk("منتجي جديد وأبي الناس تطلب")).toBe(true);
    expect(isSalesAsk("أبي كاروسيل تعليمي عن النوم الصحي")).toBe(false);
    expect(isSalesAsk("مرحبا")).toBe(false);
  });
});

describe(`${SALES_EXAMPLES_COUNT} worked sales examples`, () => {
  const list = salesExamples();

  it("are a thousand distinct ones across the three formats and many products", () => {
    expect(list).toHaveLength(SALES_EXAMPLES_COUNT);
    expect(new Set(list.map((e) => `${e.ask}|${e.hook}|${e.outline.join("|")}`)).size).toBe(SALES_EXAMPLES_COUNT);
    for (const f of SALES_FORMATS) expect(list.filter((e) => e.format === f.id).length).toBeGreaterThan(SALES_EXAMPLES_COUNT / 5);
    expect(new Set(list.map((e) => e.product)).size).toBeGreaterThan(30);
  });

  it.each(list.map((e) => [e.id, e] as const))("%s follows the four steps, hooks first, keeps the viewer, ends with one CTA, and draws no woman", (_id, e) => {
    expect(isSalesAsk(e.ask)).toBe(true);
    expect(e.endResult.length).toBeGreaterThan(8);
    expect(e.problem.length).toBeGreaterThan(8);
    expect(e.risks.length).toBeGreaterThanOrEqual(2);
    expect(e.speed).toBeTruthy();
    expect(e.bonus).toBeTruthy();
    expect(e.entry).toMatch(/ريال بدل \d+ \(مشطوب، خصم \d+٪\)/);
    expect(e.hook.split(/\s+/).length).toBeLessThanOrEqual(16);
    expect(e.retention.length).toBeGreaterThanOrEqual(1);
    expect(e.cta).toBeTruthy();
    // the outline opens with the hook and closes with the call to action, with the four steps between, in order
    expect(e.outline[0]).toContain(e.hook);
    expect(e.outline.some((l) => l.includes(e.cta))).toBe(true);
    // (after the hook, which may itself name the problem or the result)
    const pos = (w: string) => e.outline.findIndex((l, i) => i > 0 && l.includes(w));
    expect(pos(e.problem)).toBeGreaterThan(0);
    expect(pos(e.endResult)).toBeGreaterThan(0);
    expect(pos("المخاطر")).toBeGreaterThan(pos(e.problem));
    expect(pos("السرعة")).toBeGreaterThan(pos("المخاطر"));
    if (e.format === "reel_script") {
      expect(e.outline[0]).toMatch(/^٠–٣ ث هوك/);
      expect(e.outline.at(-2)).toMatch(/^آخر ثانيتين الدعوة/);
      expect(e.outline.at(-1)).toMatch(/هوكات بديلة للاختبار/);
    }
    if (e.format === "carousel") {
      expect(e.outline[0]).toMatch(/^١\) الغلاف/);
      expect(e.outline.length).toBeGreaterThanOrEqual(6);
      expect(e.outline.length).toBeLessThanOrEqual(8);
    }
    if (e.format === "motion") {
      expect(e.outline).toHaveLength(8);
      expect(e.outline[0]).toMatch(/^مشهد ١ \(هوك، ٠–٣ ث\)/);
      expect(e.outline[6]).toMatch(/مشطوب/);
    }
    const all = [e.ask, e.hook, e.endResult, e.problem, ...e.risks, e.bonus, e.cta, ...e.outline].join(" ");
    expect(all).not.toMatch(WOMAN);
    expect(drawsRealWoman(all)).toBe(false);
  });

  it("the nearest examples favour the product and the format asked, and the brief carries the four steps", () => {
    const tea = nearestSalesExamples("أبي سكربت ريل يبيع شاي ورق كامل", 3);
    expect(tea[0].product).toMatch(/شاي/);
    expect(tea[0].format).toBe("reel_script");
    const car = nearestSalesExamples("كاروسيل إعلان عود كمبودي", 2);
    expect(car[0].product).toMatch(/عود/);
    expect(car[0].format).toBe("carousel");
    expect(new Set(car.map((e) => `${e.product}:${e.format}`)).size).toBe(car.length);
    const brief = salesExamplesBrief(tea);
    for (const w of STEP_WORDS) expect(brief).toContain(w);
    expect(brief).toContain("الهوك");
    expect(brief).toContain("الدعوة");
    expect(salesExamplesBrief([])).toBe("");
  });
});
