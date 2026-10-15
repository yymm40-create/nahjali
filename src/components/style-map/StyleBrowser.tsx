"use client";

// «خريطة الستايلات»: the one way the library's 100 styles are browsed, in the studios' «🎨 الستايل» and in the film's
// style test (scene, film, short scene and series alike). The 14 families are chips on top (with «الكل»), each family
// opens into its studios / schools, and a search box finds a style by its name, school or what it suits. A style with
// no picture yet shows a tile in its family's colours.

import { useMemo, useState } from "react";
import { STYLE_FAMILIES } from "@config/film-styles";

export interface StyleCardView {
  id: string;
  family: string;
  school: string;
  name: string;
  description: string;
  feel: string;
  bestFor: string;
  image: string | null;
  photoreal?: boolean;
}

const SKIN = {
  jawad: { line: "border-jw-line", on: "border-jw-accent ring-2 ring-jw-accent/40", muted: "text-jw-muted", faint: "text-jw-faint", input: "jw-input min-h-10 w-full text-sm", chip: "border-jw-line", chipOn: "border-jw-accent bg-jw-accent/15 font-bold" },
  film: { line: "border-line", on: "border-2 border-gold bg-surface-2", muted: "text-muted", faint: "text-muted", input: "field min-h-10 w-full text-sm", chip: "border-line", chipOn: "border-gold bg-gold/15 font-extrabold" },
} as const;

/** A style's picture, or its family's tile until it has one. */
export function StyleThumb({ s, className = "" }: { s: Pick<StyleCardView, "family" | "name" | "image">; className?: string }) {
  if (s.image) {
    // eslint-disable-next-line @next/next/no-img-element -- a static picture or one kept in the public bucket
    return <img src={s.image} alt={s.name} loading="lazy" className={`aspect-video w-full object-cover ${className}`} />;
  }
  const f = STYLE_FAMILIES.find((x) => x.id === s.family);
  return (
    <span className={`grid aspect-video w-full place-items-center text-center ${className}`} style={{ background: `linear-gradient(135deg, ${f?.tone[0] ?? "#555"}, ${f?.tone[1] ?? "#222"})` }} aria-label={s.name}>
      <span className="space-y-0.5 px-2 text-white drop-shadow">
        <span className="block text-2xl">{f?.icon ?? "🎨"}</span>
        <b className="block text-xs">{s.name}</b>
      </span>
    </span>
  );
}

const norm = (t: string) => t.toLowerCase().replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");

export default function StyleBrowser({ styles, selected, onPick, skin, cols = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" }: {
  styles: StyleCardView[];
  selected: string[];
  onPick: (id: string) => void;
  skin: keyof typeof SKIN;
  cols?: string;
}) {
  const k = SKIN[skin];
  const [family, setFamily] = useState<string>("all");
  const [q, setQ] = useState("");
  const families = useMemo(() => STYLE_FAMILIES.map((f) => ({ ...f, count: styles.filter((s) => s.family === f.id).length })).filter((f) => f.count), [styles]);
  const shown = useMemo(() => {
    const words = norm(q.trim()).split(/\s+/).filter(Boolean);
    return styles.filter((s) => (family === "all" || s.family === family) && words.every((w) => norm(`${s.name} ${s.school} ${s.description} ${s.feel} ${s.bestFor}`).includes(w)));
  }, [styles, family, q]);
  const sections = families
    .map((f) => {
      const inF = shown.filter((s) => s.family === f.id);
      return { f, schools: [...new Set(inF.map((s) => s.school))].map((school) => ({ school, list: inF.filter((s) => s.school === school) })) };
    })
    .filter((x) => x.schools.length);

  return (
    <div className="space-y-4">
      <input className={k.input} type="search" placeholder="🔎 دوّر: بيكسار، أنمي، صلصال، أطفال، منمنمة…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ابحث في الستايلات" />
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="عائلات الستايلات">
        {[{ id: "all", name: "الكل", icon: "🗺️", count: styles.length }, ...families].map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={family === f.id} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${family === f.id ? k.chipOn : k.chip}`} onClick={() => setFamily(f.id)}>
            {f.icon} {f.name} <span className={k.faint}>({f.count})</span>
          </button>
        ))}
      </div>
      {!sections.length && <p className={`text-sm ${k.muted}`}>ما لقينا ستايل بهالكلمة — جرّب كلمة ثانية أو اختر «الكل».</p>}
      {sections.map(({ f, schools }) => (
        <section key={f.id} className="space-y-3">
          <h3 className="text-sm font-black">
            {f.icon} {f.name} <span className={`text-xs font-normal ${k.muted}`}>— {f.hint}</span>
          </h3>
          {schools.map(({ school, list }) => (
            <div key={school} className="space-y-2">
              <p className={`text-xs font-bold ${k.muted}`}>🏢 {school}</p>
              <ul className={`grid gap-3 ${cols}`}>
                {list.map((s) => {
                  const on = selected.includes(s.id);
                  return (
                    <li key={s.id}>
                      <button type="button" className={`w-full overflow-hidden rounded-xl border text-start transition ${on ? k.on : k.line}`} onClick={() => onPick(s.id)} aria-pressed={on}>
                        <StyleThumb s={s} />
                        <span className="block space-y-0.5 p-2">
                          <b className="block text-sm">{s.name}{s.photoreal && <span className={`ms-1 text-[10px] font-normal ${k.muted}`}>· واقعي</span>}</b>
                          <span className={`line-clamp-2 text-[11px] ${k.muted}`}>{s.description}</span>
                          <span className={`block text-[10px] ${k.faint}`}>يناسب: {s.bestFor}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
