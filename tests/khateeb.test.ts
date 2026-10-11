import { describe, expect, it } from "vitest";
import { cleanSlug, isKhateeb, KHATEEB, KHATEEB_LOOK, khateebRules, readBranch, STUDENT_LOOK } from "@config/jawad/khateeb";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";
import { rulesFor } from "@/lib/rate-limit";
import { readFileSync } from "node:fs";

describe("«الخطيب الذكي»: the link's word", () => {
  it("takes letters, digits and dashes, six to forty long, and nothing else", () => {
    expect(cleanSlug("My-Minbar-9")).toBe("my-minbar-9");
    expect(cleanSlug("abc")).toBe("");
    expect(cleanSlug("a b c d e f")).toBe("");
    expect(cleanSlug("../admin")).toBe("");
    expect(cleanSlug("-abcdef")).toBe("");
    expect(cleanSlug("a".repeat(41))).toBe("");
    expect(cleanSlug(null)).toBe("");
  });
});

describe("«الخطيب الذكي»: the branch", () => {
  it("is told apart from the student's by its name only", () => {
    expect(isKhateeb("khateeb")).toBe(true);
    expect(isKhateeb("student")).toBe(false);
    expect(readBranch("anything")).toBe("student");
    expect(readBranch(undefined)).toBe("student");
    expect(KHATEEB_LOOK.assistant).toBe("الشيخ صادق");
    expect(STUDENT_LOOK.assistant).toBe("صادق");
    expect(KHATEEB.base).toBe("/jawad-ai/khateeb");
  });

  it("tells the writer who he is, and binds him to the owner's method and poems only when they exist", () => {
    const plain = khateebRules("", "");
    expect(plain).toContain("«الشيخ صادق»");
    expect(plain).not.toContain("<method>");
    expect(plain).not.toContain("<poems>");
    const full = khateebRules("١. المقدمة\n٢. الموعظة", "إذا ما رأيت ... ");
    expect(full).toContain("<method>\n١. المقدمة\n٢. الموعظة\n</method>");
    expect(full).toContain("<poems>");
    expect(full).toMatch(/never make up a line/);
  });

  it("limits the guessing of its password", () => {
    expect(rulesFor("/api/khateeb/enter", "POST").some((r) => r.key === "khateeb" && r.max <= 10)).toBe(true);
  });

  it("is listed in no menu and no sitemap, and is told to Claude as a secret", () => {
    expect(JAWAD_KNOWLEDGE).toContain("«الخطيب الذكي»");
    expect(JAWAD_KNOWLEDGE).toMatch(/NEVER mention it[^.]*anyone but the owner/);
    for (const f of ["config/jawad/sections.ts", "src/components/jawad/QuickStart.tsx", "src/components/jawad/JawadHeader.tsx"]) {
      expect(readFileSync(new URL(`../${f}`, import.meta.url), "utf8")).not.toContain("khateeb");
    }
  });

  it("opens only after the link's word and the password, and the pages are not indexed", () => {
    const door = readFileSync(new URL("../src/lib/khateeb/door.ts", import.meta.url), "utf8");
    expect(door.indexOf("notFound();")).toBeLessThan(door.indexOf("await doorOpen("));
    expect(door.indexOf("await doorOpen(")).toBeLessThan(door.indexOf("await requireJawadUser("));
    const page = readFileSync(new URL("../src/app/jawad-ai/khateeb/[slug]/page.tsx", import.meta.url), "utf8");
    expect(page).toContain("index: false");
  });
});

// ───────────────────────────── the sermon ─────────────────────────────
import { docHtml } from "@/lib/jawad/student/render/html";
import { autoSettings } from "@/lib/jawad/student/defaults";
import { settingsParts } from "@/lib/jawad/student/summary";
import { defaultDesign, DOC_KINDS, FORMATS, OUTPUT_KINDS } from "@config/jawad/student";
import { kindOffered, readSermonLength, SERMON_LENGTHS } from "@config/jawad/khateeb";
import type { Doc } from "@/lib/jawad/student/model";

describe("«خطبة المنبر»", () => {
  const block = (t: string, text: string) => ({ t, text, title: "", items: [], rows: [], sources: [], segments: [] }) as unknown as Doc["chapters"][number]["blocks"][number];
  const doc: Doc = { title: "خطبة", subtitle: "", chapters: [{ title: "المقدمة", blocks: [block("p", "نص")] }, { title: "الموعظة", blocks: [block("p", "نص آخر")] }] } as Doc;

  it("is offered only in the hidden branch, first", () => {
    expect(kindOffered("khateeb", "sermon")).toBe(true);
    expect(kindOffered("student", "sermon")).toBe(false);
    expect(kindOffered(undefined, "sermon")).toBe(false);
    expect(kindOffered("student", "summary")).toBe(true);
    expect(OUTPUT_KINDS[0].kind).toBe("sermon");
    expect(DOC_KINDS).toContain("sermon");
  });

  it("has three lengths, short to long, medium when none is said", () => {
    expect(SERMON_LENGTHS.map((l) => l.id)).toEqual(["short", "medium", "long"]);
    const w = SERMON_LENGTHS.map((l) => l.words);
    expect(w[0]).toBeLessThan(w[1]);
    expect(w[1]).toBeLessThan(w[2]);
    expect(readSermonLength("long").id).toBe("long");
    expect(readSermonLength("nonsense").id).toBe("medium");
    expect(readSermonLength(undefined).id).toBe("medium");
  });

  it("comes with both files (PDF and editable Word) and a length, summarised for the panel", () => {
    const s = autoSettings("sermon", "");
    expect(s.format).toBe("both");
    expect(s.length).toBe("medium");
    expect(FORMATS.some((f) => f.id === "both")).toBe(true);
    const parts = settingsParts("sermon", { length: "short", format: "docx" });
    expect(parts[0]).toContain("قصيرة");
    expect(parts[1]).toContain("Word");
  });

  it("is printed plain: no cover, no contents, no chapter labels", () => {
    const html = docHtml(doc, defaultDesign("editorial"), { fontFaces: "", plain: true });
    expect(html).not.toContain('class="cover');
    expect(html).not.toContain('class="toc');
    expect(html).not.toContain("الفصل");
    expect(html).toContain("المقدمة");
    const book = docHtml(doc, defaultDesign("editorial"), { fontFaces: "" });
    expect(book).toContain('class="cover');
    expect(book).toContain("الفصل");
  });

  it("is wired into the writer: its own words budget from its length, spread over its four parts", () => {
    const src = readFileSync(new URL("../src/lib/jawad/student/outputs.ts", import.meta.url), "utf8");
    expect(src).toContain('o.kind === "sermon"');
    expect(src).toContain("readSermonLength(o.settings.length).words");
    expect(src).toContain("SERMON_PARTS[i]?.share");
  });

  it("has a link of its own from the start, with no password unless the owner sets one", () => {
    expect(cleanSlug(KHATEEB.defaultSlug)).toBe(KHATEEB.defaultSlug);
    const gate = readFileSync(new URL("../src/lib/khateeb/gate.ts", import.meta.url), "utf8");
    expect(gate).toContain("if (!kv.password) return true;");
    expect(gate).toContain("cleanSlug(kv.slug) || KHATEEB.defaultSlug");
  });
});
