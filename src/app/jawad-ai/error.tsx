"use client";

import Link from "next/link";
import Icon from "@/components/jawad/Icon";

/** JAWAD AI's error screen: no internals shown, a retry and the way back to JAWAD AI's home. */
export default function JawadError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center" role="alert">
      <span className="grid size-14 place-items-center rounded-2xl bg-jw-surface-2 text-jw-danger"><Icon name="alert" size={26} /></span>
      <h1 className="text-xl font-bold">صار خطأ غير متوقع</h1>
      <p className="text-sm text-jw-muted">أعمالك محفوظة. جرّب مرة ثانية، وإذا تكرر الخطأ ارجع بعد قليل.</p>
      <div className="flex gap-2">
        <button type="button" className="jw-btn jw-btn-primary" onClick={reset}><Icon name="retry" size={16} /> حاول مرة ثانية</button>
        <Link href="/jawad-ai" className="jw-btn">رئيسية JAWAD AI</Link>
      </div>
    </div>
  );
}
