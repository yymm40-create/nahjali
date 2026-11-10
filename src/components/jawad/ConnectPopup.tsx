"use client";

// «جديد: الجواد في كلاود وشات جي بي تي» (the owner, 10 November 2026: everyone who comes in sees it): a popup on the
// first page of a visit, for every visitor, signed in or not. Once closed (either button) it never shows again on this
// device. It waits for the packages popup: on a visit that one shows, this one comes on a later page.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Dialog from "./Dialog";

const KEY = "jw-connect-ad-1";
const PACKS_KEY = "jw-subscribe-popup";
const QUIET = ["/jawad-ai/connect", "/jawad-ai/login", "/jawad-ai/username", "/jawad-ai/admin", "/jawad-ai/credits", "/jawad-ai/course", "/jawad-ai/learn"];

export default function ConnectPopup({ packsFirst }: { packsFirst: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
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
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* nothing to remember */
    }
  };
  return (
    <Dialog open={open} onClose={close} title="جديد: الجواد داخل كلاود وشات جي بي تي">
      <div className="space-y-3 p-4">
        <p className="text-base font-bold">صار تقدر تستخدم الجواد من داخل محادثتك في كلاود أو شات جي بي تي.</p>
        <ul className="list-disc space-y-1 ps-5 text-sm text-jw-muted">
          <li>تطلب كاروسيل أو تصميم أو صورة أو فيديو وانت تسولف</li>
          <li>ترفق ملفاتك وتستخدمها بكل الأقسام</li>
          <li>كله من رصيدك بنفس الأسعار، ويسألك قبل الخصم</li>
        </ul>
        <p className="text-sm text-jw-muted">تضيفه مرة وحدة بدقيقة: تنسخ الرابط وتلصقه عندهم.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/jawad-ai/connect" onClick={close} className="jw-btn jw-btn-primary">
            🔗 اربطه الحين
          </Link>
          <button type="button" className="jw-btn jw-btn-quiet" onClick={close}>
            لاحقًا
          </button>
        </div>
      </div>
    </Dialog>
  );
}
