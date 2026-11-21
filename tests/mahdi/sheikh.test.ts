import { describe, expect, it } from "vitest";
import { cleanQuestion, finalAnswer, inOrder, linkPieces, pendingAsks, plainAnswer, runState, sheikhLeft, sheikhMessage, type AgentEvent } from "@/lib/mahdi/sheikh";

const msg = (text: string): AgentEvent => ({ type: "agent.message", content: [{ type: "text", text }] });
const long = "روي عن الإمام الصادق عليه السلام ".repeat(20);

describe("«اسأل الشيخ»", () => {
  it("counts the allowance per window", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();
    expect(sheikhLeft("quick", [hoursAgo(1), hoursAgo(2), hoursAgo(30)], now)).toBe(3);
    expect(sheikhLeft("quick", Array.from({ length: 7 }, (_, i) => hoursAgo(i)), now)).toBe(0);
    expect(sheikhLeft("deep", [hoursAgo(24), hoursAgo(24 * 8)], now)).toBe(1);
  });

  it("tells the agent the kind of question first", () => {
    expect(sheikhMessage("quick", "  دعاء الفرج ")).toBe("[سؤال سريع] دعاء الفرج");
    expect(sheikhMessage("deep", "الكرب")).toBe("[بحث شامل] الكرب");
  });

  it("keeps a question between 3 and 800 letters", () => {
    expect(cleanQuestion("  ما فضل زيارة عاشوراء؟ ")).toBe("ما فضل زيارة عاشوراء؟");
    expect(cleanQuestion("ab")).toBeNull();
    expect(cleanQuestion("x".repeat(801))).toBeNull();
    expect(cleanQuestion(5)).toBeNull();
  });

  it("takes the last message after the question, not the notes between tools", () => {
    const events: AgentEvent[] = [
      { type: "user.message", content: [{ type: "text", text: "[سؤال سريع] س" }] },
      msg("Use curl and extract Arabic text."),
      { type: "agent.tool_use" },
      msg(long),
      { type: "session.status_idle", stop_reason: { type: "end_turn" } },
    ];
    expect(finalAnswer(events)).toBe(long.trim());
    expect(runState(events)).toBe("done");
  });

  it("keeps the long answer when a short line follows it", () => {
    const events: AgentEvent[] = [{ type: "user.message" }, msg(long), msg("الملف جاهز.")];
    expect(finalAnswer(events)).toBe(`${long.trim()}\n\nالملف جاهز.`);
  });

  it("knows a run still going, waiting, or ended", () => {
    expect(runState([{ type: "user.message" }, { type: "session.status_running" }])).toBe("running");
    expect(runState([{ type: "session.status_idle", stop_reason: { type: "requires_action" } }])).toBe("waiting");
    expect(runState([{ type: "session.status_terminated" }])).toBe("terminated");
  });

  it("finds tool calls waiting for a decision", () => {
    const events: AgentEvent[] = [
      { type: "agent.tool_use", id: "a", evaluated_permission: "ask" },
      { type: "agent.tool_use", id: "b", evaluated_permission: "allow" },
      { type: "agent.tool_use", id: "c", evaluated_permission: "ask" },
      { type: "user.tool_confirmation", tool_use_id: "a" },
    ];
    expect(pendingAsks(events)).toEqual(["c"]);
  });

  it("orders events by their time", () => {
    const e = inOrder([
      { id: "2", processed_at: "2026-11-22T00:00:02Z" },
      { id: "1", processed_at: "2026-11-22T00:00:01Z" },
    ]);
    expect(e.map((x) => x.id)).toEqual(["1", "2"]);
  });

  it("makes the sources tappable and drops Markdown marks", () => {
    expect(linkPieces("الرابط: https://thaqalayn.com/hadith/2/2/55/14.")).toEqual([
      { t: "text", v: "الرابط: " },
      { t: "link", v: "https://thaqalayn.com/hadith/2/2/55/14" },
      { t: "text", v: "." },
    ]);
    expect(plainAnswer("## عنوان\n**مهم** نص\n- بند")).toBe("عنوان\nمهم نص\n• بند");
  });
});
