"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import Icon from "./Icon";

/** The owner's way to the usage numbers (shown to the owner only). */
export default function MetricsLink() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    fetch("/api/mahdi/metrics?probe=1", { cache: "no-store" }).then((r) => setShow(r.ok)).catch(() => {});
  }, []);
  if (!show) return null;
  return (
    <Link href="/mahdi/more/metrics" className="m-card flex items-center gap-3 p-4 font-semibold">
      <Icon name="target" className="m-gold" /> <span className="flex-1">{t.metrics.link}</span> <Icon name="chevronLeft" size={18} />
    </Link>
  );
}
