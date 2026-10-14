import { UserError } from "@/lib/api";

export function labResponse(run: () => Promise<unknown>): Response {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      write(" ");
      timer = setInterval(() => write(" \n"), 10_000);
      void Promise.resolve().then(run).then(
        (result) => write(JSON.stringify(result)),
        (error: unknown) => {
          console.error("motion lab response", error);
          write(JSON.stringify({ error: error instanceof UserError ? error.message : "تعذّر إكمال خطوة مختبر الموشن." }));
        },
      ).finally(() => {
        clearInterval(timer);
        if (!closed) controller.close();
        closed = true;
      });
    },
    cancel() {
      closed = true;
      clearInterval(timer);
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
