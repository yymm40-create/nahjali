"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Sign in, then come back to this very page of JAWAD AI. */
export default function LoginLink({ className = "jw-btn jw-btn-primary", children = "تسجيل الدخول" }: { className?: string; children?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <Link href={`/jawad-ai/login?next=${encodeURIComponent(pathname || "/jawad-ai")}`} className={className}>
      {children}
    </Link>
  );
}
