"use client";

import { openSecretGate } from "./SecretGate";

/** «عندي كود سري»: opens the question again. */
export default function SecretButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={openSecretGate} className={className}>
      🗝️ عندي كود سري
    </button>
  );
}

/** The 🗝️ in the top bar: anyone can open the code box from any page. */
export function SecretKey({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openSecretGate}
      aria-label="عندي كود"
      title="عندي كود"
      className={`grid size-7 shrink-0 place-items-center rounded-full text-sm opacity-80 transition hover:opacity-100 ${className}`}
    >
      🗝️
    </button>
  );
}
