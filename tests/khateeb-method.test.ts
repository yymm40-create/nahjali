import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_METHOD, MAJMA, SERMON_PARTS, ablibraryUrl, khateebRules } from "@config/jawad/khateeb";
import { contentText, messages, readFields } from "@/lib/khateeb/ablibrary";
import { align, candidates, norm, openingWords, plain } from "@/lib/khateeb/tafsir";
import { onPage, sermonBrief } from "@/lib/jawad/student/sermon";
import { bookIdOf, parsePages, textOf, titleOf } from "@/lib/khateeb/alhassanain";
import { readRefKind } from "@/lib/khateeb/reference";
import type { DocPlan } from "@/lib/jawad/student/model";
import type { Output } from "@/lib/jawad/student/db";

// ───────────────────────────── protobuf, as the site sends it ─────────────────────────────
const varint = (n: number) => {
  const out: number[] = [];
  let v = n;
  for (;;) {
    const b = v & 0x7f;
    v = Math.floor(v / 128);
    if (v) out.push(b | 0x80);
    else {
      out.push(b);
      return out;
    }
  }
};
const lenField = (f: number, b: number[]) => [...varint((f << 3) | 2), ...varint(b.length), ...b];
const strField = (f: number, s: string) => lenField(f, [...new TextEncoder().encode(s)]);
const intField = (f: number, n: number) => [...varint(f << 3), ...varint(n)];
const frame = (flag: number, b: number[]) => {
  const out = new Uint8Array(5 + b.length);
  new DataView(out.buffer).setUint32(1, b.length);
  out[0] = flag;
  out.set(b, 5);
  return out;
};

describe("the method «المرجعية المأمونة»", () => {
  it("is the default method, its five steps and its four parts", () => {
    for (const step of ["الخطوة ١", "الخطوة ٢", "الخطوة ٣", "الخطوة ٤", "الخطوة ٥"]) expect(DEFAULT_METHOD).toContain(step);
    for (const p of SERMON_PARTS) expect(DEFAULT_METHOD).toContain(p.title);
    expect(SERMON_PARTS.map((p) => p.title)).toEqual(["المقدمة", "صلب المجلس", "الخاتمة والتخلّص (الكَوْريز)", "الرثاء"]);
    expect(SERMON_PARTS.reduce((a, p) => a + p.share, 0)).toBeCloseTo(1, 5);
    expect(khateebRules(DEFAULT_METHOD, "")).toContain("<method>");
  });

  it("takes the tafsir from مجمع البيان, ten volumes, and links to the library", () => {
    expect(MAJMA.volumes).toHaveLength(10);
    expect(new Set(MAJMA.volumes).size).toBe(10);
    expect(ablibraryUrl(3876, 155)).toBe("https://ablibrary.net/books/3876?page=155");
    expect(ablibraryUrl(3876)).toBe("https://ablibrary.net/books/3876");
  });
});

describe("the library's gRPC-web answers", () => {
  it("reads the frames of an answer, and refuses one that ends with an error", () => {
    const ok = messages(new Uint8Array([...frame(0, [1, 2, 3]), ...frame(0, [4]), ...frame(0x80, [...new TextEncoder().encode("grpc-status: 0\r\n")])]));
    expect(ok?.map((m) => [...m])).toEqual([[1, 2, 3], [4]]);
    expect(messages(new Uint8Array([...frame(0, [1]), ...frame(0x80, [...new TextEncoder().encode("grpc-status: 5\r\n")])]))).toBeNull();
  });

  it("reads strings, numbers and nested messages (a page's text and number)", () => {
    const text = (s: string) => lenField(24, strField(1, s));
    const page = [...intField(3, 155), ...strField(4, "157"), ...lenField(7, [...lenField(10, text("لستن كأحد")), ...lenField(10, text(" من النساء"))])];
    const f = readFields(new Uint8Array(page));
    expect(f.find((x) => x.f === 3)?.v).toBe(155);
    expect(new TextDecoder().decode(f.find((x) => x.f === 4)?.v as Uint8Array)).toBe("157");
    const content = f.find((x) => x.f === 7)!.v as Uint8Array;
    expect(contentText(content)).toBe("لستن كأحد من النساء");
  });

  it("puts paragraphs on their own lines", () => {
    const t = (s: string) => lenField(24, strField(1, s));
    const para = (s: string) => lenField(10, [...lenField(17, []), ...lenField(10, t(s))]);
    const out = contentText(new Uint8Array([...para("أول"), ...para("ثاني")]));
    expect(out.trim().split(/\n+/)).toEqual(["أول", "ثاني"]);
  });
});

describe("finding where a verse's tafsir is", () => {
  it("compares a heading with a verse without marks and alef spellings", () => {
    expect(norm("وَمَن جَٰهَدَ فَإِنَّمَا يُجَٰهِدُ لِنَفْسِهِۦ")).toBe(norm("ومن جاهد فإنما يجاهد لنفسه"));
    expect(plain("ٱللَّهُ لَآ إِلَٰهَ")).toBe("الله لا اله");
  });

  it("takes a heading's opening words, without the surah's name line or «إلى قوله…»", () => {
    expect(openingWords("سورة العنكبوت\nألم ، إلى قوله وهو السميع العليم")).toEqual(norm("ألم").split(" "));
    expect(openingWords("وإذ قال موسى لقومه إلى قوله فذبحوها وما كادوا يفعلون")).toEqual(norm("وإذ قال موسى لقومه").split(" "));
    expect(openingWords("ومن جاهد فإنما يجاهد لنفسه . . .")).toEqual(norm("ومن جاهد فإنما يجاهد لنفسه").split(" "));
  });

  it("finds the verses a heading can open, none when there are too many to tell", () => {
    const verses = ["يا ايها الذين امنوا اتقوا الله", "ان الله غفور رحيم", "يا ايها الذين امنوا اطيعوا الله"].map(norm);
    expect(candidates(verses, norm("ان الله غفور رحيم").split(" "))).toEqual([1]);
    expect(candidates(verses, norm("يا أيها الذين آمنوا").split(" "))).toEqual([0, 2]);
    expect(candidates(verses, ["ولا", "شيء", "هنا"])).toEqual([]);
    const many = Array.from({ length: 30 }, () => norm("يا أيها الذين آمنوا"));
    expect(candidates(many, norm("يا أيها الذين آمنوا").split(" "))).toEqual([]);
  });

  it("keeps the longest run that goes forward through the Quran and drops a wrong guess", () => {
    // headings 0..5; heading 2 also matches a verse far ahead (a repeated phrase): its true place is 12
    const at = align([[3], [7], [12, 5000], [20], [25, 2], [31]]);
    expect(at).toEqual([3, 7, 12, 20, 25, 31]);
    // a heading with a place before the one that came before it is dropped (a run never goes backwards)
    const run = align([[10], [4], [20]]).filter((x): x is number => x !== null);
    expect(run).toHaveLength(2);
    expect(run[0]).toBeLessThan(run[1]);
    expect(align([[], [5], []])).toEqual([null, 5, null]);
  });
});

describe("what the writer of a sermon part is told", () => {
  const plan: DocPlan = {
    title: "ت",
    subtitle: "",
    chapters: SERMON_PARTS.map((p) => ({ title: p.title, purpose: p.role, segments: [], image: { mode: "none", sourceId: "", prompt: "", path: "" } })),
    sermon: {
      topics: [{ title: "العلم نور", idea: "فكرة", kooriz: "ربط بالمصيبة", verse: { surah: 33, from: 33, to: 33, ref: "سورة الأحزاب: ٣٣", text: "إِنَّمَا يُرِيدُ ٱللَّهُ ﴿٣٣﴾" } }],
      chosen: 0,
      tafsir: { source: "مجمع البيان — ج٨، ص١٥٥", url: "https://ablibrary.net/books/3876?page=155", excerpt: "…", simple: "الآية تدل على العصمة (ص١٥٦)", manual: false },
    },
  };
  const o = { settings: { poemsFor: "الحكمة", poems: "إذا ما رأيت ..." } } as unknown as Output;

  it("gives the verse as the Quran has it, the tafsir with its source, the takhallus point and the part's role", () => {
    const b = sermonBrief(plan, o, 0);
    expect(b).toContain("إِنَّمَا يُرِيدُ ٱللَّهُ ﴿٣٣﴾");
    expect(b).toContain("quote it EXACTLY");
    expect(b).toContain("مجمع البيان — ج٨، ص١٥٥");
    expect(b).toContain("الآية تدل على العصمة");
    expect(b).toContain("ربط بالمصيبة");
    expect(b).toContain("الحكمة");
    expect(b).toContain("إذا ما رأيت");
    expect(b).toContain(`THIS PART — ${SERMON_PARTS[0].title}`);
    expect(sermonBrief(plan, o, 3)).toContain(`THIS PART — ${SERMON_PARTS[3].title}`);
  });

  it("forbids interpreting the verse or inventing poetry when none was given", () => {
    const bare: DocPlan = { ...plan, sermon: { ...plan.sermon!, tafsir: null } };
    const b = sermonBrief(bare, { settings: {} } as unknown as Output, 1);
    expect(b).toContain("NO TAFSIR WAS GIVEN");
    expect(b).toMatch(/never make up a line/);
  });
});

describe("the sermon's steps are wired", () => {
  const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  it("has its own plan, its tafsir job and its actions, and waits for the pick before the plan is approved", () => {
    expect(read("src/lib/jawad/student/outputs.ts")).toContain("sermonPlanStep(o, c, base, STUDENT_FIRST)");
    expect(read("src/lib/jawad/student/handlers.ts")).toContain("tafsir: tafsirHandler");
    expect(read("src/lib/jawad/student/jobs.ts")).toMatch(/CLAUDE_ONLY_KINDS = new Set\(\[[^\]]*"tafsir"/);
    const actions = read("src/lib/jawad/student/actions.ts");
    for (const a of ["sermon_choose", "sermon_edit", "sermon_tafsir_manual", "sermon_tafsir"]) expect(actions).toContain(`case "${a}"`);
    expect(actions).toMatch(/o\.kind === "sermon" && sermonOf\(o\)\.chosen < 0/);
    // the browser never writes the topics, the pick or the tafsir through «حفظ الخطة»
    expect(actions).toContain("sermon: (prev as { sermon: SermonPlan }).sermon");
    // the autopilot stops at the topic
    expect(read("src/components/jawad/student/autopilot.ts")).toMatch(/sp\.chosen < 0\) return null/);
  });
});

describe("مرجع الأشعار", () => {
  const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  const page = { text: "# قصيدة في الصبر\nإذا ضاق الزمان فكن صبورًا … فإن الصبر مفتاح الفرجِ\nوما نيل المنى بالتمني … ولكن تؤخذ الدنيا غِلابا" };

  it("keeps only the lines that are really on the page (without marks and alef spellings)", () => {
    expect(onPage("إِذَا ضَاقَ الزَّمَانُ فَكُنْ صَبُورًا فَإِنَّ الصَّبْرَ مِفْتَاحُ الْفَرَجِ", page)).toContain("ضَاقَ");
    // a line the model made up is dropped (the true one beside it stays), and so is a passage whose every line is made up
    expect(onPage("إذا ضاق الزمان فكن صبورا ... فإن الصبر مفتاح الفرج\nبيت لم يطبعه الكتاب أبدا في هذه الصفحة", page)).toBe("إذا ضاق الزمان فكن صبورا ... فإن الصبر مفتاح الفرج");
    expect(onPage("بيت ملفق لا وجود له في الصفحة إطلاقا", page)).toBe("");
    expect(onPage("إذا ضاق الزمان فكن صبورا … فإن الصبر مفتاح الفرج\nوما نيل المنى بالتمني … ولكن تؤخذ الدنيا غلابا", page).split("\n")).toHaveLength(2);
  });

  it("tells the writer the lines with their page, to print it in the finished sermon", () => {
    const plan = {
      title: "ت",
      subtitle: "",
      chapters: [],
      sermon: { topics: [], chosen: -1, tafsir: null, poems: [{ text: "بيت أول", poet: "المتنبي", page: "٣٤", ref: "ديوان المتنبي", why: "يخدم الصبر" }] },
    } as unknown as DocPlan;
    const b = sermonBrief(plan, { settings: {} } as unknown as Output, 1);
    expect(b).toContain("بيت أول");
    expect(b).toContain("المرجع: ديوان المتنبي، ص٣٤");
    expect(b).toContain("الشاعر: المتنبي");
    expect(b).toContain("page number is printed");
  });

  it("is uploaded straight to storage, read page by page, owner only", () => {
    const route = read("src/app/api/khateeb/reference/route.ts");
    expect(route.match(/requireJawadOwner\(\)/g)).toHaveLength(2);
    expect(route).toContain('case "step"');
    const ref = read("src/lib/khateeb/reference.ts");
    expect(ref).toContain("createSignedUploadUrl");
    expect(ref).toContain("REF_PAGES_PER_CALL");
    // the file never goes through a request body of ours: no page limit but the storage's own
    expect(ref).not.toMatch(/maxPages|MAX_REF_PAGES/);
    const sql = read("supabase/migrations/0067_khateeb_reference.sql");
    for (const t of ["khateeb_refs", "khateeb_ref_pages", "enable row level security"]) expect(sql).toContain(t);
  });

  it("is searched by a job the preacher asks for (a paid one), wired like the tafsir", () => {
    expect(read("src/lib/jawad/student/handlers.ts")).toContain("poems: poemsHandler");
    expect(read("src/lib/jawad/student/jobs.ts")).toMatch(/CLAUDE_ONLY_KINDS = new Set\(\[[^\]]*"poems"/);
    expect(read("src/lib/jawad/student/actions.ts")).toContain('case "sermon_poems"');
  });
});

describe("a book of شبكة الإمامين الحسنين brought in as text", () => {
  it("takes a book's number from a number or from a link of that site only", () => {
    expect(bookIdOf("343")).toBe(343);
    expect(bookIdOf(" 343 ")).toBe(343);
    expect(bookIdOf("http://alhassanain.org/arabic/?com=book&id=343&page=124")).toBe(343);
    expect(bookIdOf("https://www.alhassanain.org/arabic/?com=book&id=77")).toBe(77);
    expect(bookIdOf("https://evil.example/arabic/?com=book&id=343")).toBeNull();
    expect(bookIdOf("http://alhassanain.org.evil.example/?id=1")).toBeNull();
    expect(bookIdOf("abc")).toBeNull();
    expect(bookIdOf("")).toBeNull();
  });

  const html = `<html><head><title>شبكة الإمامين الحسنين عليهما السلام الثقافية - من شواهد المبلغين</title></head><body>
<a name='1'></a><p>من شواهد المـُبلِّغين</p>
<a name='2'></a><p></p>
<a name='123'></a><p class=x>(الشاهد (27) )</p><p>أبكي لسبي عمَّتي زينب</p><p>قال<br>عليه&zwnj;السلام<br>: لا &amp; لو كان حاضراً لبكى.</p><script>var x=1</script>
<a name='124'></a><p>الصفحة التالية</p></body></html>`;

  it("cuts the book at its page marks, drops pages with no text, and keeps the page numbers", () => {
    const pages = parsePages(html);
    expect(pages.map((p) => p.label)).toEqual(["1", "123", "124"]);
    expect(pages[1].text).toContain("(الشاهد (27) )");
    expect(pages[1].text).toContain("أبكي لسبي عمَّتي زينب");
    expect(pages[1].text).not.toContain("var x");
    expect(pages[1].text).toContain("لا & لو كان");
  });

  it("makes text of tags and entities, and finds the book's title", () => {
    expect(textOf("<p>أول</p><p>ثاني&nbsp;&#1575;&#x644;</p>")).toBe("أول\nثاني ال");
    expect(titleOf(html)).toBe("من شواهد المبلغين");
  });

  it("reads a reference's kind as poetry unless it says source", () => {
    expect(readRefKind("source")).toBe("source");
    expect(readRefKind("poetry")).toBe("poetry");
    expect(readRefKind(undefined)).toBe("poetry");
    expect(readRefKind("other")).toBe("poetry");
  });

  it("gives the writer the library's passages to retell faithfully, with their pages", () => {
    const plan = { title: "ت", subtitle: "", chapters: [], sermon: { topics: [], chosen: -1, tafsir: null, sources: [{ text: "نقل عن الخطيب قصة", poet: "الشاهد (27) أبكي لسبي عمتي زينب", page: "124", ref: "من شواهد المبلغين", why: "يخدم الموضوع" }] } } as unknown as DocPlan;
    const b = sermonBrief(plan, { settings: {} } as unknown as Output, 1);
    expect(b).toContain("FAITHFULLY");
    expect(b).toContain("نقل عن الخطيب قصة");
    expect(b).toContain("المرجع: من شواهد المبلغين، ص124");
    expect(b).toContain("الشاهد (27)");
  });

  it("is chosen from the library by the preacher, and imported by the owner", () => {
    const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    expect(read("src/app/api/khateeb/reference/route.ts")).toContain('case "import"');
    expect(read("src/lib/jawad/student/actions.ts")).toContain('case "sermon_sources"');
    expect(read("src/app/api/khateeb/library/route.ts")).toContain("requireStudentApiUser");
    expect(read("supabase/migrations/0068_khateeb_ref_kind.sql")).toContain("'source'");
  });
});

