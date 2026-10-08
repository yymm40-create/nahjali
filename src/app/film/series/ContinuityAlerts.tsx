"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { postJson } from "@/lib/fetch";
import { openSajjad } from "../SajjadPanel";

export type AlertView = { id: string; sceneId: string; where: string; severity: "high" | "medium" | "low"; title: string; text: string; fix: string; at: string };

const SEV: Record<AlertView["severity"], { label: string; cls: string }> = {
  high: { label: "مهم", cls: "bg-[#dc2626] text-white" },
  medium: { label: "فجوة", cls: "bg-[#e2a72c] text-black" },
  low: { label: "ملاحظة", cls: "bg-black/10" },
};

/**
 * «رقابة الاستمرارية»: سجاد's open alerts about what's missing between the scenes — on the series' page (all of them,
 * with «🔍 افحص» per scene) and on a scene's pages (its own). New ones pop up once on arrival; each is handed to
 * سجاد to mend («خل سجاد يصلحه» opens him with the fix), marked done, or dismissed.
 */
export default function ContinuityAlerts({ seriesId, alerts, sceneId, scenes = [], canAct, sceneKind }: { seriesId: string; alerts: AlertView[]; sceneId?: string; scenes?: { id: string; label: string }[]; canAct: boolean; sceneKind: "series" | "film" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [popup, setPopup] = useState<AlertView[]>([]);
  const [pick, setPick] = useState(scenes[0]?.id ?? "");
  const seenKey = `sajjad-seen:${seriesId}`;

  // the ones not seen on this device yet pop up once
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const seen = new Set<string>(JSON.parse(localStorage.getItem(seenKey) ?? "[]"));
        const fresh = alerts.filter((a) => !seen.has(a.id));
        if (fresh.length) setPopup(fresh);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [alerts, seenKey]);
  const closePopup = () => {
    try {
      const seen = new Set<string>(JSON.parse(localStorage.getItem(seenKey) ?? "[]"));
      for (const a of alerts) seen.add(a.id);
      localStorage.setItem(seenKey, JSON.stringify([...seen].slice(-300)));
    } catch {}
    setPopup([]);
  };

  const status = async (a: AlertView, st: "done" | "dismissed") => {
    setBusy(a.id);
    setError("");
    try {
      await postJson(`/api/film/series/${seriesId}`, { action: "alert_status", alertId: a.id, status: st });
      setPopup((p) => p.filter((x) => x.id !== a.id));
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const check = async (id: string) => {
    if (!id) return;
    setBusy("check");
    setError("");
    try {
      const r = await postJson<{ alerts: AlertView[] }>(`/api/film/series/${seriesId}`, { action: "watch_scene", sceneId: id });
      if (!r.alerts.length) setError("✅ سجاد فحصه: ما لقى فجوات مع المشاهد اللي حوله.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  // «خل سجاد يصلحه»: on the series' page he needs to know which scene (sceneId); on the scene's own page he is already there
  const mend = (a: AlertView) => {
    closePopup();
    openSajjad(sceneKind === "series" ? `صلّح هذي الفجوة في ${a.where} (sceneId: ${a.sceneId}): ${a.title}. ${a.fix}` : `صلّح هذي الفجوة: ${a.title}. ${a.fix}`);
  };

  const card = (a: AlertView, inPopup = false) => (
    <article key={a.id} className="space-y-1 rounded-xl bg-white p-3 text-sm shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${SEV[a.severity].cls}`}>{SEV[a.severity].label}</span>
        <p className="font-extrabold">{a.title}</p>
        {!sceneId && <span className="text-[11px] font-bold text-muted">{a.where}</span>}
      </div>
      <p className="whitespace-pre-wrap text-xs font-bold leading-6">{a.text}</p>
      <p className="text-xs font-bold text-muted">🛠️ {a.fix}</p>
      {canAct && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          <button type="button" className="btn btn-primary min-h-8 px-3 text-xs" disabled={busy === a.id} onClick={() => mend(a)}>🧑‍🏫 خل سجاد يصلحه</button>
          <button type="button" className="btn btn-secondary min-h-8 px-3 text-xs" disabled={busy === a.id} onClick={() => status(a, "done")}>تم ✅</button>
          <button type="button" className="btn btn-ghost min-h-8 px-3 text-xs" disabled={busy === a.id} onClick={() => status(a, "dismissed")}>تجاهل</button>
          {inPopup && null}
        </div>
      )}
    </article>
  );

  if (!alerts.length && !scenes.length) return null;
  return (
    <section className="space-y-2 rounded-2xl border-2 border-[#e2a72c]/60 bg-[#fffbeb] p-3" aria-label="رقابة الاستمرارية">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-black">🧭 رقابة الاستمرارية {alerts.length ? <span className="chip bg-[#dc2626] text-xs text-white">{alerts.length}</span> : <span className="chip text-xs">ما فيه فجوات مفتوحة</span>}</p>
        {canAct && scenes.length > 0 && (
          <div className="flex items-center gap-1.5">
            <select className="field min-h-9 max-w-56 text-xs" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="المشهد المفحوص">
              {scenes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button type="button" className="btn btn-secondary min-h-9 px-3 text-xs" disabled={busy === "check" || !pick} onClick={() => check(pick)}>{busy === "check" ? "سجاد يفحص…" : "🔍 افحص"}</button>
          </div>
        )}
        {canAct && sceneId && !scenes.length && (
          <button type="button" className="btn btn-secondary min-h-9 px-3 text-xs" disabled={busy === "check"} onClick={() => check(sceneId)}>{busy === "check" ? "سجاد يفحص…" : "🔍 افحص هذا المشهد"}</button>
        )}
      </div>
      <p className="text-xs font-bold text-muted">سجاد يربط النقاط الناقصة بين المشاهد: شخصية ما انقدّمت، قفزة زمن أو مكان بلا جسر، شي يناقض مشهدًا سابقًا، خيط انفتح وانقطع. يفحص كل مشهد لما يكتمل سيناريوه، وتقدر تفحص أي مشهد بنفسك.</p>
      {error && <p className={`${error.startsWith("✅") ? "rounded-xl bg-white p-2" : "error-box"} text-sm`}>{error}</p>}
      {alerts.length > 0 && <div className="space-y-2">{alerts.map((a) => card(a))}</div>}

      {popup.length > 0 && (
        <div className="fixed inset-0 z-[290] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={closePopup} role="dialog" aria-label="تنبيه من سجاد">
          <div className="max-h-[85dvh] w-full max-w-lg space-y-3 overflow-y-auto rounded-3xl bg-[#fffbeb] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className="text-3xl" aria-hidden>🧑‍🏫</span>
              <div>
                <p className="text-lg font-black">سجاد لاحظ فجوات بين المشاهد</p>
                <p className="text-xs font-bold text-muted">{popup.length} تنبيه جديد — صلّحها الحين أو ارجع لها بعدين من «رقابة الاستمرارية».</p>
              </div>
            </div>
            <div className="space-y-2">{popup.map((a) => card(a, true))}</div>
            <button type="button" className="btn btn-ghost min-h-10 w-full text-sm" onClick={closePopup}>أشوفها بعدين</button>
          </div>
        </div>
      )}
    </section>
  );
}
