"use client";

// «🎬 أساليب الموشن» — the one place the person picks a motion style: ten cards, each a picture the engine draws of
// its look, a name, one line and its energy. Press a card: it opens with what it is for, a box for the topic and
// «ابدأ» — and حيدرا ماكس gets one clear sentence. It replaced four tabs of forty skills, looks and feelings that repeated
// each other (the owner: «عفسة وفيه تكرارات»). Works inside حيدرا ماكس's popup and on a phone.

import { useMemo, useState } from "react";
import { MOTION_TEN, askForTen, type MotionTen } from "@/lib/editor/motion-ten";
import { framePreviewUri, previewUri } from "@/lib/editor/motion-preview";
import { motionStyleOf } from "@/lib/editor/motion-styles";

const ENERGY_AR = ["", "هادئ جدًا", "هادئ", "متوسط", "حماسي", "ناري"];

function picture(s: MotionTen) {
  const base = motionStyleOf(s.base);
  return s.talk && base?.talk ? framePreviewUri(base.talk) : previewUri({ style: s.base });
}

export default function StylePicker({ open, onClose, onSend, disabled }: { open: boolean; onClose: () => void; onSend: (words: string) => void; disabled?: boolean }) {
  const [sel, setSel] = useState<MotionTen | null>(null);
  const [topic, setTopic] = useState("");
  // drawn once (the engine is deterministic)
  const pics = useMemo(() => (open ? Object.fromEntries(MOTION_TEN.map((s) => [s.id, picture(s)])) : {}), [open]);
  if (!open) return null;

  const close = () => {
    setSel(null);
    setTopic("");
    onClose();
  };
  const go = () => {
    if (!sel) return;
    onSend(askForTen(sel, topic));
    close();
  };

  return (
    <div className="sp-back" role="dialog" aria-modal="true" aria-label="أساليب الموشن" dir="rtl" onClick={close}>
      <div className="sp-box" onClick={(e) => e.stopPropagation()}>
        <header className="sp-head">
          <b>🎬 اختر أسلوب الموشن</b>
          <span>عشرة أساليب، كل واحد مختلف تمامًا</span>
          <button type="button" className="sp-x" onClick={close} aria-label="إغلاق">
            ✕
          </button>
        </header>

        {!sel ? (
          <div className="sp-grid">
            {MOTION_TEN.map((s) => (
              <button key={s.id} type="button" className="sp-card" onClick={() => setSel(s)}>
                <img src={pics[s.id]} alt="" className="sp-pic" />
                <span className="sp-name">
                  <span aria-hidden>{s.icon}</span> {s.ar}
                </span>
                <span className="sp-one">{s.one}</span>
                <span className="sp-energy" aria-label={`الطاقة: ${ENERGY_AR[s.energy]}`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <i key={i} className={i < s.energy ? "on" : ""} />
                  ))}
                  {s.talk && <em>على فيديو كلامك</em>}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="sp-detail">
            <button type="button" className="sp-back-btn" onClick={() => setSel(null)}>
              → كل الأساليب
            </button>
            <div className="sp-detail-top">
              <img src={pics[sel.id]} alt="" className="sp-pic big" />
              <div className="min-w-0">
                <b className="sp-title">
                  {sel.icon} {sel.ar}
                </b>
                <p className="sp-one">{sel.one}</p>
                <p className="sp-when">
                  <b>يناسب:</b> {sel.when}
                </p>
                <span className="sp-energy">
                  {Array.from({ length: 5 }, (_, i) => (
                    <i key={i} className={i < sel.energy ? "on" : ""} />
                  ))}
                  <em>{ENERGY_AR[sel.energy]}</em>
                </span>
              </div>
            </div>
            <label className="sp-field">
              <span>{sel.talk ? "شي تبي حيدرا ماكس ينتبه له؟ (اختياري)" : "عن وش الفيديو؟"}</span>
              <textarea
                rows={2}
                value={topic}
                autoFocus
                onChange={(e) => setTopic(e.target.value)}
                placeholder={sel.talk ? "مثلًا: ركّز على الأرقام اللي أقولها" : "مثلًا: تطبيق يرتّب مواعيدك، ٣٠ ثانية، للسوشال"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (sel.talk || topic.trim()) go();
                  }
                }}
              />
            </label>
            <button type="button" className="sp-go" disabled={disabled || (!sel.talk && !topic.trim())} onClick={go}>
              ✨ ابدأ بهالأسلوب
            </button>
            <p className="sp-hint">حيدرا ماكس يسألك بس اللي ناقصه، وكل شي يطلع قابل للتعديل.</p>
          </div>
        )}
      </div>
    </div>
  );
}
