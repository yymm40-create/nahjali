import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DOWNLOADS } from "@config/downloads";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";
import { ar } from "@/lib/mahdi/i18n/ar";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

// «لما الشخص يضغط على اسمه في الجوال يطلع له زر تحميل التطبيق»: the account button — the one the person presses on
// their own name — carries the way to /download, and it hides itself inside the app, which is already downloaded.
describe("«📲 حمّل التطبيق» where the person presses their name", () => {
  it("is in JAWAD AI's account menu, and hidden inside the app", () => {
    const menu = read("src/components/jawad/AccountMenu.tsx");
    expect(menu).toContain('href="/download"');
    expect(menu).toContain("حمّل التطبيق");
    // the line that carries it carries «hide-in-app» too (globals.css hides it under html[data-native-app])
    const line = menu.split("\n").find((l) => l.includes('href="/download"'))!;
    expect(line).toContain("hide-in-app");
  });

  it("is in «لأجل المهدي»'s account section, with its words in the Arabic file", () => {
    const more = read("src/app/mahdi/(app)/more/page.tsx");
    expect(more).toContain('href="/download"');
    expect(more).toContain("t.more.getApp");
    const line = more.split("\n").find((l) => l.includes('href="/download"'))!;
    expect(line).toContain("hide-in-app");
    expect(ar.more.getApp).toBe("حمّل التطبيق");
    expect(ar.more.getAppHint.length).toBeGreaterThan(10);
  });

  it("keeps the older way in too: the site's own menu and its home card", () => {
    expect(read("src/components/Header.tsx")).toContain('href="/download"');
    expect(read("src/components/HomeLanding.tsx")).toContain('href="/download"');
  });
});

describe("the download page itself", () => {
  it("names every device, and the iPhone's real way in while the App Store is still «قريبًا»", () => {
    const page = read("src/app/download/Downloads.tsx");
    for (const os of ["android", "ios", "mac", "windows"]) expect(page, os).toContain(`os: "${os}"`);
    // nothing claims an App Store page the owner has not published
    expect(DOWNLOADS.ios).toBeNull();
    expect(page).toContain("قريبًا في App Store");
    // so the iPhone is walked through Safari's own «إضافة إلى الشاشة الرئيسية», step by step
    expect(page).toContain("إضافة إلى الشاشة الرئيسية");
    expect(page).toContain("زر المشاركة");
  });

  it("is in what Claude knows about the site, with the account button as its door", () => {
    expect(JAWAD_KNOWLEDGE).toContain("/download");
    expect(JAWAD_KNOWLEDGE).toContain("حمّل التطبيق");
  });
});
