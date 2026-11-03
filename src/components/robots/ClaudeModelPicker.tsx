"use client";

import { useState } from "react";
import Coined from "@/components/Coined";
import { CLAUDE_MARGIN_PCT, capClaudeModel, claudeModelOf, modelsUpTo, typicalReplyUsd } from "@config/claude-models";
import { claudeHalalas, coinStr, costHalalas } from "@config/coins";
import { usePerks } from "@/components/usePerks";
import { useClaudeModel } from "./claude-model";

/**
 * The mind that answers in this chat (العبقري · الأصيل · الرشيق · الخفيف — our own names, nothing says whose they are): the
 * choice is the person's, kept for every robot. Each has its advice and a typical reply's price; the platform's profit on the
 * usage is CLAUDE_MARGIN_PCT, said here.
 * Neutral colours (they follow the text colour) so it sits in any robot's page.
 */
export default function ClaudeModelPicker({ className = "", disabled = false, menu = false, spent = 0 }: { className?: string; disabled?: boolean; /** a small name in a composer that opens a menu above it (Claude's way) */ menu?: boolean; /** what was really taken in THIS conversation so far (halalas); 0 before the first reply, shown instead of the estimate */ spent?: number }) {
  const [picked, choose] = useClaudeModel();
  const [open, setOpen] = useState(false);
  // a code («الأكواد») may cap the model and price everything at cost: the list stops at the ceiling, and a pick above it shows as the ceiling
  const perks = usePerks();
  const model = claudeModelOf(capClaudeModel(picked.id, perks.claudeModel));
  const reply = (m: typeof model) => (perks.atCost ? costHalalas(typicalReplyUsd(m)) : claudeHalalas(typicalReplyUsd(m)));
  const line = "1px solid color-mix(in srgb, currentColor 22%, transparent)";
  if (menu)
    return (
      <span className={className} style={{ position: "relative", fontSize: 13 }} dir="rtl">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={disabled} style={{ border: 0, borderRadius: 999, padding: "4px 10px", background: "transparent", color: "inherit", opacity: 0.75, cursor: "pointer", fontSize: 13 }}>
          {model.name} ▾
        </button>
        {open && (
          <>
            <button type="button" aria-label="إغلاق" onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10, background: "transparent", border: 0, cursor: "default" }} />
            <span role="radiogroup" aria-label="اختيار الذكاء" style={{ position: "absolute", bottom: "100%", insetInlineStart: 0, zIndex: 20, marginBottom: 8, width: 290, display: "block", border: line, borderRadius: 16, padding: 6, background: "var(--jw-surface-2, #161a20)", boxShadow: "0 18px 50px -18px rgba(0,0,0,.8)" }}>
              {modelsUpTo(perks.claudeModel).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={m.id === model.id}
                  onClick={() => (choose(m.id), setOpen(false))}
                  style={{ display: "block", width: "100%", textAlign: "start", border: 0, borderRadius: 12, padding: "8px 12px", background: m.id === model.id ? "color-mix(in srgb, currentColor 10%, transparent)" : "transparent", color: "inherit", cursor: "pointer" }}
                >
                  <b style={{ display: "block", fontSize: 14 }}>
                    {m.name}
                    {m.id === model.id ? " ✓" : ""}
                  </b>
                  <span style={{ display: "block", opacity: 0.7, fontSize: 12 }}>
                    {m.tagline} · <Coined text={`≈ ${coinStr(reply(m))} للرد`} size={12} />
                  </span>
                </button>
              ))}
              <span style={{ display: "block", padding: "6px 12px 4px", opacity: 0.7, fontSize: 11.5, lineHeight: 1.6 }}>💡 {model.advice}</span>
              {spent > 0 && (
                <span style={{ display: "block", padding: "2px 12px 6px", fontWeight: 700, fontSize: 12 }}>
                  💰 {perks.free ? "قيمة هذي المحادثة" : "أُخذ منك في هذي المحادثة"} <Coined text={coinStr(spent)} size={12} />
                </span>
              )}
            </span>
          </>
        )}
      </span>
    );
  return (
    <div className={className} style={{ fontSize: 12, lineHeight: 1.7 }} dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={disabled}
        style={{ border: line, borderRadius: 999, padding: "2px 10px", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 12 }}
      >
        🧠 {model.name} · <Coined text={spent > 0 ? (perks.free ? `قيمة هذي المحادثة ${coinStr(spent)} (مجانية لك)` : `أُخذ منك ${coinStr(spent)} في هذي المحادثة`) : `≈ ${coinStr(reply(model))} للرد`} size={12} /> {open ? "▴" : "▾"}
      </button>
      {open && (
        <div style={{ marginTop: 6, border: line, borderRadius: 12, padding: 10 }}>
          <div role="radiogroup" aria-label="اختيار الذكاء" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {modelsUpTo(perks.claudeModel).map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={m.id === model.id}
                onClick={() => choose(m.id)}
                style={{
                  border: m.id === model.id ? "2px solid currentColor" : line,
                  borderRadius: 10,
                  padding: "4px 10px",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  fontWeight: m.id === model.id ? 700 : 400,
                  fontSize: 12,
                }}
              >
                {m.name}
                <span style={{ display: "block", opacity: 0.7, fontSize: 11 }}>{m.tagline}</span>
              </button>
            ))}
          </div>
          <p style={{ margin: "8px 0 0" }}>💡 {model.advice}</p>
          {spent > 0 && (perks.free
            ? <p style={{ margin: "4px 0 0", fontWeight: 700 }}>💰 قيمة هذي المحادثة بالضبط <Coined text={coinStr(spent)} size={12} /> لين الحين — مجانية لك، ما ينخصم من رصيدك شي.</p>
            : <p style={{ margin: "4px 0 0", fontWeight: 700 }}>💰 أُخذ منك بالضبط <Coined text={coinStr(spent)} size={12} /> في هذي المحادثة لين الحين.</p>)}
          <p style={{ margin: "4px 0 0", opacity: 0.8 }}>
            {spent > 0 ? "كل رد" : "الرد العادي"} تقريبًا <Coined text={coinStr(reply(model))} size={12} />، ويختلف حسب طول المحادثة والموديل. {perks.atCost ? "الخصم من رصيدك هو تكلفة الاستخدام الفعلية (مدخلات ومخرجات) بدون أي ربح." : `الخصم من رصيدك هو تكلفة الاستخدام الفعلية + ${CLAUDE_MARGIN_PCT}٪ فقط ربح للمنصة.`}
          </p>
        </div>
      )}
    </div>
  );
}
