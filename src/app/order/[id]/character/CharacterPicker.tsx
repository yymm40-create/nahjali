"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import type { OrderStatus } from "@/lib/types";
import Spinner from "@/components/Spinner";

interface Props {
  orderId: string;
  /** where this order's steps live (the old booklet pages, or «كتيب الجداول الذكي» in JAWAD AI) */
  base?: string;
  status: OrderStatus;
  characters: { id: string; attempt: number; url: string }[];
  attemptsLeft: number;
  autoGenerate: boolean;
}

export default function CharacterPicker({ orderId, status, characters, attemptsLeft, autoGenerate, base = `/order/${orderId}` }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(characters.at(-1)?.id ?? "");
  const [generating, setGenerating] = useState(status === "generating_character");
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      await postJson(`/api/orders/${orderId}/character`);
      router.replace(`${base}/character`);
      router.refresh();
      // stays «generating» until the page re-renders with the new character (the list's key remounts this component)
    } catch (e) {
      setError((e as Error).message);
      setGenerating(false);
    }
  }

  // Start automatically right after upload (once)
  useEffect(() => {
    if (autoGenerate && !started.current) {
      started.current = true;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Another tab is generating: wait for it to finish, then reload
  useEffect(() => {
    if (status !== "generating_character") return;
    const t = setInterval(async () => {
      const s = await api<{ status: OrderStatus }>(`/api/orders/${orderId}/status`).catch(() => null);
      if (s && s.status !== "generating_character") router.refresh();
    }, 5000);
    return () => clearInterval(t);
  }, [status, orderId, router]);

  async function approve() {
    setApproving(true);
    setError("");
    try {
      await postJson(`/api/orders/${orderId}/approve`, { characterId: selected });
      router.push(`${base}/progress`);
    } catch (e) {
      setError((e as Error).message);
      setApproving(false);
    }
  }

  if (generating) {
    return (
      <div className="card space-y-4 p-8 text-center">
        <Spinner />
        <h1 className="display text-3xl">نرسم شخصيتك الحين…</h1>
        <p className="font-bold">تاخذ عادة دقيقة إلى دقيقتين. خلّ الصفحة مفتوحة.</p>
      </div>
    );
  }

  const current = characters.find((c) => c.id === selected);

  return (
    <div className="space-y-5">
      <h1 className="display text-4xl">{characters.length ? "هذي شخصيتك!" : "شخصيتك"}</h1>

      {current ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
        <img src={current.url} alt="الشخصية الكرتونية" className="card aspect-[2/3] w-full bg-white object-contain" />
      ) : (
        <div className="card p-6 text-center font-bold">ما فيه شخصية بعد. اضغط &quot;ولّد الشخصية&quot;.</div>
      )}

      {characters.length > 1 && (
        <div className="space-y-2">
          <p className="font-extrabold">محاولاتك السابقة، اختر اللي تعجبك:</p>
          <div className="flex gap-3">
            {characters.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`overflow-hidden rounded-2xl border border-line ${c.id === selected ? "ring-4 ring-gold" : "opacity-70"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                <img src={c.url} alt={`محاولة ${c.attempt}`} className="h-28 w-20 bg-white object-contain" />
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="error-box">{error}</p>}

      {current && (
        <button className="btn btn-primary w-full" onClick={approve} disabled={approving}>
          {approving ? "لحظة…" : "اعتمد هذي الشخصية"}
        </button>
      )}
      <button className="btn btn-ghost w-full" onClick={generate} disabled={attemptsLeft <= 0 || approving}>
        {characters.length ? "أعد التوليد" : "ولّد الشخصية"} ({attemptsLeft} متبقية)
      </button>
      {attemptsLeft <= 0 && <p className="text-center text-sm font-bold text-muted">خلّصت محاولاتك، اعتمد واحدة من الشخصيات فوق.</p>}
      {attemptsLeft > 0 && (
        <Link href={`${base}/upload`} className="block text-center font-bold underline">
          أبي أغيّر الصورة
        </Link>
      )}
      {current && (
        <p className="text-center text-sm font-bold text-muted">
          بعد الاعتماد نجهّز ٦ وضعيات لشخصيتك ونركّبها في الكتيب. ما تقدر تغيّر الشخصية بعدها.
        </p>
      )}
    </div>
  );
}
