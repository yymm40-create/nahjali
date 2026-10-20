import { UserError } from "@/lib/api";
import type { OnText } from "@/lib/film/anthropic";

/**
 * A lab step's answer, written as it is made so the platform never drops a long request. Two shapes:
 * - plain (the default): a space now and then (keeps the line open), then the JSON result — read with `res.json()`;
 * - watched (`watch`): one JSON object a line (NDJSON) — `{"w": "…"}` for each piece حيدرة writes (gathered every
 *   ~200 ms), `{}` to keep the line open, and last `{"r": result}` (or `{"r": {"error": …}}`) — so the page shows the
 *   program being written while it is written.
 */
export function labResponse(run: (onText?: OnText) => Promise<unknown>, watch = false): Response {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let flusher: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let pending = "";
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      const flush = () => {
        if (!pending) return;
        write(`${JSON.stringify({ w: pending })}\n`);
        pending = "";
      };
      const done = (result: unknown) => {
        if (watch) {
          flush();
          write(`${JSON.stringify({ r: result })}\n`);
        } else write(JSON.stringify(result));
      };
      write(watch ? "{}\n" : " ");
      timer = setInterval(() => write(watch ? "{}\n" : " \n"), 10_000);
      if (watch) flusher = setInterval(flush, 200);
      const onText: OnText | undefined = watch ? (piece) => void (pending += piece) : undefined;
      void Promise.resolve().then(() => run(onText)).then(
        (result) => done(result),
        (error: unknown) => {
          console.error("motion lab response", error);
          done({ error: error instanceof UserError ? error.message : "تعذّر إكمال خطوة مختبر الموشن." });
        },
      ).finally(() => {
        clearInterval(timer);
        clearInterval(flusher);
        if (!closed) controller.close();
        closed = true;
      });
    },
    cancel() {
      closed = true;
      clearInterval(timer);
      clearInterval(flusher);
    },
  });
  return new Response(body, { headers: { "Content-Type": watch ? "application/x-ndjson; charset=utf-8" : "application/json; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
