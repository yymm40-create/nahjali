"use client";

import { useEffect } from "react";

/** Registers the service worker (offline page, faster loads, push). Its scope is /mahdi/ only. */
export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/mahdi/sw.js", { scope: "/mahdi/" }).catch(() => {});
  }, []);
  return null;
}
