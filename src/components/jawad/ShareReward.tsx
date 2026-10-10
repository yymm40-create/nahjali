"use client";

// «انشرنا واربح» — a button at the top of JAWAD AI («🎁 انشرنا +١٠») and a window that opens by itself once with every
// new version of the site: share us in an Instagram story with a mention of @jawad.ai.studio, write your Instagram
// name, press «نشرت ✅». It stays there when the person leaves and comes back (the button shows «⏳ ننتظر التأكيد»),
// and the owner confirms from Telegram; the reward lands in the wallet once.

import { useEffect, useState } from "react";
import { instagramUrl, SHARE, shareSeenKey, type ShareStatus } from "@config/share";

interface State {
  enabled: boolean;
  rewardSar: number;
  signedIn: boolean;
  claim: { status: ShareStatus; handle: string; rewardSar: number } | null;
}

const fmt = (n: number) => n.toLocaleString("ar-SA", { maximumFractionDigits: 2 });

export default function ShareReward({ version, loginHref }: { version: string; loginHref: string }) {
  const [s, setS] = useState<State | null>(null);
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/share", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: State) => {
        if (!live || !j || typeof j.enabled !== "boolean") return;
        setS(j);
        if (j.claim?.handle) setHandle(j.claim.handle);
        // once per version of the site, until they have shared
        let seen = true;
        try {
          seen = localStorage.getItem(shareSeenKey(version)) === "1";
        } catch { /* private window: not shown by itself */ }
        if (j.enabled && !seen && (!j.claim || j.claim.status === "rejected")) setOpen(true);
      })
      .catch(() => null);
    return () => {
      live = false;
    };
  }, [version]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(shareSeenKey(version), "1");
    } catch { /* fine */ }
  };

  const shared = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "تعذّر الإرسال.");
      setS((x) => (x ? { ...x, claim: j.claim } : x));
      setMsg({ text: "✅ وصلنا! بنتأكد من الستوري وتنضاف لك المكافأة خلال وقت قصير إن شاء الله." });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "تعذّر الإرسال.", bad: true });
    } finally {
      setBusy(false);
    }
  };

  if (!s?.enabled || s.claim?.status === "approved") return null;
  const pending = s.claim?.status === "pending";
  const reward = fmt(s.rewardSar);

  return (
    <>
      <button type="button" className="jw-btn h-9 min-h-9 whitespace-nowrap px-2.5 text-xs font-bold" onClick={() => setOpen(true)} title="انشرنا في ستوري انستغرام واحصل على رصيد مجاني">
        {pending ? "⏳ ننتظر التأكيد" : `🎁 انشرنا +${reward}`}
      </button>
      {open && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="انشرنا واربح" dir="rtl" onClick={close}>
          <div className="jw-panel w-full max-w-md space-y-4 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-3xl" aria-hidden>🎁</p>
                <h2 className="text-xl font-bold">انشرنا واحصل على {reward} ريال مجانًا</h2>
                <p className="text-sm text-jw-muted">رصيد في محفظتك تصنع فيه صور وفيديوهات وأصوات في الجواد الذكي.</p>
              </div>
              <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" onClick={close} aria-label="أغلق">✕</button>
            </div>

            {pending ? (
              <p className="rounded-lg bg-jw-accent/10 p-3 text-sm">⏳ وصلنا طلبك باسم <b dir="ltr">@{s.claim!.handle}</b>. بنتأكد من الستوري وتنضاف لك المكافأة إن شاء الله. تقدر تعدّل اسم الحساب تحت لو كتبته غلط.</p>
            ) : s.claim?.status === "rejected" ? (
              <p className="rounded-lg bg-jw-warn/10 p-3 text-sm">ما لقينا المنشن في الستوري المرة اللي فاتت. انشره مرة ثانية مع المنشن وأرسل من جديد.</p>
            ) : null}

            <ol className="space-y-3 text-sm">
              <li className="flex gap-2">
                <b className="grid size-6 shrink-0 place-items-center rounded-full bg-jw-accent/20 text-jw-accent">١</b>
                <span>
                  انشر ستوري في انستغرام عن الجواد الذكي، وسوّ <b>منشن</b> لحسابنا{" "}
                  <a href={instagramUrl(SHARE.account)} target="_blank" rel="noreferrer" className="font-bold text-jw-accent underline" dir="ltr">@{SHARE.account}</a>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <a className="jw-chip text-xs" href={instagramUrl(SHARE.account)} target="_blank" rel="noreferrer">📸 افتح حسابنا</a>
                    <button type="button" className="jw-chip text-xs" onClick={() => navigator.clipboard?.writeText(`@${SHARE.account}`).then(() => setMsg({ text: "انسخ المنشن ✅" })).catch(() => null)}>📋 انسخ المنشن</button>
                  </span>
                </span>
              </li>
              <li className="flex gap-2">
                <b className="grid size-6 shrink-0 place-items-center rounded-full bg-jw-accent/20 text-jw-accent">٢</b>
                <span className="flex-1">
                  اكتب اسم حسابك في انستغرام (عشان نلقى الستوري)
                  <input className="jw-input mt-1 w-full" dir="ltr" placeholder="your.account" value={handle} maxLength={60} onChange={(e) => setHandle(e.target.value)} />
                </span>
              </li>
              <li className="flex gap-2">
                <b className="grid size-6 shrink-0 place-items-center rounded-full bg-jw-accent/20 text-jw-accent">٣</b>
                <span>اضغط «نشرت ✅». تقدر تطلع من الموقع وترجع؛ الزر يبقى فوق.</span>
              </li>
            </ol>

            {s.signedIn ? (
              <button type="button" className="jw-btn jw-btn-primary w-full" disabled={busy || !handle.trim()} onClick={() => void shared()}>
                {busy ? "…" : pending ? "حدّث اسم الحساب" : "نشرت ✅"}
              </button>
            ) : (
              <a className="jw-btn jw-btn-primary w-full" href={loginHref}>سجّل دخولك أول عشان تنضاف المكافأة لحسابك</a>
            )}
            {msg && <p className={`text-sm ${msg.bad ? "text-jw-danger" : "text-jw-accent"}`}>{msg.text}</p>}
            <p className="text-[11px] text-jw-muted">مكافأة وحدة لكل حساب، تنضاف بعد ما نتأكد من الستوري.</p>
          </div>
        </div>
      )}
    </>
  );
}
