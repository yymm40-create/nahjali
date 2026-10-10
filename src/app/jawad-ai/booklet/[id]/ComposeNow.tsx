"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Spinner from "@/components/Spinner";
import { postJson } from "@/lib/fetch";
import { TB } from "@config/tables-booklet";

/** A designed booklet without a picture: its pages are drawn now (a few seconds), then the download. */
export default function ComposeNow({ orderId, title }: { orderId: string; title: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError("");
      try {
        await postJson(`/api/orders/${orderId}/compose`);
        if (!cancelled) router.replace(`${TB.base}/${orderId}/download`);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, round, router]);

  return (
    <div className="card p-6 text-center">
      <h1 className="display text-3xl">{title}</h1>
      {error ? (
        <>
          <p className="mt-3 font-bold text-red-700">{error}</p>
          <button type="button" className="btn btn-primary mt-4" onClick={() => setRound((r) => r + 1)}>جرّب مرة ثانية</button>
        </>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-3">
          <Spinner />
          <p className="font-bold">نرسم صفحات كتيبك…</p>
        </div>
      )}
    </div>
  );
}
