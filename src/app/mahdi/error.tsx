"use client";

import { t } from "@/lib/mahdi/i18n";

/** Something failed while loading a screen: a calm message and a retry. */
export default function MahdiError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="m-main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="m-card p-5">{t.errors.generic}</p>
      <button type="button" className="m-btn m-btn-primary" onClick={reset}>{t.common.retry}</button>
    </main>
  );
}
