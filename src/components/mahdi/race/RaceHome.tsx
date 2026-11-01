"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { useMahdi } from "@/components/mahdi/Provider";

interface Item {
  id: string;
  title: string;
  code: string;
}

export default function RaceHome() {
  const { toast, state } = useMahdi();
  const router = useRouter();
  const [data, setData] = useState<{ canLead: boolean; led: Item[]; joined: Item[] } | null>(null);
  const [code, setCode] = useState(useSearchParams().get("c") ?? "");
  const [name, setName] = useState(state.snap.profile.displayName ?? "");
  const [title, setTitle] = useState("سباق الاستراحة");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mahdiFetch<{ canLead: boolean; led: Item[]; joined: Item[] }>("/api/mahdi/race").then(setData).catch((e: Error) => toast(e.message));
  }, [toast]);

  async function go(url: string, json: unknown) {
    setBusy(true);
    try {
      const r = await mahdiFetch<{ id: string }>(url, { method: "POST", json });
      router.push(`/mahdi/race/${r.id}`);
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  }

  const list = [...(data?.led ?? []), ...(data?.joined ?? []).filter((j) => !data?.led.some((l) => l.id === j.id))];
  return (
    <div className="space-y-4">
      <div className="m-card space-y-3 p-4">
        <h2 className="text-lg font-bold">ادخل المسابقة</h2>
        <input className="m-field" dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} placeholder="الكود" aria-label="كود المسابقة" />
        <input className="m-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="اسمك" aria-label="اسمك" />
        <button type="button" className="m-btn m-btn-primary w-full" disabled={busy || !code.trim() || !name.trim()} onClick={() => go("/api/mahdi/race/join", { code, name })}>
          ادخل
        </button>
      </div>
      {list.length > 0 && (
        <div className="grid gap-2">
          {list.map((r) => (
            <Link key={r.id} href={`/mahdi/race/${r.id}`} className="m-card flex items-center justify-between gap-3 p-4 font-semibold">
              <span>{r.title}</span>
              {data?.led.some((l) => l.id === r.id) && <span className="m-chip m-chip-gold">أنت القائد</span>}
            </Link>
          ))}
        </div>
      )}
      {data?.canLead && (
        <div className="m-card space-y-3 p-4">
          <h2 className="text-lg font-bold">ابدأ مسابقة جديدة</h2>
          <input className="m-field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} aria-label="اسم المسابقة" />
          <button type="button" className="m-btn m-btn-ghost w-full" disabled={busy || !title.trim()} onClick={() => go("/api/mahdi/race", { title })}>
            أنشئ بكل الألعاب
          </button>
        </div>
      )}
    </div>
  );
}
