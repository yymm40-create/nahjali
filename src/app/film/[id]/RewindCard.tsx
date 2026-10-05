"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import { useFilmBase } from "../FilmBase";

type Point = "screenwriter" | "sheets" | "director";
interface Summary {
  videos: number;
  voices: number;
  pictures: number;
  points: Record<Point, boolean>;
}

const POINTS: { key: Point; label: string; icon: string; path: string; keeps: string; loses: (s: Summary) => string }[] = [
  {
    key: "screenwriter",
    label: "السيناريو",
    icon: "✍️",
    path: "/script",
    keeps: "القصة والسيناريو المعتمد",
    loses: (s) => `الشيتات (${s.pictures} صورة) والمخرج و${s.videos} فيديو و${s.voices} صوت`,
  },
  { key: "sheets", label: "الشيتات", icon: "🎨", path: "/sheets", keeps: "السيناريو والشيتات وصورها", loses: (s) => `المخرج و${s.videos} فيديو و${s.voices} صوت` },
  { key: "director", label: "المخرج", icon: "🎥", path: "/director", keeps: "السيناريو والشيتات وبرومبتات المخرج", loses: (s) => `${s.videos} فيديو و${s.voices} صوت` },
];

/**
 * «تبي تعدّل شي؟»: go back to the screenwriter, the sheets or the director without losing work. A new project keeps
 * everything up to that point (the original stays as it is); or the same project is rewound and what follows is deleted.
 */
export default function RewindCard({ projectId }: { projectId: string }) {
  const router = useRouter();
  const base = useFilmBase();
  const [s, setS] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState<Point | null>(null);
  const [busy, setBusy] = useState<"fork" | "reset" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || s) return;
    api<Summary>(`/api/film/projects/${projectId}/rewind`).then(setS).catch((e: Error) => setError(e.message));
  }, [open, s, projectId]);

  const choices = POINTS.filter((p) => s?.points[p.key]);
  const chosen = POINTS.find((p) => p.key === point);

  async function go(mode: "fork" | "reset") {
    if (!chosen || !s) return;
    if (mode === "reset" && !window.confirm(`تأكيد: ${chosen.keeps} تبقى، و${chosen.loses(s)} تنحذف نهائيًا من هذا المشروع. تكمل؟`)) return;
    setBusy(mode);
    setError("");
    try {
      const { id } = await postJson<{ id: string }>(`/api/film/projects/${projectId}/rewind`, { to: chosen.key, mode });
      router.push(`${base}/${id}${chosen.path}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <section className="card space-y-3 p-4" aria-label="تعديل نقطة سابقة">
      <button type="button" className="flex w-full items-center justify-between gap-2 text-start" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="text-lg font-extrabold">↩️ تبي تعدّل في السيناريو أو الشيتات أو المخرج؟</span>
        <span aria-hidden>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-muted">شغلك ما يضيع: اختر وين تبي ترجع، وبعدها اختر طريقتين.</p>
          {!s && !error && <p className="text-sm font-bold text-muted">لحظة…</p>}
          {s && choices.length === 0 && <p className="text-sm font-bold text-muted">ما فيه شي بعد هذي المراحل؛ تقدر تعدّل مباشرة في كل مرحلة.</p>}
          {choices.length > 0 && (
            <div className="grid gap-2" role="radiogroup" aria-label="ارجع إلى">
              {choices.map((p) => (
                <button key={p.key} type="button" role="radio" aria-checked={point === p.key} onClick={() => setPoint(p.key)} className={`rounded-2xl border-2 p-3 text-start ${point === p.key ? "border-gold bg-gold/10" : "border-line"}`}>
                  <span className="block font-extrabold">{p.icon} ارجع إلى {p.label}</span>
                  <span className="block text-xs font-bold text-muted">تبقى: {p.keeps}</span>
                </button>
              ))}
            </div>
          )}
          {chosen && s && (
            <div className="space-y-2">
              <button type="button" className="btn btn-primary w-full" disabled={Boolean(busy)} onClick={() => go("fork")}>
                {busy === "fork" ? "نجهّز مشروعك الجديد…" : `🆕 افتح مشروع جديد بنفس هذا لين ${chosen.label}`}
              </button>
              <p className="text-xs font-bold text-muted">الأفضل: مشروعك الحالي يبقى كامل بفيديوهاته، ومشروع جديد يبدأ من {chosen.label} وتعدّل فيه. بدون أي تكلفة.</p>
              <button type="button" className="btn btn-ghost w-full" disabled={Boolean(busy)} onClick={() => go("reset")}>
                {busy === "reset" ? "نرجّع المشروع…" : `✏️ عدّل على هذا المشروع نفسه (ينحذف: ${chosen.loses(s)})`}
              </button>
            </div>
          )}
          {error && <p className="error-box">{error}</p>}
        </div>
      )}
    </section>
  );
}
