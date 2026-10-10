"use client";

// «واطلب منهم يقرؤون السياسات والشروط قبل يشتركون، وحط لهم مربع يحطون عليه صح» — the one consent box every paying
// journey passes through: the terms and the privacy policy are LINKS the person can press and read (each opens in its
// own tab, so nothing they typed is lost), and the box is theirs to tick whether they read them or not. Nothing is
// forced open and nothing is read on their behalf: the tick is the agreement, and the paying button stays shut until
// it is ticked.

import Link from "next/link";

export default function AgreeTerms({ on, onChange, what = "الشحن" }: { on: boolean; onChange: (v: boolean) => void; what?: string }) {
  return (
    <label className="agree">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} aria-label={`أوافق على الشروط والأحكام وسياسة الخصوصية قبل ${what}`} />
      <span>
        قرأت ووافقت على{" "}
        <Link href="/terms" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          الشروط والأحكام
        </Link>{" "}
        و
        <Link href="/privacy" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          سياسة الخصوصية
        </Link>
        {" "}— وفيها بند الأعذار: إذا تُوفّي صاحب الموقع أو عجز أو تهكّر الموقع فهو غير مطالب بإرجاع أي مبالغ.
      </span>
    </label>
  );
}
