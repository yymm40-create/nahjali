"use client";

// For whoever has not bought a package yet: a popup on the first page they open in a visit, with the packages and a way
// to the shop. Closing it keeps it away for the rest of the visit (this browser tab), and it never covers the shop, the
// sign-in page, a person's own balance page or the dashboard.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Dialog from "./Dialog";
import Riyal from "@/components/Riyal";

const KEY = "jw-subscribe-popup";
const QUIET = ["/jawad-ai/credits", "/jawad-ai/login", "/jawad-ai/username", "/jawad-ai/account", "/jawad-ai/coins", "/jawad-ai/admin", "/jawad-ai/course", "/jawad-ai/learn"];

export interface PopupPack {
  id: string;
  name: string;
  price: number;
  credit: number;
  tag: string;
  bonus: number;
}

export default function SubscribePopup({ packs }: { packs: PopupPack[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (QUIET.some((q) => path.startsWith(q))) return;
    try {
      if (sessionStorage.getItem(KEY)) return;
    } catch {
      /* private window: shown on every page until closed */
    }
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [path]);
  const close = () => {
    setOpen(false);
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* nothing to remember */
    }
  };
  if (!packs.length) return null;
  return (
    <Dialog open={open} onClose={close} title="اشحن رصيدك وابدأ">
      <div className="space-y-3 p-4">
        <p className="text-sm text-jw-muted">
          باقات تبدأ من <Riyal halalas={Math.min(...packs.map((p) => p.price)) * 100} size={14} />، بدون اشتراك، ورصيدك ما ينتهي.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/jawad-ai/credits" onClick={close} className="jw-btn jw-btn-primary">💳 شوف الباقات</Link>
          <button type="button" className="jw-btn jw-btn-quiet" onClick={close}>لاحقًا</button>
        </div>
      </div>
    </Dialog>
  );
}
