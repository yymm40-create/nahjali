"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "./Icon";

/** The account button: works, coins, the owner's admin, sign out (which stays inside JAWAD AI). */
export default function AccountMenu({ name, email, owner }: { name: string; email: string; owner: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDetailsElement>(null);
  // Close on outside click / Escape
  useEffect(() => {
    const close = (e: Event) => {
      const d = ref.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  const item = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-jw-surface-3";
  const initial = (name || email).trim().charAt(0).toUpperCase();
  return (
    <details ref={ref} className="relative">
      <summary
        className="grid size-9 cursor-pointer list-none place-items-center rounded-full border border-jw-line-strong bg-jw-surface-2 text-sm font-semibold hover:bg-jw-surface-3 [&::-webkit-details-marker]:hidden"
        aria-label="حسابي"
      >
        {initial || <Icon name="user" size={16} />}
      </summary>
      <div className="jw-panel absolute end-0 z-40 mt-2 w-60 p-1.5 shadow-2xl shadow-black/50" onClick={() => ref.current && (ref.current.open = false)}>
        <div className="border-b border-jw-line px-3 py-2">
          {name && <p className="truncate text-sm font-semibold" dir="auto">{name}</p>}
          <p className="truncate text-xs text-jw-muted" dir="ltr">{email}</p>
        </div>
        <nav className="mt-1 flex flex-col">
          <Link href="/jawad-ai/library" className={item}><Icon name="layers" size={16} /> مكتبتي</Link>
          <Link href="/jawad-ai/coins" className={item}><Icon name="wallet" size={16} /> النقود الذكية</Link>
          <Link href="/jawad-ai/film" className={item}><Icon name="film" size={16} /> مشاريع أفلامي</Link>
          {owner && <Link href="/jawad-ai/admin" className={item}><Icon name="settings" size={16} /> إدارة JAWAD AI</Link>}
          <button
            type="button"
            className={`${item} text-start text-jw-muted`}
            onClick={async () => {
              await createClient().auth.signOut();
              router.push("/jawad-ai");
              router.refresh();
            }}
          >
            <Icon name="logout" size={16} /> تسجيل الخروج
          </button>
          <Link href="/account/delete" className={`${item} text-xs text-jw-faint`}><Icon name="trash" size={14} /> حذف حسابي</Link>
        </nav>
      </div>
    </details>
  );
}
