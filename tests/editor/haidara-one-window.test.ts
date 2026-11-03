// «حيدرا ماكس» and «مختبر الموشن» are ONE window: the lab runs inside his conversation, results go on the timeline by
// themselves, and the edit has several conversations.
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chatParam, conversationList, MAIN, MAIN_TITLE, mainRow, mergeStream, routeOf, saysEnough, timeOf } from "@/components/jawad/editor/haidara-chats";
import { NEW_TITLE } from "@/components/jawad/editor/lab-tabs";
import { inConversation } from "@/lib/editor/chat";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";

const read = (p: string) => readFileSync(p, "utf8");

describe("which conversation the server is told", () => {
  it("nothing for the main one, its id once kept, a name of its own before", () => {
    expect(chatParam({ id: MAIN, chatId: "x" })).toBeUndefined();
    expect(chatParam({ id: "ab12", chatId: "11111111-2222-3333-4444-555555555555" })).toBe("11111111-2222-3333-4444-555555555555");
    expect(chatParam({ id: "ab12" })).toBe("new:ab12");
  });

  it("the route hands the conversation on (cleaned), or the project as it is", () => {
    const p = { id: "p" } as never;
    expect(inConversation(p, undefined)).toBe(p);
    expect(inConversation(p, "")).toBe(p);
    expect((inConversation(p, "new:ab12") as { conversation?: string }).conversation).toBe("new:ab12");
    expect((inConversation(p, "a b<c>") as { conversation?: string }).conversation).toBe("abc");
  });
});

describe("the list of conversations", () => {
  const rows = [
    { id: "r1", title: "إعلان القهوة", updated_at: "2026-11-02T10:00:00Z" },
    { id: "rm", title: "x", updated_at: "2026-11-01T10:00:00Z", main: true },
    { id: "r2", title: "", updated_at: "2026-10-30T10:00:00Z" },
  ];
  it("the main one first (its motion row folded in), then the kept ones, then the ones not kept yet", () => {
    expect(mainRow(rows)).toBe("rm");
    const l = conversationList(rows, [{ id: MAIN, title: "" }, { id: "t1", title: "قهوة", chatId: "r1" }, { id: "t2", title: "جديدة" }]);
    expect(l.map((o) => o.key)).toEqual([MAIN, "r1", "r2", "tab:t2"]);
    expect(l[0]).toMatchObject({ title: MAIN_TITLE, chatId: "rm", main: true, tab: MAIN });
    expect(l[1].tab).toBe("t1");
    expect(l[2]).toMatchObject({ title: NEW_TITLE, tab: null });
  });
  it("before the list comes, the main one is there", () => {
    expect(conversationList(null, [{ id: MAIN, title: "" }]).map((o) => o.key)).toEqual([MAIN]);
  });
});

describe("where a message goes", () => {
  it("to the edit unless a motion piece has the conversation", () => {
    expect(routeOf("خلّ اللون ذهبي", { focus: false, lab: true })).toBe("editor");
    expect(routeOf("خلّ اللون ذهبي", { focus: true, lab: false })).toBe("editor");
    expect(routeOf("خلّ اللون ذهبي", { focus: true, lab: true })).toBe("lab");
    expect(routeOf("اعتمد وابنِ", { focus: true, lab: true })).toBe("lab");
  });
  it("what is plainly about the edit, and attached files, go to the edit", () => {
    expect(routeOf("حط كابشن للفيديو", { focus: true, lab: true })).toBe("editor");
    expect(routeOf("قص السكتات الطويلة", { focus: true, lab: true })).toBe("editor");
    expect(routeOf("شوف هالصورة", { focus: true, lab: true, pending: 1 })).toBe("editor");
  });
  it("«🌐 ابحث» on: the piece's web search", () => {
    expect(routeOf("وش الترند", { focus: false, lab: true, search: true })).toBe("lab");
  });
});

describe("a scenario approved by itself", () => {
  it("when the person said to go ahead, or wrote a whole brief with its length", () => {
    expect(saysEnough("سوّ لي موشن")).toBe(false);
    expect(saysEnough("سوّ لي موشن لشعاري على طول")).toBe(true);
    expect(saysEnough("ابنه مباشرة")).toBe(true);
    expect(saysEnough("إعلان ١٥ ثانية لمقهى في الرياض، يبدأ بفنجان يطيح ببطء والبن يتناثر، بعدين الاسم ينبني من حبوب القهوة بلون ذهبي على أسود، وفي الآخر العنوان والشعار وجملة تعال جرّبنا اليوم")).toBe(true);
    expect(saysEnough("ابي موشن حلو لاسم المحل بالذهبي وفيه حركة قوية وشعار في النهاية وجملة ترحيبية للزبائن الجدد والقدامى كلهم مع موسيقى")).toBe(false);
  });
});

describe("one stream", () => {
  it("the edit's and the piece's turns, merged by time, each in its own order", () => {
    expect(mergeStream([1, 5, 9], [2, 3, 10])).toEqual([
      { k: "e", i: 0 },
      { k: "l", i: 0 },
      { k: "l", i: 1 },
      { k: "e", i: 1 },
      { k: "e", i: 2 },
      { k: "l", i: 2 },
    ]);
    // turns kept from before times were kept take the one before them (they never jump ahead)
    expect(mergeStream([undefined, 4], [undefined, 3])).toEqual([
      { k: "e", i: 0 },
      { k: "l", i: 0 },
      { k: "l", i: 1 },
      { k: "e", i: 1 },
    ]);
    expect(timeOf("2026-11-03T08:00:00Z")).toBe(Date.parse("2026-11-03T08:00:00Z"));
    expect(timeOf("nope")).toBeUndefined();
  });
});

describe("the window", () => {
  const editor = read("src/components/jawad/editor/Editor.tsx");
  const panel = read("src/components/jawad/editor/AssistantPanel.tsx");
  const lab = read("src/components/jawad/editor/MotionLab.tsx");

  it("has no separate lab button or window", () => {
    expect(existsSync("src/components/jawad/editor/MotionLabTabs.tsx")).toBe(false);
    expect(editor).not.toContain("MotionLabTabs");
    expect(editor).not.toContain("مختبر الموشن</span>");
    expect(lab).not.toContain("createPortal");
    expect(lab).not.toContain("mlab-overlay");
  });

  it("runs the lab inside حيدرا ماكس's conversation, driven by his composer", () => {
    expect(panel).toContain("<MotionLab");
    expect(panel).toContain("render={layout}");
    expect(panel).toContain("piece.start({ brief: q.prompt");
    expect(panel).toContain("auto: saysEnough(message)");
    expect(panel).toContain("await lab.send(message)");
  });

  it("puts a finished piece on the timeline by itself, and a later change replaces that clip", () => {
    expect(lab).toContain("if (placing()) setPlaceNext(n);");
    expect(lab).toContain("const replacing = placedId ?? initialSource?.assetId ?? null;");
    expect(lab).toContain('k: "placed"');
    expect(lab).toContain("↩️ تراجع");
    expect(editor).toContain("const unplaceFilm = ");
    expect(editor).toContain("return placed;");
  });

  it("keeps deep links: «?lab=» and a lab film opened again open his window", () => {
    expect(editor).toContain("labChat && !project.purged ? { n: 1, chatId: labChat }");
    expect(editor).toContain("setHaidaraOpen((o) => ({ n: (o?.n ?? 0) + 1, source: { assetId, source, params, auto } }))");
  });

  it("has several conversations, kept on the server without a new table", () => {
    expect(panel).toContain("محادثة جديدة");
    expect(panel).toContain("lab_chat_rename");
    expect(panel).toContain("lab_chat_del");
    expect(read("src/lib/editor/lab-chats.ts")).toContain("main:state->main");
  });

  it("is told as it is now", () => {
    expect(JAWAD_KNOWLEDGE).toContain("ARE ONE WINDOW");
    expect(JAWAD_KNOWLEDGE).toContain("RESULTS GO ON THE TIMELINE BY THEMSELVES");
    expect(JAWAD_KNOWLEDGE).toContain("SEVERAL CONVERSATIONS");
  });
});
