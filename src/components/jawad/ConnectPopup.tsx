"use client";

// «جديد: الجواد في كلاود وشات جي بي تي» (the owner, 10 November 2026: everyone who comes in sees it): a popup on the
// first page of a visit, for every visitor, signed in or not, in the glass and motion of the connect page. Once closed
// (either button, ✕, Escape or a press outside) it never shows again on this device. It waits for the packages popup:
// on a visit that one shows, this one comes on a later page.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChatDemo, LivingBg } from "@/app/jawad-ai/connect/Scene";
import "@/app/jawad-ai/connect/connect.css";

const KEY = "jw-connect-ad-1";
const PACKS_KEY = "jw-subscribe-popup";
const QUIET = ["/jawad-ai/connect", "/jawad-ai/login", "/jawad-ai/username", "/jawad-ai/admin", "/jawad-ai/credits", "/jawad-ai/course", "/jawad-ai/learn", "/jawad-ai/pay"];

export default function ConnectPopup({ packsFirst }: { packsFirst: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (QUIET.some((q) => path.startsWith(q))) return;
    try {
      if (localStorage.getItem(KEY)) return;
      if (packsFirst && !sessionStorage.getItem(PACKS_KEY)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [path, packsFirst]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* nothing to remember */
    }
  };
  return (
    <dialog
      ref={ref}
      className="jw-dialog cn-pop m-auto"
      style={{ maxWidth: "min(480px, calc(100vw - 2rem))" }}
      aria-label="جديد: الجواد داخل كلاود وشات جي بي تي"
      onClose={close}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === ref.current && close()}
    >
      {open && (
        <div className="cn" dir="rtl">
          <LivingBg />
          <button type="button" className="cn-x" aria-label="سكّر" onClick={close}>
            ✕
          </button>
          <div className="cn-in">
            <span className="cn-eyebrow cn-glass cn-rise">
              <b aria-hidden /> جديد
            </span>
            <h2 className="cn-h1 cn-rise" style={{ ["--d" as string]: 1 }}>
              الجواد صار <span className="cn-grad">داخل كلاود وشات جي بي تي</span>
            </h2>
            <p className="cn-lead cn-rise" style={{ ["--d" as string]: 2, fontSize: 15 }}>
              اطلب كاروسيل أو تصميم أو صورة أو فيديو وانت تسولف، من رصيدك وبنفس الأسعار.
            </p>
            <div className="cn-rise" style={{ ["--d" as string]: 3 }}>
              <ChatDemo />
            </div>
            <div className="cn-rise mt-4 flex flex-wrap gap-2" style={{ ["--d" as string]: 4 }}>
              <Link href="/jawad-ai/connect" onClick={close} className="cn-btn">
                🔗 اربطه الحين
              </Link>
              <button type="button" className="cn-btn-soft" onClick={close}>
                لاحقًا
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
