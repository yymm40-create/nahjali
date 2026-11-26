"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Reloads the room's numbers every 30 seconds while it is open. */
export default function Refresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
