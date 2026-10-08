"use client";

import { useState } from "react";

const SITE = typeof window === "undefined" ? "https://www.aljawadai.app" : window.location.origin;
const SHARE_TEXT = "جرّبوا «نهج علي» 🌟 كتيب عادات طيبة بشخصية طفلكم الكرتونية واسمه، مجانًا خلال فترة التجربة:";

/** Quick marketing actions for the owner. */
export default function AdminTools({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState("");

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
    }
  }

  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-xl font-extrabold">أدوات تسويقية</h2>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-ghost min-h-12 text-sm" onClick={() => copy("emails", emails.join(", "))}>
          {copied === "emails" ? "✅ انتسخت" : `📋 نسخ كل الإيميلات (${emails.length})`}
        </button>
        <button className="btn btn-ghost min-h-12 text-sm" onClick={() => copy("link", SITE)}>
          {copied === "link" ? "✅ انتسخ" : "🔗 نسخ رابط الموقع"}
        </button>
        <a
          className="btn btn-secondary min-h-12 text-sm"
          href={`https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT}\n${SITE}`)}`}
          target="_blank"
          rel="noopener"
        >
          💬 مشاركة واتساب
        </a>
        <a
          className="btn btn-ghost min-h-12 text-sm"
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SITE)}`}
          target="_blank"
          rel="noopener"
        >
          𝕏 مشاركة في إكس
        </a>
        <button className="btn btn-ghost col-span-2 min-h-12 text-sm" onClick={() => copy("text", `${SHARE_TEXT}\n${SITE}`)}>
          {copied === "text" ? "✅ انتسخ" : "✍️ نسخ نص إعلان جاهز"}
        </button>
      </div>
    </section>
  );
}
