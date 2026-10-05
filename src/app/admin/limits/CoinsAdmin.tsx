"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";
import SmartCoin from "@/components/SmartCoin";

/** «النقود الذكية» for the owner: charging on/off, and adding coins to anyone by email. */
export default function CoinsAdmin({ required, ready, top }: { required: boolean; ready: boolean; top: { email: string; balance: number }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("100");
  const [note, setNote] = useState("");
  const [libEmail, setLibEmail] = useState("");
  const [libMonths, setLibMonths] = useState(1);

  async function send(body: Record<string, unknown>, done?: string) {
    setBusy(true);
    setMsg("");
    try {
      await postJson("/api/admin/coins", body);
      if (done) setMsg(done);
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-xl font-extrabold"><SmartCoin size={24} /> النقود الذكية</h2>
      {!ready && <p className="error-box">جداول النقود الذكية ما انضافت للحين: شغّل الملف <span dir="ltr">0015_smart_coins.sql</span> في SQL Editor.</p>}
      <div className="grid grid-cols-2 gap-2">
        {([[false, "مجاني (ما ينخصم شي)", "فترة التجربة"], [true, "بالنقود الذكية", "كل عملية تنخصم من رصيد صاحبها"]] as const).map(([on, label, hint]) => (
          <button
            key={label}
            className={`rounded-2xl border-2 p-2 text-start ${required === on ? "border-sky-400 bg-sky-400/10" : "border-line"}`}
            disabled={busy || required === on}
            onClick={() => window.confirm(`تحويل صناعة الأفلام إلى «${label}»؟`) && send({ action: "required", on })}
          >
            <span className="block text-sm font-extrabold">{label}</span>
            <span className="block text-xs font-bold text-muted">{hint}</span>
          </button>
        ))}
      </div>

      <div className="space-y-2 rounded-2xl bg-surface-2 p-3">
        <p className="font-extrabold">أضف أو اسحب نقود لشخص</p>
        <input className="field" dir="ltr" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex gap-2">
          <input className="field w-28 text-center" dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d-]/g, ""))} />
          <input className="field flex-1" placeholder="ملاحظة (مثلًا: هدية التجربة)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <p className="text-xs font-bold text-muted">رقم موجب يضيف، وسالب يسحب. كل نقدة تقريبًا ٠٫٢٥ ريال للعميل.</p>
        <button className="btn btn-primary w-full" disabled={busy || !email.trim() || !Number(amount)} onClick={() => window.confirm(`${Number(amount) < 0 ? "تسحب" : "تضيف"} ${Math.abs(Number(amount))} نقدة ${Number(amount) < 0 ? "من" : "لـ"} ${email.trim()}؟`) && send({ action: "grant", email, amount: Number(amount), note }, "تم ✅")}>
          نفّذ
        </button>
      </div>

      <div className="space-y-2 rounded-2xl bg-surface-2 p-3">
        <p className="font-extrabold">📚 فعّل «المكتبة» لشخص</p>
        <p className="text-xs font-bold text-muted">إضافة الجواد الذكي (٥٠ ريال شهريًا). إلى أن يتفعّل الدفع في الموقع، تفعّلها من هنا لمن دفع لك. الأشهر تُضاف من اليوم أو من نهاية اشتراكه الحالي.</p>
        <input className="field" dir="ltr" type="email" placeholder="name@example.com" value={libEmail} onChange={(e) => setLibEmail(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {[1, 3, 6, 12].map((m) => (
            <button key={m} type="button" className={`rounded-full border-2 px-3 py-1 text-sm font-extrabold ${libMonths === m ? "border-sky-400 bg-sky-400/10" : "border-line"}`} onClick={() => setLibMonths(m)}>
              {m === 12 ? "سنة" : m === 1 ? "شهر" : `${m} أشهر`}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-primary" disabled={busy || !libEmail.trim()} onClick={() => send({ action: "library", email: libEmail, months: libMonths }, "تم تفعيل المكتبة ✅")}>فعّل</button>
          <button className="btn btn-ghost" disabled={busy || !libEmail.trim()} onClick={() => window.confirm("إيقاف «المكتبة» لهذا الشخص الآن؟") && send({ action: "library", email: libEmail, months: 0 }, "تم الإيقاف")}>أوقفها</button>
        </div>
      </div>

      {top.length > 0 && (
        <div className="space-y-1 text-sm font-bold">
          <p className="font-extrabold">أعلى الأرصدة</p>
          {top.map((t) => (
            <p key={t.email} className="flex justify-between gap-2">
              <button className="text-start" dir="ltr" onClick={() => setEmail(t.email)}>{t.email}</button>
              <span className="flex items-center gap-1" dir="ltr"><SmartCoin size={14} />{t.balance}</span>
            </p>
          ))}
        </div>
      )}
      {msg && <p className="text-sm font-bold">{msg}</p>}
    </section>
  );
}
