"use client";

// Tells the owner's statistics that a page was opened (/api/visit): a random id kept on this device (no name), and the page.

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const KEY = "jw-visitor";

function visitorId() {
  try {
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(KEY, v);
    }
    return v;
  } catch {
    return null;
  }
}

export default function VisitBeacon() {
  const path = usePathname() ?? "/";
  useEffect(() => {
    if (path.startsWith("/admin") || path.startsWith("/jawad-ai/admin")) return;
    const visitor = visitorId();
    if (!visitor) return;
    const body = JSON.stringify({ path, visitor });
    try {
      if (!navigator.sendBeacon?.("/api/visit", new Blob([body], { type: "application/json" }))) void fetch("/api/visit", { method: "POST", body, keepalive: true }).catch(() => null);
    } catch {
      /* not counted */
    }
  }, [path]);
  return null;
}
