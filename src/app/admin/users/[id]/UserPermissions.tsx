"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/fetch";

interface Props {
  email: string;
  sections: { key: string; label: string; siteMode: string; value: 0 | 1 | null }[];
  limits: { key: string; label: string; hint: string; site: number; own: number | null }[];
  balance: number;
  /** set only while «المكتبة» is running */
  libraryUntil: string | null;
  coinsOn: boolean;
  filmInvited: boolean;
  trials: { custom: number | null; effective: number };
  overrides: number;
}

const toNum = (s: string) => s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)).replace(/[^0-9-]/g, "");

/** Every switch the owner has over one person: sections, coins, «المكتبة», trials, limits, the film invite. */
export default function UserPermissions(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [coins, setCoins] = useState("");
  const [note, setNote] = useState("");
  const [trials, setTrials] = useState(p.trials.custom ? String(p.trials.custom) : "");
  const [limitDraft, setLimitDraft] = useState<Record<string, string>>(Object.fromEntries(p.limits.map((l) => [l.key, l.own === null ? "" : String(l.own)])));

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

  const setLimit = (key: string, value: number | null, done: string) => run(key, "/api/admin/limits", { action: "set", scope: "email", target: p.email, key, value }, done);
  const library = p.libraryUntil ? new Date(p.libraryUntil).toLocaleDateString("ar-SA", { dateStyle: "medium" }) : null;

  return (
    <div className="space-y-4">
      {msg && (
        <p role="status" className={`sticky top-2 z-10 rounded-2xl p-3 font-bold shadow ${msg.ok ? "bg-teal text-white" : "bg-red-600 text-white"}`}>
          {msg.ok ? "✅" : "⚠️"} {msg.text}
        </p>
      )}

      {/* sections */}
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">🔐 الدخول للأقسام</h2>
        <p className="text-sm font-bold text-muted">«مثل الكل» يعني يتبع إعداد القسم للموقع كله. «مسموح دائمًا» يفتح له حتى لو القسم مقفول، و«ممنوع» يقفل عليه حتى لو مفتوح.</p>
        <ul className="space-y-2">
          {p.sections.map((s) => (
            <li key={s.key} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line p-3">
              <span className="min-w-0 flex-1">
                <b className="block">{s.label}</b>
                <span className="text-xs font-bold text-muted">للكل: {s.siteMode}</span>
              </span>
              <span className="flex gap-1" role="group" aria-label={s.label}>
                {(
                  [
                    [null, "مثل الكل"],
                    [1, "✓ مسموح دائمًا"],
                    [0, "⛔ ممنوع"],
                  ] as [0 | 1 | null, string][]
                ).map(([v, label]) => (
                  <button
                    key={label}
                    aria-pressed={s.value === v}
                    disabled={!!busy}
                    onClick={() => s.value !== v && setLimit(`allow_${s.key}`, v, `${s.label}: ${label}`)}
                    className={`btn min-h-10 px-3 text-sm ${s.value === v ? (v === 0 ? "bg-red-600 text-white" : "btn-primary") : "btn-ghost"}`}
                  >
                    {label}
                  </button>
                ))}
              </span>
            </li>
          ))}
          <li className="flex flex-wrap items-center gap-2 rounded-2xl border border-line p-3">
            <span className="min-w-0 flex-1">
              <b className="block">🎬 دعوة صانع الفيلم</b>
              <span className="text-xs font-bold text-muted">لما يكون الفيلم على «إيميلات محددة بس»</span>
            </span>
            <button
              disabled={!!busy}
              onClick={() => run("film", "/api/admin/film", { action: p.filmInvited ? "remove" : "invite", email: p.email }, p.filmInvited ? "انشالت الدعوة" : "انضاف لقائمة الفيلم")}
              className={`btn min-h-10 px-4 text-sm ${p.filmInvited ? "btn-primary" : "btn-ghost"}`}
            >
              {p.filmInvited ? "✓ مدعو · شيل الدعوة" : "ادعه"}
            </button>
          </li>
        </ul>
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

      {/* booklet trials */}
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">📖 تجارب الكتيب المجانية</h2>
        <p className="text-sm font-bold text-muted">له الحين {p.trials.effective} تجربة إجمالًا{p.trials.custom ? " (حد خاص فيه)" : " (الحد العادي)"}.</p>
        <div className="flex flex-wrap gap-2">
          <input className="field w-28" inputMode="numeric" placeholder="مثلاً 5" value={trials} onChange={(e) => setTrials(toNum(e.target.value))} aria-label="عدد التجارب" />
          <button className="btn btn-primary min-h-12 px-4" disabled={!!busy || !(Number(trials) > 0)} onClick={() => run("trials", "/api/admin/trials", { email: p.email, daily: Number(trials) }, `صار له ${trials} تجارب`)}>
            حفظ
          </button>
          {p.trials.custom && (
            <button className="btn btn-ghost min-h-12 px-4" disabled={!!busy} onClick={() => run("trials", "/api/admin/trials", { email: p.email, daily: 0 }, "رجع للحد العادي").then(() => setTrials(""))}>
              رجّعه للعادي
            </button>
          )}
        </div>
      </section>

      {/* per-user limits */}
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">🎚️ حدوده الخاصة</h2>
        <p className="text-sm font-bold text-muted">فاضي = مثل الكل. اكتب رقم يصير له هو بس.</p>
        <ul className="grid gap-2 md:grid-cols-2">
          {p.limits.map((l) => {
            const draft = limitDraft[l.key] ?? "";
            const changed = draft !== (l.own === null ? "" : String(l.own));
            return (
              <li key={l.key} className="space-y-1.5 rounded-2xl border border-line p-3">
                <b className="block">{l.label}</b>
                <span className="block text-xs font-bold text-muted">
                  {l.hint} · للكل: {l.site}
                </span>
                <span className="flex gap-1.5">
                  <input
                    className="field w-24"
                    inputMode="numeric"
                    placeholder={String(l.site)}
                    value={draft}
                    aria-label={l.label}
                    onChange={(e) => setLimitDraft((d) => ({ ...d, [l.key]: toNum(e.target.value).replace("-", "") }))}
                  />
                  <button className="btn btn-primary min-h-10 px-3 text-sm" disabled={!!busy || !changed} onClick={() => setLimit(l.key, draft === "" ? null : Number(draft), `${l.label}: ${draft === "" ? "مثل الكل" : draft}`)}>
                    حفظ
                  </button>
                  {l.own !== null && (
                    <button className="btn btn-ghost min-h-10 px-3 text-sm" disabled={!!busy} onClick={() => setLimit(l.key, null, `${l.label}: رجع مثل الكل`).then(() => setLimitDraft((d) => ({ ...d, [l.key]: "" })))}>
                      مثل الكل
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {p.overrides > 0 && (
        <button
          className="btn min-h-12 w-full bg-red-600 text-white"
          disabled={!!busy}
          onClick={() => confirm("نرجّع كل صلاحياته وحدوده الخاصة مثل الكل؟") && run("reset", "/api/admin/limits", { action: "remove_email", target: p.email }, "رجع مثل الكل في كل شي")}
        >
          ↺ رجّع كل صلاحياته الخاصة ({p.overrides}) مثل الكل
        </button>
      )}
    </div>
  );
}
