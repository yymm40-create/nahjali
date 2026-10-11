"use client";

// «اطلب من حيدرة»: the one box at the top of the pro look — type what to do («شيل السكتات وحط كابشن», «خلي البشرة
// أدفى») and Enter hands it to حيدرة, who opens and does it. «/» puts the cursor here from anywhere (not while typing).

import { useEffect, useRef, useState } from "react";
import Icon from "../Icon";

export default function CommandBar({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [text, setText] = useState("");
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // «/» from anywhere but a box being typed in (the shortcut maps of the editors people come from never use it)
    const key = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      e.preventDefault();
      box.current?.focus();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const send = () => {
    const t = text.trim();
    if (!t || disabled) return;
    setText("");
    onSend(t);
    box.current?.blur();
  };
  return (
    <label className="pro-cmd" title="اطلب من حيدرة أي شي: يشتغل ويعدّل لك (اضغط / للكتابة)">
      <Icon name="search" size={14} />
      <input ref={box} value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && send()} placeholder="اطلب من حيدرة… «شيل السكتات وحط كابشن»" maxLength={500} aria-label="اطلب من حيدرة" />
      <kbd dir="ltr">/</kbd>
    </label>
  );
}
