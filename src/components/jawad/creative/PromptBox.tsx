"use client";

import { useState } from "react";
import type { CreativePrompt } from "@config/jawad/creative";

/** One prompt as it was sent: the generator, its settings and references, and the English text with a copy button. */
export default function PromptBox({ p }: { p: CreativePrompt }) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.text);
      setCopied("ok");
    } catch {
      // older browsers / no clipboard permission: copy through a hidden text box
      const ta = document.createElement("textarea");
      ta.value = p.text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      setCopied(ok ? "ok" : "fail");
    }
    setTimeout(() => setCopied(null), 2200);
  };
  return (
    <div className="cr-prompt">
      <div className="cr-ph">
        <div className="cr-pt">
          <b>{p.label}</b>
          <span className="cr-tool" dir="ltr">{p.tool}</span>
          {p.settings && <span className="cr-set">{p.settings}</span>}
        </div>
        <button type="button" className={`cr-copy${copied === "ok" ? " ok" : ""}`} onClick={copy} aria-label={`انسخ برومبت ${p.label}`}>
          {copied === "ok" ? "✓ انتسخ" : copied === "fail" ? "حدّده وانسخه" : "انسخ البرومبت"}
        </button>
      </div>
      {p.refs?.length ? (
        <ul className="cr-refs" aria-label="المراجع المرفقة">
          {p.refs.map((r) => (
            <li key={r.tag + r.name}>
              {r.src ? <img src={r.src} alt="" loading="lazy" /> : <span className="cr-ri" aria-hidden>{r.tag.startsWith("@aud") ? "🎙️" : "🖼️"}</span>}
              <span>
                <b dir="ltr">{r.tag}</b>
                <small>{r.name}</small>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {p.note && <p className="cr-note">{p.note}</p>}
      <pre dir="ltr" className="cr-text">{p.text.split(/(«[^»]*»)/).map((x, i) => (i % 2 ? <bdi key={i} dir="rtl" className="cr-ar">{x}</bdi> : x))}</pre>
    </div>
  );
}
