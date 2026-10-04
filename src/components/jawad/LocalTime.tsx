"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** A date in the visitor's own time zone. Formatted only in the browser (the server's time zone may differ). */
export default function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const text = useSyncExternalStore(
    noop,
    () => new Date(iso).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "medium", timeStyle: "short" }),
    () => "",
  );
  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}
