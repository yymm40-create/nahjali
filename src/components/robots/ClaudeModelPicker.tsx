"use client";

import { useState } from "react";
import Coined from "@/components/Coined";
import { CLAUDE_MARGIN_PCT, CLAUDE_MODELS, typicalReplyUsd } from "@config/claude-models";
import { claudeHalalas, coinStr } from "@config/coins";
import { useClaudeModel } from "./claude-model";

/**
 * The mind that answers in this chat (العبقري · الأصيل · الرشيق · الخفيف — our own names, nothing says whose they are): the
 * choice is the person's, kept for every robot. Each has its advice and a typical reply's price; the platform's profit on the
 * usage is 10%, said here.
 * Neutral colours (they follow the text colour) so it sits in any robot's page.
 */
export default function ClaudeModelPicker({ className = "", disabled = false }: { className?: string; disabled?: boolean }) {
  const [model, choose] = useClaudeModel();
  const [open, setOpen] = useState(false);
  const line = "1px solid color-mix(in srgb, currentColor 22%, transparent)";
  return (
    <div className={className} style={{ fontSize: 12, lineHeight: 1.7 }} dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={disabled}
        style={{ border: line, borderRadius: 999, padding: "2px 10px", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 12 }}
      >
        🧠 {model.name} · <Coined text={`≈ ${coinStr(claudeHalalas(typicalReplyUsd(model)))} للرد`} size={12} /> {open ? "▴" : "▾"}
      </button>
      {open && (
        <div style={{ marginTop: 6, border: line, borderRadius: 12, padding: 10 }}>
          <div role="radiogroup" aria-label="اختيار الذكاء" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CLAUDE_MODELS.map((m) => (
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
          <p style={{ margin: "4px 0 0", opacity: 0.8 }}>
            الرد العادي تقريبًا <Coined text={coinStr(claudeHalalas(typicalReplyUsd(model)))} size={12} />، ويختلف حسب طول المحادثة والموديل. الخصم من رصيدك هو تكلفة الاستخدام الفعلية + {CLAUDE_MARGIN_PCT}٪ فقط ربح للمنصة.
          </p>
        </div>
      )}
    </div>
  );
}
