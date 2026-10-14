import { afterEach, expect, it, vi } from "vitest";
import { labResponse } from "@/lib/editor/scene/response";
import { UserError } from "@/lib/api";

afterEach(() => vi.useRealTimers());

it("sends keepalives while work runs and delivers intact JSON", async () => {
  vi.useFakeTimers();
  let finish!: (value: unknown) => void;
  const result = new Promise((resolve) => { finish = resolve; });
  const reader = labResponse(() => result).body!.getReader();
  const decoder = new TextDecoder();
  let body = decoder.decode((await reader.read()).value);
  await vi.advanceTimersByTimeAsync(10_000);
  body += decoder.decode((await reader.read()).value);
  expect(body.trim()).toBe("");
  finish({ code: "complete scene" });
  body += decoder.decode((await reader.read()).value);
  expect(JSON.parse(body)).toEqual({ code: "complete scene" });
  expect((await reader.read()).done).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("returns a readable error and closes the stream when the operation fails", async () => {
  const response = labResponse(async () => { throw new UserError("step timed out", 504); });
  expect(await response.json()).toEqual({ error: "step timed out" });
});

it("does not expose internal errors", async () => {
  const response = labResponse(async () => { throw new Error("private database detail"); });
  expect(await response.json()).toEqual({ error: "تعذّر إكمال خطوة مختبر الموشن." });
});

it("cleans up keepalives on disconnect without discarding ongoing work", async () => {
  vi.useFakeTimers();
  let finish!: () => void;
  const work = new Promise<void>((resolve) => { finish = resolve; });
  const response = labResponse(() => work);
  await response.body!.cancel();
  finish();
  await vi.advanceTimersByTimeAsync(20_000);
  expect(vi.getTimerCount()).toBe(0);
});
