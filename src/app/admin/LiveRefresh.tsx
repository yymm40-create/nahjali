"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Reads the page again every `seconds` (the owner's live tables). */
export default function LiveRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  const [at, setAt] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => {
      router.refresh();
      setAt(new Date());
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return <p className="text-xs font-bold text-muted">🔄 يتحدّث كل {seconds} ثانية · آخر تحديث {at.toLocaleTimeString("ar-SA", { timeZone: "Asia/Riyadh" })}</p>;
}
