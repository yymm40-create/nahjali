"use client";

import { useRouter } from "next/navigation";

export default function FilmBackButton({ fallback, className = "" }: { fallback: string; className?: string }) {
  const router = useRouter();

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(fallback);
  };

  return (
    <button type="button" className={className} onClick={goBack} aria-label="الرجوع إلى الصفحة السابقة">
      <span aria-hidden>→</span> رجوع
    </button>
  );
}
