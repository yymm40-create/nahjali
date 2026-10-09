"use client";

// The diagnostician's answer inside the 🐞 dialog: what he found (Arabic), what is missing, what he looked at, and the
// message for the developer with a copy button (plus «copy everything» for the whole exchange).

import { useState } from "react";

export interface DiagnoseAnswer {
  reply: string;
  developerMessage: string;
  missing: string[];
  looked: string[];
  rounds: number;
}

export default function DiagnoseBox({ answer, question }: { answer: DiagnoseAnswer; question: string }) {
  const [msg, setMsg] = useState("");
  const [seeLooked, setSeeLooked] = useState(false);
  async function copy(text: string, ok: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(ok);
    } catch {
      setMsg("تعذّر النسخ؛ حدّد النص وانسخه يدويًا.");
    }
  }
  const all = [
    `سؤالي: ${question}`,
    `\nتشخيص الموقع:\n${answer.reply}`,
    answer.missing.length ? `\nالناقص:\n${answer.missing.map((m) => `- ${m}`).join("\n")}` : "",
    answer.developerMessage ? `\nرسالة للمطوّر:\n${answer.developerMessage}` : "",
  ].filter(Boolean).join("\n");
  return (
    <div style={{ display: "grid", gap: 8, padding: 10, borderRadius: 12, border: "1px solid var(--jw-line, #444)" }}>
      <b>🔎 التشخيص</b>
      <div dir="auto" style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.7 }}>{answer.reply}</div>
      {answer.missing.length > 0 && (
        <div style={{ fontSize: 13 }}>
          <b>المطلوب منك:</b>
          <ul style={{ margin: "4px 0 0", paddingInlineStart: 18 }}>{answer.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}
      {answer.developerMessage && (
        <>
          <b>رسالة للمطوّر</b>
          <textarea readOnly dir="ltr" rows={7} value={answer.developerMessage} style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px dashed var(--jw-line, #444)", background: "transparent", color: "inherit", fontSize: 11 }} />
        </>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {answer.developerMessage && <button type="button" className="jw-btn jw-btn-primary" onClick={() => void copy(answer.developerMessage, "✅ نسخت رسالة المطوّر. الصقها في المحادثة مع Claude.")}>📋 انسخ رسالة المطوّر</button>}
        <button type="button" className="jw-btn" onClick={() => void copy(all, "✅ نسخت كل التشخيص.")}>📋 انسخ الكل</button>
        {answer.looked.length > 0 && <button type="button" className="jw-btn" onClick={() => setSeeLooked((v) => !v)}>👀 وش فحص ({answer.looked.length})</button>}
      </div>
      {seeLooked && <small dir="auto" style={{ opacity: 0.8, whiteSpace: "pre-wrap" }}>{answer.looked.join("\n")}</small>}
      {msg && <small>{msg}</small>}
    </div>
  );
}
