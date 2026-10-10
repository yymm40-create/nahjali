"use client";

// «انشرنا واربح» — a button at the top of JAWAD AI («🎁 انشرنا +١٠») and a window that opens by itself once with every
// new version of the site: share us in an Instagram story with a mention of @jawad.ai.studio, write your Instagram
// name, press «نشرت ✅». It stays there when the person leaves and comes back (the button shows «⏳ ننتظر التأكيد»),
// and the owner confirms from Telegram; the reward lands in the wallet once.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Riyal from "@/components/Riyal";
import { instagramUrl, SHARE, shareSeenKey, type ShareStatus } from "@config/share";
import "./share-reward.css";

interface State {
  enabled: boolean;
  rewardSar: number;
  signedIn: boolean;
  claim: { status: ShareStatus; handle: string; rewardSar: number } | null;
}

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

  return (
    <>
      <button type="button" className="sr-pill h-9 min-h-9 whitespace-nowrap px-3 text-xs font-bold" onClick={() => setOpen(true)} title="انشرنا في ستوري انستغرام واحصل على رصيد مجاني">
        {pending ? "⏳ ننتظر التأكيد" : <>🎁 انشرنا +<Riyal halalas={Math.round(s.rewardSar * 100)} size={12} /></>}
      </button>
      {/* drawn on the page itself: inside the header (blurred, sticky) a fixed window is held by the header, off centre */}
      {open && typeof document !== "undefined" && createPortal(
        <div className="sr-back" role="dialog" aria-modal="true" aria-label="مسابقة انشرنا واربح" dir="rtl" onClick={close}>
          <div className="sr-card" onClick={(e) => e.stopPropagation()}>
            <span className="sr-shine" aria-hidden />
            <span className="sr-confetti" aria-hidden>{"✦✧★✦✧★✦✧".split("").map((c, i) => <i key={i} style={{ ["--i" as string]: i }}>{c}</i>)}</span>
            <button type="button" className="sr-x" onClick={close} aria-label="أغلق">✕</button>

            <div className="sr-head">
              <span className="sr-ribbon">🏆 مسابقة · هدايا مجانية</span>
              <div className="sr-trophy" aria-hidden>🎁</div>
              <h2>انشرنا واربح</h2>
              <div className="sr-prize">
                <span>جائزتك</span>
                <b><Riyal halalas={Math.round(s.rewardSar * 100)} size={30} /></b>
                <span>مجانًا في محفظتك</span>
              </div>
              <p>رصيد تصنع فيه صور وفيديوهات وأصوات في الجواد الذكي.</p>
            </div>

            {pending ? (
              <p className="sr-note">⏳ وصلنا طلبك باسم <b dir="ltr">@{s.claim!.handle}</b>. بنتأكد من الستوري وتنضاف لك الجائزة إن شاء الله. تقدر تعدّل اسم الحساب تحت لو كتبته غلط.</p>
            ) : s.claim?.status === "rejected" ? (
              <p className="sr-note sr-warn">ما لقينا المنشن في الستوري المرة اللي فاتت. انشره مرة ثانية مع المنشن وأرسل من جديد.</p>
            ) : null}

            <ol className="sr-steps">
              <li>
                <b>١</b>
                <span>
                  انشر ستوري في انستغرام عن الجواد الذكي، وسوّ <strong>منشن</strong> لحسابنا{" "}
                  <a href={instagramUrl(SHARE.account)} target="_blank" rel="noreferrer" dir="ltr">@{SHARE.account}</a>
                  <span className="sr-chips">
                    <a href={instagramUrl(SHARE.account)} target="_blank" rel="noreferrer">📸 افتح حسابنا</a>
                    <button type="button" onClick={() => navigator.clipboard?.writeText(`@${SHARE.account}`).then(() => setMsg({ text: "انسخ المنشن ✅" })).catch(() => null)}>📋 انسخ المنشن</button>
                  </span>
                </span>
              </li>
              <li>
                <b>٢</b>
                <span>
                  اكتب اسم حسابك في انستغرام (عشان نلقى الستوري)
                  <input className="sr-input" dir="ltr" placeholder="your.account" value={handle} maxLength={60} onChange={(e) => setHandle(e.target.value)} />
                </span>
              </li>
              <li>
                <b>٣</b>
                <span>اضغط «نشرت ✅». تقدر تطلع من الموقع وترجع؛ الزر يبقى فوق.</span>
              </li>
            </ol>

            {s.signedIn ? (
              <button type="button" className="sr-go" disabled={busy || !handle.trim()} onClick={() => void shared()}>
                {busy ? "…" : pending ? "حدّث اسم الحساب" : "نشرت ✅ أبي جائزتي"}
              </button>
            ) : (
              <a className="sr-go" href={loginHref}>سجّل دخولك أول عشان تنضاف الجائزة لحسابك</a>
            )}
            {msg && <p className={`sr-msg ${msg.bad ? "bad" : ""}`}>{msg.text}</p>}
            <p className="sr-small">جائزة وحدة لكل حساب، تنضاف بعد ما نتأكد من الستوري.</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
