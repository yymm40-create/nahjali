"use client";

import { useEffect, useState } from "react";

// What to do here, in one short line, as if explaining to a child. Hidden once dismissed (per browser, per kind).
const HINTS: Record<string, { icon: string; text: string }> = {
  image: { icon: "🎨", text: "اكتب اللي تتخيله كأنك توصفه لصديقك: مين؟ وين؟ أي لون؟ وبعدين اضغط «توليد»." },
  video: { icon: "🎬", text: "صف المشهد وحركته: مين يتحرك؟ ووين تروح الكاميرا؟ ابدأ بمقطع قصير (٥ ثواني)." },
  audio: { icon: "🎙️", text: "اكتب الجملة، اختر صوت، واسمع. علامات الترقيم (، . ؟ !) تغيّر نبرة الكلام." },
  film: { icon: "🎞️", text: "فيلمك خطوة بخطوة: قصة ← سيناريو ← شخصيات وأماكن ← مخرج ← مقاطع. اعتمد كل خطوة وتنتقل للي بعدها لحالها." },
};

const KEY = (kind: string) => `jawad:hint-hidden:${kind}`;

export default function SectionHint({ kind }: { kind: string | null }) {
  const hint = kind ? HINTS[kind] : undefined;
  // shown after mounting, so a dismissed hint never flashes and the server render stays the same
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!kind) return;
    let hidden = false;
    try {
      hidden = localStorage.getItem(KEY(kind)) === "1";
    } catch {
      // storage blocked: just show it
    }
    const t = setTimeout(() => setShow(!hidden), 0);
    return () => clearTimeout(t);
  }, [kind]);
  if (!hint || !show) return null;
  return (
    <p className="jw-hint" role="note">
      <span aria-hidden className="text-lg leading-7">{hint.icon}</span>
      <span className="flex-1">{hint.text}</span>
      <button
        type="button"
        className="shrink-0 rounded-full px-2 text-sm text-jw-muted hover:text-jw-ink"
        aria-label="فهمت، أخفِ التلميح"
        onClick={() => {
          setShow(false);
          try {
            localStorage.setItem(KEY(kind!), "1");
          } catch {
            // nothing to remember
          }
        }}
      >
        فهمت ✕
      </button>
    </p>
  );
}
