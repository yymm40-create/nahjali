import { describe, expect, it } from "vitest";
import { CLAUDE_MARGIN_PCT, CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL, claudeModelOf, servedModel, typicalReplyUsd } from "@config/claude-models";
import { claudeHalalas, costHalalas, coinsFor, setPricing } from "@config/coins";
import { claudeCost, withModel, type ClaudeUsage } from "@/lib/film/anthropic";
import { currentClaude, withClaude } from "@/lib/film/claude-model";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";

const usage = (o: Partial<ClaudeUsage> = {}): ClaudeUsage => ({ input_tokens: 10_000, output_tokens: 1_000, ...o });

describe("the four Claude models", () => {
  it("are Fable 5.1, Opus 5.5, Sonnet 5.5 and Haiku 5.5, each with its advice", () => {
    expect(CLAUDE_MODELS.map((m) => m.id)).toEqual(["claude-fable-5-1", "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]);
    for (const m of CLAUDE_MODELS) expect(m.advice.length, m.id).toBeGreaterThan(20);
    expect(claudeModelOf("claude-fable-5-1").advice).toContain("المعقدة جدًا");
  });

  it("falls back to the default for anything unknown", () => {
    expect(claudeModelOf("gpt-5").id).toBe(DEFAULT_CLAUDE_MODEL);
    expect(claudeModelOf(undefined).id).toBe(DEFAULT_CLAUDE_MODEL);
    expect(servedModel("claude-sonnet-5-5-20261001")?.key).toBe("sonnet");
    expect(servedModel("something-else")).toBeNull();
  });

  it("price by their own rates (a dearer model costs more for the same usage)", () => {
    const cost = (id: string) => claudeCost(usage(), claudeModelOf(id));
    expect(cost("claude-opus-5-5")).toBeCloseTo((10_000 * 4 + 1_000 * 20) / 1e6, 8);
    expect(cost("claude-fable-5-1")).toBeGreaterThan(cost("claude-opus-5-5"));
    expect(cost("claude-opus-5-5")).toBeGreaterThan(cost("claude-sonnet-5-5"));
    expect(cost("claude-sonnet-5-5")).toBeGreaterThan(cost("claude-haiku-5-5"));
  });

  it("Haiku costs more for a prompt over 100,000 tokens", () => {
    const haiku = claudeModelOf("claude-haiku-5-5");
    const short = claudeCost(usage({ input_tokens: 50_000 }), haiku);
    const long = claudeCost(usage({ input_tokens: 150_000 }), haiku);
    expect(short).toBeCloseTo((50_000 * 0.1 + 1_000 * 0.5) / 1e6, 8);
    expect(long).toBeCloseTo((150_000 * 0.5 + 1_000 * 2.5) / 1e6, 8);
  });

  it("the cost follows the model that answered, stamped on the usage", () => {
    const stamped = withModel(usage(), "claude-haiku-5-5-20261001");
    expect(stamped.model).toBe("claude-haiku-5-5");
    expect(claudeCost(stamped)).toBeCloseTo(claudeCost(usage(), claudeModelOf("claude-haiku-5-5")), 10);
  });

  it("a request runs on the person's model", async () => {
    expect(currentClaude().id).toBe(DEFAULT_CLAUDE_MODEL);
    await withClaude("claude-haiku-5-5", async () => {
      expect(currentClaude().key).toBe("haiku");
      await Promise.resolve();
      expect(claudeCost(usage())).toBeCloseTo(claudeCost(usage(), claudeModelOf("claude-haiku-5-5")), 10);
    });
    await withClaude("nonsense", async () => expect(currentClaude().id).toBe(DEFAULT_CLAUDE_MODEL));
  });
});

describe("the platform's 10% on Claude's usage", () => {
  setPricing(null);
  it("is the real cost plus 10% — rounded up to the halala only", () => {
    expect(CLAUDE_MARGIN_PCT).toBe(10);
    for (const usd of [0.0003, 0.002, 0.03, 0.12, 0.5, 1.37, 9.99]) {
      const cost = costHalalas(usd);
      const exact = usd * 3.75 * 100;
      const price = claudeHalalas(usd);
      expect(price, String(usd)).toBeGreaterThanOrEqual(exact * 1.1 - 1e-9);
      // never more than the 10% and one halala of rounding
      expect(price, String(usd)).toBeLessThanOrEqual(Math.ceil(exact * 1.1) + 0);
      expect(price).toBeGreaterThanOrEqual(cost);
    }
  });

  it("is far under the 30% generator price (which rounds to the half riyal)", () => {
    expect(claudeHalalas(0.12)).toBe(50);
    expect(coinsFor(0.12)).toBe(100);
    expect(claudeHalalas(0)).toBe(0);
  });

  it("varies with the model chosen, for the same reply", () => {
    const price = (id: string) => claudeHalalas(typicalReplyUsd(claudeModelOf(id)));
    expect(price("claude-fable-5-1")).toBeGreaterThan(price("claude-opus-5-5"));
    expect(price("claude-opus-5-5")).toBeGreaterThan(price("claude-sonnet-5-5"));
    expect(price("claude-sonnet-5-5")).toBeGreaterThan(price("claude-haiku-5-5"));
    expect(price("claude-haiku-5-5")).toBeGreaterThanOrEqual(1);
  });
});

describe("what Claude knows about it", () => {
  it("names the four models, the 10% and the microphone", () => {
    for (const m of CLAUDE_MODELS) expect(JAWAD_KNOWLEDGE, m.id).toContain(`«${m.name}»`);
    expect(JAWAD_KNOWLEDGE).toContain("10٪");
    expect(JAWAD_KNOWLEDGE).toContain("microphone");
  });
});

describe("every robot's chat has the model picker and the microphone", async () => {
  const { readFileSync } = await import("node:fs");
  const chats = [
    "src/components/jawad/content/ContentChat.tsx",
    "src/components/jawad/designer/DesignerChat.tsx",
    "src/components/jawad/games/GamesChat.tsx",
    "src/components/jawad/islamic/IslamicChat.tsx",
    "src/components/jawad/studio/AssistantChat.tsx",
    "src/components/jawad/editor/AssistantPanel.tsx",
    "src/app/film/SajjadPanel.tsx",
    "src/app/film/ActionBar.tsx",
  ];
  for (const f of chats) {
    it(f, () => {
      const src = readFileSync(f, "utf8");
      expect(src).toContain("<ClaudeModelPicker");
      // حيدرة already has its own microphone and conversation
      if (!f.endsWith("AssistantPanel.tsx")) expect(src).toContain("<MicButton");
    });
  }
  it("and each sends the chosen model with the message", () => {
    for (const f of chats.filter((f) => !f.endsWith("ActionBar.tsx"))) expect(readFileSync(f, "utf8"), f).toMatch(/model: claude\.id/);
    for (const f of ["script/ScriptWorkspace", "sheets/SheetsWorkspace", "videos/VideosWorkspace"]) expect(readFileSync(`src/app/film/[id]/${f}.tsx`, "utf8"), f).toMatch(/model: claude\.id/);
  });
});
