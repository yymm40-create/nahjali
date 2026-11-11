"use client";

// «المصمم الذكي» — the two galleries it takes from «صانع المحتوى»: «قائمة الخطوط» (the same 50 Arabic fonts, by group,
// each written in itself; its file is fetched when its card comes into view) and «معرض الألوان» (the same 100 Color
// Hunt palettes, by group). A pick becomes the answer with its mark ([خط:id] / [ألوان:id]), which the server reads and
// hands to «حيدرا ماكس». In the light look of designer.css.

import { useEffect, useRef, useState } from "react";
import { CONTENT_FONTS, FONT_GROUPS, type ContentFont } from "@config/content-fonts";
import { CONTENT_PALETTES } from "@config/content-palettes";
import { familyOf, loadFont } from "@/components/jawad/editor/fontload";

const ALL = "الكل";

function FontCard({ f, picked, disabled, onPick }: { f: ContentFont; picked: boolean; disabled: boolean; onPick: () => void }) {
  const el = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready || !el.current) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          io.disconnect();
          void loadFont(f.id, 400).then((ok) => ok && setReady(true));
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(el.current);
    return () => io.disconnect();
  }, [f.id, ready]);
  const look = { fontFamily: ready ? `"${familyOf(f.id)}", sans-serif` : undefined, opacity: ready ? 1 : 0.4 };
  return (
    <button ref={el} type="button" className="dz-fontcard" aria-pressed={picked} disabled={disabled} onClick={onPick} title={`${f.feel} — يناسب ${f.bestFor}`}>
      <span className="sample" style={look}>بسم الله الرحمن الرحيم</span>
      <small>{f.top ? "★ " : ""}{f.name}</small>
    </button>
  );
}

/** «قائمة الخطوط»: the 50 fonts by group, and «اختر لي». */
export function FontList({ picked, disabled, onPick, onAuto, autoPicked }: { picked: string | null; disabled: boolean; onPick: (f: ContentFont) => void; onAuto: () => void; autoPicked: boolean }) {
  const [group, setGroup] = useState<string>(ALL);
  const shown = CONTENT_FONTS.filter((f) => group === ALL || f.group === group);
  return (
    <div className="dz-pick">
      <div className="dz-pick-chips" role="group" aria-label="نوع الخط">
        {[ALL, ...FONT_GROUPS].map((g) => (
          <button key={g} type="button" className="dz-opt" aria-pressed={group === g} onClick={() => setGroup(g)}>
            {g} <small>{g === ALL ? CONTENT_FONTS.length : CONTENT_FONTS.filter((f) => f.group === g).length}</small>
          </button>
        ))}
      </div>
      <div className="dz-fonts">
        {shown.map((f) => <FontCard key={f.id} f={f} picked={picked === f.id} disabled={disabled} onPick={() => onPick(f)} />)}
      </div>
      <button type="button" className="dz-opt dz-opt-write" aria-pressed={autoPicked} disabled={disabled} onClick={onAuto}>🎲 اختر لي الأنسب</button>
    </div>
  );
}

const PALETTE_GROUPS = [...new Set(CONTENT_PALETTES.map((p) => p.group))];

/** «معرض الألوان»: the 100 palettes by group, and «ألوان الاتجاه أو اختر لي». */
export function PaletteGrid({ picked, disabled, onPick, onAuto, autoPicked }: { picked: string | null; disabled: boolean; onPick: (p: { id: string; name: string }) => void; onAuto: () => void; autoPicked: boolean }) {
  const [group, setGroup] = useState<string>(PALETTE_GROUPS[0] ?? ALL);
  const shown = CONTENT_PALETTES.filter((p) => group === ALL || p.group === group);
  return (
    <div className="dz-pick">
      <div className="dz-pick-chips" role="group" aria-label="نوع الألوان">
        {[ALL, ...PALETTE_GROUPS].map((g) => (
          <button key={g} type="button" className="dz-opt" aria-pressed={group === g} onClick={() => setGroup(g)}>
            {g} <small>{g === ALL ? CONTENT_PALETTES.length : CONTENT_PALETTES.filter((p) => p.group === g).length}</small>
          </button>
        ))}
      </div>
      <div className="dz-pals">
        {shown.map((p) => (
          <button key={p.id} type="button" className="dz-pal" aria-pressed={picked === p.id} disabled={disabled} onClick={() => onPick(p)} title={p.colors.join(" ")}>
            <span className="dz-pal-bar">{p.colors.map((c) => <span key={c} style={{ background: c }} />)}</span>
            <small>{p.name}</small>
          </button>
        ))}
      </div>
      <button type="button" className="dz-opt dz-opt-write" aria-pressed={autoPicked} disabled={disabled} onClick={onAuto}>🎨 ألوان الاتجاه أو اختر لي</button>
    </div>
  );
}
