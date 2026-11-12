"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { localDay, areaOf } from "@/lib/mahdi/use";

/** Counts the section once a day per person (no pages, times or content): the owner's usage numbers. */
export default function UsePing() {
  const pathname = usePathname();
  useEffect(() => {
    const area = areaOf(pathname ?? "");
    if (!area) return;
    const day = localDay();
    const key = `mahdi-use:${day}:${area}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // no storage: the server ignores the repeat anyway
    }
    fetch("/api/mahdi/use", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day, area }), keepalive: true }).catch(() => {});
  }, [pathname]);
  return null;
}
