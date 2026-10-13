"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { postJson } from "@/lib/fetch";
import type { JourneyIntake, JourneyKind } from "@/lib/film/intake";
import JourneyIntakeCard from "./JourneyIntakeCard";
import RobotFace from "@/components/RobotFace";

export default function JourneyUpgrade({ targetType, targetId, initialKind, title, story, fixedFacts = "", targetDurationSec = null }: { targetType: "project" | "series"; targetId: string; initialKind: JourneyKind; title: string; story: string; fixedFacts?: string; targetDurationSec?: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<JourneyKind>(initialKind);
  const [intake, setIntake] = useState<JourneyIntake | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const draftId = useRef(`upgrade:${targetId}`);

  const understand = async (answers: Record<string, string> = {}) => {
    setBusy(true);
    setError("");
    try {
      const result = await postJson<{ intake: JourneyIntake }>("/api/film/intake", { draftId: draftId.current, targetType, targetId, kind, title, story, fixedFacts, targetDurationSec, answers, previous: intake });
      setIntake(result.intake);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!intake) return;
    setBusy(true);
    setError("");
    try {
      const result = await postJson<{ reviewRequired: boolean }>("/api/film/intake", { action: "confirm_upgrade", targetType, targetId, kind, intake });
      setDone(result.reviewRequired ? "تم التحويل وحُفظ كل شغلك. علّمنا المخرجات السابقة للمراجعة لأن فهم الرحلة صار أدق؛ افتح مرحلتك الحالية وراجعها قبل تكمل." : "تم التحويل كاملًا إلى الرحلة الجديدة ✅");
      setIntake(null);
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) return <p className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 text-sm font-extrabold leading-7 text-emerald-800">{done}</p>;
  if (!open) return (
    <section className="card space-y-2 border-2 border-[#1f63f0] p-4">
      <p className="flex items-center gap-2 font-black"><RobotFace id="sajjad" size={24} /> حدّث مشروعك إلى رحلة سجاد الجديدة</p>
      <p className="text-sm font-bold leading-7 text-muted">نحتفظ بكل السيناريوهات والصور والفيديوهات والنسخ الموجودة. سجاد يقرأها، يسألك فقط عن الناقص المؤثر، وبعد تأكيدك يثبت فهمًا موحدًا للمراحل القادمة.</p>
      <button type="button" className="btn btn-primary w-full" onClick={() => setOpen(true)}>ابدأ التحويل الآمن</button>
    </section>
  );
  return (
    <section className="card space-y-3 border-2 border-[#1f63f0] p-4">
      <header><p className="font-black">تحويل إلى الرحلة الجديدة</p><p className="text-xs font-bold text-muted">ما راح نحذف أي ملف أو نسخة أو قرار معتمد.</p></header>
      {targetType === "project" && !intake && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={`kind-card${kind === "scene" ? " on" : ""}`} onClick={() => setKind("scene")}><span className="kind-icon">🎬</span><b>مشهد قصير</b><small>لحظة واحدة مكتملة</small></button>
          <button type="button" className={`kind-card${kind === "film" ? " on" : ""}`} onClick={() => setKind("film")}><span className="kind-icon">🎥</span><b>فيلم كامل</b><small>بداية وتحول وذروة ونهاية</small></button>
        </div>
      )}
      {intake ? <JourneyIntakeCard intake={intake} busy={busy} confirmLabel="اعتمد التحويل مع حفظ كل شغلي" onRecheck={(answers) => void understand(answers)} onConfirm={() => void confirm()} onEdit={() => setIntake(null)} /> : <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void understand()}>{busy ? "سجاد يقرأ المشروع كله…" : "خل سجاد يقرأ الموجود ويسأل الناقص"}</button>}
      {error && <p className="error-box text-sm">{error}</p>}
      {!intake && <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={() => setOpen(false)}>لاحقًا</button>}
    </section>
  );
}
