"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import type { OrderStatus } from "@/lib/types";
import Spinner from "@/components/Spinner";

interface StatusResponse {
  status: OrderStatus;
  poses: { total: number; done: number; failed: number };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Drives the background work from the browser: asks the server to generate one pose at a time,
 * then to compose the PDF. Safe to open in two tabs — the server locks each step.
 */
export default function ProgressRunner({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [state, setState] = useState<StatusResponse | null>(null);
  const [error, setError] = useState("");
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setError("");
      let failures = 0;
      while (!cancelled) {
        try {
          const s = await api<StatusResponse>(`/api/orders/${orderId}/status`);
          if (cancelled) return;
          setState(s);

          if (s.status === "ready") return router.replace(`/order/${orderId}/download`);
          if (s.status === "failed") return;

          if (s.status === "generating_poses") {
            const r = await postJson<{ remaining: number }>(`/api/orders/${orderId}/poses/next`);
            // Remaining poses are being made in another tab/request: wait instead of hammering
            if (r.remaining > 0) await sleep(2000);
            else await postJson(`/api/orders/${orderId}/compose`);
          } else {
            await sleep(3000); // composing elsewhere; just poll
          }
          failures = 0;
        } catch (e) {
          // Busy (another tab) or a temporary error: back off, give up after a few in a row
          if (++failures >= 4) {
            if (!cancelled) setError((e as Error).message);
            return;
          }
          await sleep(4000);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, router, round]);

  const total = state?.poses.total || 6;
  const done = state?.poses.done ?? 0;
  const pct = state?.status === "composing" ? 100 : Math.round((done / total) * 100);

  if (state?.status === "failed") {
    return (
      <div className="card space-y-4 p-6 text-center">
        <h1 className="display text-3xl">ما قدرنا نكمل كتيبك</h1>
        <p className="font-bold text-muted">
          بعض صور الشخصية ما طلعت بشكل صحيح بعد أكثر من محاولة. تواصل معنا ونحل المشكلة لك، وما راح تخسر طلبك.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-5 p-8 text-center">
        <Spinner />
        <h1 className="display text-3xl">
          {state?.status === "composing" ? "نركّب صفحات كتيبك…" : "نجهّز شخصيتك في كل الوضعيات…"}
        </h1>
        <div className="h-6 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-gold transition-all duration-700" style={{ width: `${Math.max(pct, 4)}%` }} />
        </div>
        <p className="text-lg font-extrabold">
          {state?.status === "composing" ? "آخر خطوة!" : `${done} من ${total} وضعيات جاهزة`}
        </p>
      </div>
      <p className="text-center font-bold text-muted">
        العملية تاخذ كم دقيقة. خلّ الصفحة مفتوحة، ولو قفلتها ترجع تكمل من نفس المكان من صفحة &quot;كتيباتي&quot;.
      </p>
      {error && (
        <div className="space-y-3">
          <p className="error-box">{error}</p>
          <button className="btn btn-secondary w-full" onClick={() => setRound((r) => r + 1)}>
            حاول مرة ثانية
          </button>
        </div>
      )}
    </div>
  );
}
