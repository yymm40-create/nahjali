"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { useMahdi } from "@/components/mahdi/Provider";
import Icon from "@/components/mahdi/Icon";
import { ErrorState, Skeleton } from "@/components/mahdi/social/States";
import { t } from "@/lib/mahdi/i18n";

interface Item {
  id: string;
  title: string;
  code: string;
}

/**
 * «المسابقة»: one primary action — «ادخل» with the code; the races I lead or joined; and (the site's owners) starting a
 * new one, as a quiet second step.
 */
export default function RaceHome() {
  const { toast, state } = useMahdi();
  const router = useRouter();
  const [data, setData] = useState<{ canLead: boolean; led: Item[]; joined: Item[] } | null>(null);
  const [code, setCode] = useState(useSearchParams().get("c") ?? "");
  const [name, setName] = useState(state.snap.profile.displayName ?? "");
  const [title, setTitle] = useState("سباق الاستراحة");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    mahdiFetch<{ canLead: boolean; led: Item[]; joined: Item[] }>("/api/mahdi/race")
      .then((d) => live && (setData(d), setFailed(false)))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [reload]);

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
      {failed && !data && <ErrorState message={t.groups.kind.raceError} onRetry={() => setReload((n) => n + 1)} />}
      {!data && !failed && <Skeleton count={2} />}
      {list.length > 0 && (
        <div className="grid gap-2">
          {list.map((r) => (
            <Link key={r.id} href={`/mahdi/race/${r.id}`} className="m-card flex items-center gap-3 p-4 font-semibold">
              <span className="flex-1">{r.title}</span>
              {data?.led.some((l) => l.id === r.id) && <span className="m-chip m-chip-gold">أنت القائد</span>}
              <Icon name="chevronLeft" size={18} />
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
