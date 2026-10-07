"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/fetch";
import { ALL_PERMS, type Perm } from "@config/access";
import { AccessRow } from "../../access/AccessList";

interface Props {
  email: string;
  /** on «السماح»: the sections open to them (null: not on the list, everything closed but «لأجل المهدي») */
  perms: Perm[] | null;
  balance: number;
  /** set only while «المكتبة» is running */
  libraryUntil: string | null;
  coinsOn: boolean;
}

const toNum = (s: string) => s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)).replace(/[^0-9-]/g, "");

/** Every switch the owner has over one person: «السماح», coins, «المكتبة». */
export default function UserPermissions(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [coins, setCoins] = useState("");
  const [note, setNote] = useState("");

  async function run(tag: string, url: string, body: unknown, done: string) {
    setBusy(tag);
    setMsg(null);
    try {
      await postJson(url, body);
      setMsg({ ok: true, text: done });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "تعذّر الحفظ." });
    } finally {
      setBusy(null);
    }
  }

  const library = p.libraryUntil ? new Date(p.libraryUntil).toLocaleDateString("ar-SA", { dateStyle: "medium" }) : null;

  return (
    <div className="space-y-4">
      {msg && (
        <p role="status" className={`sticky top-2 z-10 rounded-2xl p-3 font-bold shadow ${msg.ok ? "bg-teal text-white" : "bg-red-600 text-white"}`}>
          {msg.ok ? "✅" : "⚠️"} {msg.text}
        </p>
      )}

      {/* «السماح» */}
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">🔐 السماح</h2>
        <p className="text-sm font-bold text-muted">نفس القائمة الوحيدة في صفحة «السماح»: اللي معلّم له يستخدمه مجانًا بلا حدود، والباقي مقفل عليه (إلا «لأجل المهدي»).</p>
        {p.perms ? (
          <ul>
            <AccessRow email={p.email} perms={p.perms} />
          </ul>
        ) : (
          <button className="btn btn-primary min-h-12 w-full" disabled={!!busy} onClick={() => run("access", "/api/admin/access", { action: "set", email: p.email, perms: ALL_PERMS }, "انضاف للقائمة وانفتح له كل شي")}>
            + أضفه لقائمة السماح (يفتح له كل شي، وبعدها تقفل اللي تبي)
          </button>
        )}
      </section>

      {/* coins + library */}
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">💰 النقود الذكية والمكتبة</h2>
        <p className="font-bold">
          رصيده: <span className="display text-2xl">{p.balance.toLocaleString("en")}</span> نقدة
          <span className="ms-2 text-sm text-muted">{p.coinsOn ? "(النقود مطلوبة في الموقع الحين)" : "(النقود مو مطلوبة الحين: كل شي مجاني)"}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <input className="field w-32" inputMode="numeric" placeholder="العدد" value={coins} onChange={(e) => setCoins(toNum(e.target.value))} aria-label="عدد النقود" />
          <input className="field min-w-0 flex-1" placeholder="ملاحظة (اختياري)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
          <button
            className="btn btn-primary min-h-12 px-4"
            disabled={!!busy || !(Number(coins) > 0)}
            onClick={() => run("coins", "/api/admin/coins", { action: "grant", email: p.email, amount: Math.abs(Number(coins)), note }, `انضاف ${coins} نقدة`).then(() => setCoins(""))}
          >
            + أعطه
          </button>
          <button
            className="btn btn-ghost min-h-12 px-4"
            disabled={!!busy || !(Number(coins) > 0)}
            onClick={() => run("coins", "/api/admin/coins", { action: "grant", email: p.email, amount: -Math.abs(Number(coins)), note }, `انسحب ${coins} نقدة`).then(() => setCoins(""))}
          >
            − اسحب
          </button>
        </div>
        <div className="space-y-2 rounded-2xl bg-surface-2 p-3">
          <p className="font-bold">📚 المكتبة: {library ? `مفعّلة لين ${library}` : "مو مفعّلة"}</p>
          <div className="flex flex-wrap gap-1.5">
            {[1, 3, 6, 12].map((m) => (
              <button key={m} className="btn btn-ghost min-h-10 px-3 text-sm" disabled={!!busy} onClick={() => run("lib", "/api/admin/coins", { action: "library", email: p.email, months: m }, `انضاف ${m === 12 ? "سنة" : `${m} شهر`} للمكتبة`)}>
                + {m === 12 ? "سنة" : m === 1 ? "شهر" : `${m} أشهر`}
              </button>
            ))}
            {library && (
              <button className="btn min-h-10 bg-red-600 px-3 text-sm text-white" disabled={!!busy} onClick={() => run("lib", "/api/admin/coins", { action: "library", email: p.email, months: 0 }, "توقفت المكتبة")}>
                أوقفها
              </button>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}
