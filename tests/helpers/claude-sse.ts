// A whole Claude message as the streamed answer the API sends (callClaudeJson asks with stream: true).
export function sseBody(m: { stop_reason: string; model?: string; content: { type: string; text?: string }[]; usage?: Record<string, number> }) {
  const events: object[] = [{ type: "message_start", message: { model: m.model ?? "claude-opus-5-5", usage: { ...(m.usage ?? {}), output_tokens: 1 } } }];
  m.content.forEach((b, index) => {
    events.push({ type: "content_block_start", index, content_block: b.type === "text" ? { type: "text", text: "" } : { type: b.type } });
    if (b.type === "text") events.push({ type: "content_block_delta", index, delta: { type: "text_delta", text: b.text ?? "" } });
    events.push({ type: "content_block_stop", index });
  });
  events.push({ type: "message_delta", delta: { stop_reason: m.stop_reason }, usage: { output_tokens: m.usage?.output_tokens ?? 1 } }, { type: "message_stop" });
  const bytes = new TextEncoder().encode(events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join(""));
  return new ReadableStream<Uint8Array>({ start: (c) => (c.enqueue(bytes), c.close()) });
}
