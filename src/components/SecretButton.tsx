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
