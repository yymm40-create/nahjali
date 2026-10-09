"use client";

// Clickable answers under the last reply of a chat, always with «✍️ اكتب إجابة مختلفة» (the box to write in gets the
// focus). Colours in an option (#RRGGBB) are drawn as swatches. The chats style them with their own prefix:
// `${cls}-opts`, `${cls}-opt`, `${cls}-opt-write`, `${cls}-sw`.

import { splitColors } from "@/lib/chat-options";

export function Swatches({ text, cls }: { text: string; cls: string }) {
  return (
    <>
      {splitColors(text).map((p, i) =>
        p.color ? (
          <span key={i} className={`${cls}-chip`} dir="ltr">
            <i className={`${cls}-sw`} style={{ background: p.text }} />
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export default function QuickReplies({ options, onPick, onWrite, disabled, cls }: { options: string[]; onPick: (text: string) => void; onWrite: () => void; disabled?: boolean; cls: string }) {
  if (!options.length) return null;
  return (
    <div className={`${cls}-opts`} role="group" aria-label="اختر إجابة">
      {options.map((o) => (
        <button key={o} type="button" className={`${cls}-opt`} disabled={disabled} onClick={() => onPick(o)}>
          <Swatches text={o} cls={cls} />
        </button>
      ))}
      <button type="button" className={`${cls}-opt ${cls}-opt-write`} disabled={disabled} onClick={onWrite}>
        ✍️ اكتب إجابة مختلفة
      </button>
    </div>
  );
}
