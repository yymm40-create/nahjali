"use client";

// «لامحدود»: the generators of one kind as cards (the best one marked); a tap opens a sheet with the quality (video), 24 or 12
// hours, the price against what the same use costs normally, the short terms, and the buy button (our checkout page).

import Riyal from "@/components/Riyal";
import { useEffect, useState } from "react";

export interface PickerOption {
  key: string;
  quality: string | null;
  price24: number;
  /** what one generation (a 15-second video, one picture) usually costs, in halalas */
  usual: number | null;
  running: boolean;
}
export interface PickerGroup {
  name: string;
  line: string;
  best: boolean;
  kind: "video" | "image";
  options: PickerOption[];
}

const price = (o: PickerOption, hours: 24 | 12) => (hours === 24 ? o.price24 : Math.ceil(o.price24 / 2));
const ar = (n: number) => Math.round(n).toLocaleString("ar-SA");

export default function PassPicker({ groups, login, open, fast, maxVideoSec }: { groups: PickerGroup[]; login: string | null; open: boolean; fast: number; maxVideoSec: number }) {
  const [sel, setSel] = useState<PickerGroup | null>(null);
  return (
    <>
      <ul className="ul-cards">
        {groups.map((g) => {
          const from = Math.min(...g.options.map((o) => o.price24));
          return (
            <li key={g.name}>
              <button type="button" className={`ul-card${g.best ? " ul-card-best" : ""}`} onClick={() => setSel(g)}>
                {g.best && <span className="ul-best">⭐ الأفضل</span>}
                <b dir="ltr" className="ul-card-n">{g.name}</b>
                <span className="ul-card-l">{g.line}</span>
                <span className="ul-card-p">
                  يوم كامل من <Riyal halalas={from * 100} size={18} className="ul-card-pn" />
                </span>
                {g.options.some((o) => o.running) && <span className="ul-card-on">✓ شغّال عندك</span>}
                <span className="ul-card-go">اختر ←</span>
              </button>
            </li>
          );
        })}
      </ul>
      {sel && <Sheet g={sel} login={login} open={open} fast={fast} maxVideoSec={maxVideoSec} onClose={() => setSel(null)} />}
    </>
  );
}

function Sheet({ g, login, open, fast, maxVideoSec, onClose }: { g: PickerGroup; login: string | null; open: boolean; fast: number; maxVideoSec: number; onClose: () => void }) {
  const [opt, setOpt] = useState<PickerOption>(g.options.find((o) => !o.running) ?? g.options[0]);
  const [hours, setHours] = useState<24 | 12>(24);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [onClose]);

  const video = g.kind === "video";
  const p = price(opt, hours);
  // the fast balance of the whole pass: one 12-hour cycle, two for the day
  const fastAll = fast * (hours / 12);
  const perUnit = opt.usual == null ? null : video ? opt.usual / maxVideoSec : opt.usual;
  const fastWorth = perUnit == null ? null : (perUnit * fastAll) / 100;
  const breakEven = opt.usual == null ? null : Math.max(1, Math.ceil((p * 100) / opt.usual));
  const unit = video ? "فيديو" : "صورة";

  async function buy() {
    if (login) return window.location.assign(login);
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/jawad/unlimited", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pass: opt.key, hours }) });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || "ما قدرنا نفتح صفحة الدفع، جرّب مرة ثانية.");
      window.location.assign(j.url);
    } catch (x) {
      setErr(x instanceof Error ? x.message : "صار خطأ، جرّب مرة ثانية.");
      setBusy(false);
    }
  }

  return (
    <div className="ul-sheet-wrap" role="dialog" aria-modal="true" aria-label={`لامحدود ${g.name}`} onClick={onClose}>
      <div className="ul-sheet" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ul-x" aria-label="إغلاق" onClick={onClose}>✕</button>
        <span className="ul-sheet-k" dir="ltr">⚡ UNLIMITED</span>
        <h3 dir="ltr" className="ul-sheet-n">{g.name}</h3>

        {g.options.length > 1 && (
          <div className="ul-seg" role="radiogroup" aria-label="الدقة">
            {g.options.map((o) => (
              <button key={o.key} type="button" role="radio" aria-checked={o.key === opt.key} className={o.key === opt.key ? "on" : ""} onClick={() => setOpt(o)} dir="ltr">
                {o.quality}
              </button>
            ))}
          </div>
        )}
        <div className="ul-seg" role="radiogroup" aria-label="المدة">
          {([24, 12] as const).map((h) => (
            <button key={h} type="button" role="radio" aria-checked={h === hours} className={h === hours ? "on" : ""} onClick={() => setHours(h)}>
              {h === 24 ? "يوم كامل ٢٤ ساعة" : "١٢ ساعة · نص السعر"}
            </button>
          ))}
        </div>

        <div className="ul-price">
          {fastWorth != null && fastWorth > p && (
            <span className="ul-was">
              قيمة السريع وحده <s><Riyal halalas={Math.round(fastWorth * 100)} size={14} /></s>
            </span>
          )}
          <span className="ul-now">
            <Riyal halalas={p * 100} size={40} className="ul-now-n" />
          </span>
          <span className="ul-per">لامحدود {hours === 24 ? "٢٤ ساعة" : "١٢ ساعة"}{opt.quality ? ` · ${opt.quality}` : ""}</span>
        </div>
        {breakEven != null && (
          <p className="ul-hook">
            ال{unit} الواحد{video ? ` (${ar(maxVideoSec)} ثانية)` : "ة"} عادةً بـ <Riyal halalas={opt.usual!} size={14} className="ul-hook-n" />.
            <br />
            من {video ? "الفيديو" : "الصورة"} رقم <b>{ar(breakEven)}</b> وطالع، كل شي عليك ببلاش.
          </p>
        )}

        <ul className="ul-terms" aria-label="الشروط باختصار">
          <li>لمولّد واحد{opt.quality ? ` بدقة ${opt.quality}` : ""}، من لحظة الدفع لين {hours === 24 ? "٢٤" : "١٢"} ساعة.</li>
          <li>
            عندك توليد <b>سريع</b> ({video ? `${ar(fast)} ثانية فيديو` : `${ar(fast)} صورة`} كل ١٢ ساعة). إذا خلص تكمل بلا حدود، بس يصير التوليد <b>بطيء</b> وبدون انتظام في البطء، ويرجع السريع كامل بعد ١٢ ساعة.
          </li>
          {video && <li>كل فيديو لين {ar(maxVideoSec)} ثانية، والأطول ينحسب من رصيدك عادي.</li>}
          {g.name.includes("وجه واقعي") && <li>يحتاج صورة وجهك مرجع.</li>}
          <li>التوليد اللي يفشل ما ينحسب. للاستخدام الشخصي.</li>
          <li>دفعة وحدة بدون تجديد، وما فيه استرداد بعد الشراء.</li>
        </ul>

        {opt.running ? (
          <p className="ul-ok ul-ok-s">✓ هذا شغّال عندك الحين.</p>
        ) : open ? (
          <button type="button" className="ul-btn" onClick={buy} disabled={busy}>
            {busy ? "لحظة…" : <>{login ? "سجّل دخول واشترك بـ" : "⚡ اشترك الحين بـ"} <Riyal halalas={p * 100} size={18} /></>}
          </button>
        ) : (
          <p className="ul-over">العرض مقفل الحين.</p>
        )}
        <p className="ul-pay">مدى · فيزا · ماستركارد · Apple Pay</p>
        {err && <p className="ul-err ul-err-s">{err}</p>}
      </div>
    </div>
  );
}
