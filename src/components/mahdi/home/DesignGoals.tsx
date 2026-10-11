"use client";

// «لأجل المهدي» — the top of the home in each design: the day's two goals (habits and reading) drawn the design's
// way — three rings, a filling bar, glasses of water, a heatmap of weeks, a growing plant, a path of days, a big flame,
// a gauge, a character's level, sticky notes, an eight-pointed star, big numbers… Every one shows the same numbers
// (useDay), with the percentage written beside the drawing (the research: a figure next to the shape reads best).

import Link from "next/link";
import type { GoalsStyle } from "@config/mahdi";
import { fmtPct } from "@/lib/mahdi/i18n";
import { readingText, useDay, XP_LEVEL } from "./useDay";

type Day = ReturnType<typeof useDay>;
const pct = (v: number) => fmtPct(v);

function Ring({ value, r, w, color, track, children }: { value: number; r: number; w: number; color: string; track: string; children?: React.ReactNode }) {
  const C = 2 * Math.PI * r;
  const s = r + w;
  return (
    <span className="relative inline-grid place-items-center">
      <svg width={2 * s} height={2 * s} viewBox={`0 0 ${2 * s} ${2 * s}`} aria-hidden="true">
        <circle cx={s} cy={s} r={r} fill="none" stroke={track} strokeWidth={w} />
        <circle cx={s} cy={s} r={r} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={`${Math.max(0.001, Math.min(1, value)) * C} ${C}`} transform={`rotate(-90 ${s} ${s})`} className="m-ring-arc" />
      </svg>
      {children && <span className="absolute inset-0 grid place-items-center text-center">{children}</span>}
    </span>
  );
}

function Bar({ value, h = 12, color = "var(--m-gold)", track = "var(--m-track)", radius = 999 }: { value: number; h?: number; color?: string; track?: string; radius?: number }) {
  return (
    <span className="block overflow-hidden" style={{ height: h, borderRadius: radius, background: track }}>
      <span className="m-bar-fill block h-full" style={{ width: `${Math.min(1, value) * 100}%`, background: color, borderRadius: radius }} />
    </span>
  );
}

const Card = ({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <section className={`m-card m-widget ${className}`} style={style} aria-label="إنجاز اليوم">
    {children}
  </section>
);

const habitsLine = (d: Day) => (d.hasGoals ? `${d.done} من ${d.required} عادات` : "ما فيه عادات اليوم");
const readingShare = (d: Day) => d.reading?.share ?? 0;

export default function DesignGoals({ style }: { style: GoalsStyle }) {
  const d = useDay();
  switch (style) {
    case "rings3":
      return (
        <Card className="space-y-3">
          <div className="grid place-items-center">
            <Ring value={d.score} r={92} w={20} color="#fa114f" track="#3b0a17">
              <Ring value={readingShare(d)} r={68} w={20} color="#a6ff00" track="#243a00">
                <Ring value={d.week} r={44} w={20} color="#00e5ff" track="#00343a" />
              </Ring>
            </Ring>
          </div>
          <div className="grid grid-cols-3 text-center text-xs">
            <span><b className="m-num block text-lg" style={{ color: "#fa114f" }}>{d.done}/{d.required}</b>عادات</span>
            <span><b className="m-num block text-lg" style={{ color: "#a6ff00" }}>{pct(readingShare(d))}</b>القراءة</span>
            <span><b className="m-num block text-lg" style={{ color: "#00e5ff" }}>{pct(d.week)}</b>الأسبوع</span>
          </div>
        </Card>
      );
    case "bar":
      return (
        <Card className="space-y-3">
          {[
            ["عادات اليوم", d.score, "var(--m-gold)", habitsLine(d)],
            ["القراءة", readingShare(d), "var(--m-gold-2)", readingText(d.reading)],
            ["الأسبوع", d.week, "var(--m-success)", pct(d.week)],
          ].map(([l, v, c, s]) => (
            <div key={String(l)} className="space-y-1.5">
              <p className="flex items-center text-sm">
                <b className="flex-1">{l}</b>
                <span className="m-num m-muted">{s}</span>
              </p>
              <Bar value={Number(v)} h={14} color={String(c)} />
            </div>
          ))}
          {d.streak > 0 && <p className="m-num text-sm m-muted">🔥 {d.streak} يوم متتالي</p>}
        </Card>
      );
    case "liquid": {
      const tank = (v: number, c: string, l: string, s: string) => (
        <div className="flex flex-1 flex-col items-center gap-1">
          <div className="relative h-40 w-full overflow-hidden" style={{ borderRadius: 26, background: "var(--m-surface-2)", border: "2px solid var(--m-line)" }}>
            <div className="m-liquid absolute inset-x-0 bottom-0" style={{ height: `${Math.min(1, v) * 100}%`, background: c }}>
              <svg viewBox="0 0 120 12" preserveAspectRatio="none" className="m-wave absolute -top-2.5 h-3 w-[200%]" aria-hidden="true">
                <path d="M0 6 Q15 0 30 6 T60 6 T90 6 T120 6 V12 H0Z" fill={c} />
              </svg>
            </div>
            <b className="m-num absolute inset-0 grid place-items-center text-2xl">{pct(v)}</b>
          </div>
          <b>{l}</b>
          <small className="m-num m-muted">{s}</small>
        </div>
      );
      return (
        <div className="flex gap-3">
          {tank(d.score, "var(--m-gold)", "العادات", habitsLine(d))}
          {tank(readingShare(d), "var(--m-gold-2)", "القراءة", readingText(d.reading))}
        </div>
      );
    }
    case "heatmap": {
      const cells = d.series(15 * 7);
      return (
        <Card className="space-y-3">
          <p className="flex items-center text-sm">
            <b className="flex-1">آخر ١٥ أسبوع</b>
            <span className="m-num" style={{ color: "var(--m-gold)" }}>
              ثبات {pct(cells.filter((c) => (c.score ?? 0) >= 0.6).length / Math.max(1, cells.filter((c) => c.score !== null).length))}
            </span>
          </p>
          <div className="grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: "repeat(7, 1fr)" }} role="img" aria-label="أيامك في آخر ١٥ أسبوع">
            {cells.map((c) => (
              <span key={c.date} className="aspect-square rounded-[3px]" style={{ background: c.score ? `color-mix(in srgb, var(--m-gold) ${Math.round(25 + c.score * 75)}%, var(--m-track))` : "var(--m-track)" }} title={c.date} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[["العادات", `${d.done}/${d.required}`], ["القراءة", d.reading ? `${d.reading.done}` : "—"], ["السلسلة", `${d.streak} 🔥`]].map(([l, v]) => (
              <span key={l} className="m-soft p-2">
                <small className="m-muted block">{l}</small>
                <b className="m-num text-lg">{v}</b>
              </span>
            ))}
          </div>
        </Card>
      );
    }
    case "bento":
      return (
        <div className="grid grid-cols-[1.2fr_1fr] gap-2.5">
          <section className="row-span-2 flex flex-col items-center gap-1.5 p-3 text-white" style={{ background: "var(--m-gold)", borderRadius: "var(--m-radius)" }}>
            <b>العادات</b>
            <Ring value={d.score} r={44} w={12} color="#c7f284" track="rgba(255,255,255,.2)">
              <b className="m-num text-xl">{pct(d.score)}</b>
            </Ring>
            <small className="m-num">{habitsLine(d)}</small>
          </section>
          <section className="p-3" style={{ background: "var(--m-gold-2)", borderRadius: "var(--m-radius)", color: "#1e1b16" }}>
            <small>السلسلة</small>
            <b className="m-num block text-2xl">🔥 {d.streak}</b>
          </section>
          <Link href="/mahdi/reading" className="space-y-1 p-3" style={{ background: "#e8dcff", borderRadius: "var(--m-radius)", color: "#1e1b16" }}>
            <small>القراءة</small>
            <b className="m-num block">{readingText(d.reading)}</b>
            <Bar value={readingShare(d)} h={8} color="#6d4dd8" track="#fff" />
          </Link>
        </div>
      );
    case "segments":
      return (
        <div className="grid gap-3">
          <Card style={{ background: "#ccff00" }}>
            <b className="m-num text-base">عادات اليوم {d.done}/{d.required}</b>
            <div className="mt-2 flex gap-1.5">
              {d.habits.map((h) => (
                <span key={h.inst.key} className="h-6 flex-1 rounded-md" style={{ border: "2.5px solid #121212", background: h.inst.progress >= 1 ? "#ff3d9a" : "#fff" }} />
              ))}
            </div>
          </Card>
          <Card>
            <b className="m-num">القراءة {readingText(d.reading)}</b>
            <div className="mt-2 h-5 overflow-hidden rounded-lg" style={{ border: "2.5px solid #121212", background: "#fff" }}>
              <div className="h-full" style={{ width: `${readingShare(d) * 100}%`, background: "#7c5cff" }} />
            </div>
          </Card>
        </div>
      );
    case "garden": {
      const stage = Math.min(5, 1 + Math.floor(d.score * 5));
      return (
        <Card className="space-y-2">
          <svg viewBox="0 0 200 170" className="mx-auto h-44 w-full" role="img" aria-label={`نبتتك في المرحلة ${stage} من ٥`}>
            <ellipse cx="100" cy="160" rx="70" ry="10" fill="#8bc66b" />
            <path d="M80 160 L85 125 H115 L120 160Z" fill="#c9774a" />
            <rect x="78" y="118" width="44" height="10" rx="4" fill="#b5653c" />
            <path d={`M100 120 C100 ${120 - stage * 8} 98 ${120 - stage * 14} 100 ${120 - stage * 16}`} stroke="#3f8f3a" strokeWidth="5" fill="none" />
            {stage >= 2 && <path d="M100 100 C80 92 72 78 76 70 C92 72 100 84 100 100Z" fill="#5cb85c" />}
            {stage >= 3 && <path d="M100 84 C120 74 132 62 128 52 C112 54 102 66 100 84Z" fill="#6fcf6f" />}
            {stage >= 4 && <path d="M100 66 C82 58 76 46 80 40 C94 42 100 52 100 66Z" fill="#4caf50" />}
            {stage >= 5 && (
              <>
                <circle cx="100" cy="38" r="10" fill="#ffd166" />
                <circle cx="100" cy="38" r="4.5" fill="#ef8354" />
              </>
            )}
          </svg>
          <p className="flex text-sm">
            <b className="flex-1">نبتتك في المرحلة {stage} من ٥</b>
            <span className="m-num">{pct(d.score)}</span>
          </p>
          <Bar value={d.score} h={10} />
          <p className="m-num text-xs m-muted">{habitsLine(d)} · القراءة {readingText(d.reading)}</p>
        </Card>
      );
    }
    case "path": {
      const days = d.series(7);
      const xs = [50, 70, 80, 64, 40, 26, 44];
      return (
        <div className="space-y-3">
          <p className="flex items-center gap-3 font-extrabold">
            <span style={{ color: "#ff9600" }}>🔥 {d.streak}</span>
            <span className="flex-1" />
            <span style={{ color: "#1cb0f6" }}>📖 {d.reading ? pct(d.reading.share) : "—"}</span>
          </p>
          <section className="p-3 text-white" style={{ background: "var(--m-gold)", borderRadius: "var(--m-radius)" }}>
            <small>اليوم</small>
            <b className="m-num block text-base">{habitsLine(d)}</b>
          </section>
          <div className="relative" style={{ height: days.length * 54 }}>
            {[...days].reverse().map((p, k) => {
              const now = k === 0;
              const ok = (p.score ?? 0) >= 0.6;
              const bg = now ? "#ffc800" : ok ? "#58cc02" : "#e5e5e5";
              return (
                <span key={p.date} className="absolute grid place-items-center rounded-full text-xl text-white" style={{ top: k * 54, left: `${xs[k]}%`, translate: "-50% 0", width: now ? 62 : 50, height: now ? 62 : 50, background: bg, boxShadow: `0 6px 0 ${now ? "#e0a800" : ok ? "#46a302" : "#c4c4c4"}` }}>
                  {now ? <b className="m-num text-base">{pct(d.score)}</b> : ok ? "✓" : "·"}
                </span>
              );
            })}
          </div>
        </div>
      );
    }
    case "flame":
      return (
        <section className="flex flex-col items-center gap-2 text-center" aria-label="سلسلة أيامك">
          <span className="m-flame-big" aria-hidden="true">🔥</span>
          <b className="m-num text-6xl leading-none">{d.streak}</b>
          <span>يوم متتالي</span>
          <div className="flex gap-1.5">
            {d.series(7).map((p, k) => (
              <span key={p.date} className="grid size-7 place-items-center rounded-full text-xs font-bold" style={{ background: k === 6 ? "#fff" : (p.score ?? 0) >= 0.6 ? "#ffd166" : "rgba(255,255,255,.2)", color: "#7a1a1a" }}>
                {k === 6 ? "🔥" : (p.score ?? 0) >= 0.6 ? "✓" : ""}
              </span>
            ))}
          </div>
          <div className="m-card w-full space-y-1.5 p-3 text-start">
            <p className="flex text-sm">
              <b className="flex-1">{d.required - d.done > 0 ? `باقي ${d.required - d.done} تكمّل يومك` : "يومك كامل 🎉"}</b>
              <span className="m-num">{pct(d.score)}</span>
            </p>
            <Bar value={d.score} h={10} />
            <p className="m-num text-xs m-muted">القراءة {readingText(d.reading)}</p>
          </div>
        </section>
      );
    case "gauge": {
      const v = (d.score + readingShare(d)) / (d.reading ? 2 : 1);
      const C = Math.PI * 80;
      return (
        <Card className="space-y-3">
          <div className="relative">
            <svg viewBox="0 0 200 110" className="w-full" role="img" aria-label={`درجة يومك ${Math.round(v * 100)}`}>
              <defs>
                <linearGradient id="m-gauge" x1="0" x2="1">
                  <stop offset="0" stopColor="var(--m-gold-2)" />
                  <stop offset="1" stopColor="var(--m-gold)" />
                </linearGradient>
              </defs>
              <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--m-track)" strokeWidth="18" strokeLinecap="round" />
              <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#m-gauge)" strokeWidth="18" strokeLinecap="round" strokeDasharray={`${Math.max(0.001, v) * C} ${C}`} className="m-ring-arc" />
            </svg>
            <div className="absolute inset-x-0 bottom-1 text-center">
              <b className="m-num text-4xl">{Math.round(v * 100)}</b>
              <small className="m-muted block">درجة يومك</small>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[["العادات", `${d.done}/${d.required}`, d.score], ["القراءة", d.reading ? `${d.reading.done}` : "—", readingShare(d)], ["الأسبوع", pct(d.week), d.week]].map(([l, s, p]) => (
              <span key={String(l)} className="m-soft space-y-1 p-2">
                <small className="m-muted block">{l}</small>
                <b className="m-num">{s}</b>
                <Bar value={Number(p)} h={5} />
              </span>
            ))}
          </div>
        </Card>
      );
    }
    case "rpg":
      return (
        <Card className="flex items-center gap-3">
          <span className="grid size-16 shrink-0 place-items-center text-4xl" style={{ background: "var(--m-surface-2)", borderRadius: 12 }} aria-hidden="true">🧕</span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex items-center">
              <b className="m-display flex-1 text-lg">المستوى {d.level}</b>
              <span className="m-num" style={{ color: "var(--m-gold)" }}>🔥 {d.streak}</span>
            </p>
            <small className="m-muted">يومك {d.done}/{d.required}</small>
            <Bar value={d.score} h={8} color="var(--m-error)" radius={4} />
            <small className="m-num m-muted">الخبرة {d.levelXp} / {XP_LEVEL}</small>
            <Bar value={d.levelXp / XP_LEVEL} h={8} radius={4} />
          </div>
        </Card>
      );
    case "stickers":
      return (
        <div className="flex flex-wrap gap-3 py-1">
          <span className="m-sticker" style={{ background: "#ffe08a", rotate: "-3deg" }}>عاداتي {d.done}/{d.required} ✓</span>
          <Link href="/mahdi/reading" className="m-sticker" style={{ background: "#bde0fe", rotate: "2deg" }}>قريت {d.reading ? d.reading.done : 0} 📖</Link>
          <span className="m-sticker" style={{ background: "#ffc6d3", rotate: "-1.5deg" }}>سلسلتي {"●".repeat(Math.min(12, d.streak)) || "—"} {d.streak}</span>
        </div>
      );
    case "star": {
      const fill = 120 - d.score * 120;
      return (
        <section className="flex flex-col items-center gap-2 text-center" aria-label="إنجاز اليوم">
          <svg viewBox="0 0 120 120" className="size-40" role="img" aria-label={`عادات اليوم ${pct(d.score)}`}>
            <defs>
              <clipPath id="m-star">
                <polygon points="60,4 76,30 106,22 98,52 116,68 90,82 94,112 64,100 40,116 34,86 6,76 24,52 12,24 42,30" />
              </clipPath>
            </defs>
            <polygon points="60,4 76,30 106,22 98,52 116,68 90,82 94,112 64,100 40,116 34,86 6,76 24,52 12,24 42,30" fill="var(--m-surface-solid)" stroke="var(--m-gold)" strokeWidth="2" />
            <rect x="0" y={fill} width="120" height="120" fill="var(--m-gold-2)" clipPath="url(#m-star)" opacity=".9" className="m-star-fill" />
            <text x="60" y="68" textAnchor="middle" fontSize="20" fill="var(--m-ink)" fontWeight="700">{pct(d.score)}</text>
          </svg>
          <span className="m-num">{habitsLine(d)}</span>
          <Link href="/mahdi/reading" className="m-card flex w-full items-center p-3 text-sm">
            <span className="flex-1 text-start">📖 القراءة</span>
            <span className="m-num">{readingText(d.reading)}</span>
          </Link>
        </section>
      );
    }
    case "number":
      return (
        <section className="space-y-3" aria-label="إنجاز اليوم">
          <div>
            <p className="flex items-end gap-1.5">
              <b className="m-num text-8xl leading-[.85] font-bold">{d.done}</b>
              <span className="m-num pb-2 text-3xl m-muted">/{d.required}</span>
              <span className="flex-1" />
              <span className="pb-2 text-sm">عادات اليوم</span>
            </p>
            <span className="mt-1 block h-[3px]" style={{ width: `${d.score * 100}%`, background: "var(--m-ink)" }} />
          </div>
          <Link href="/mahdi/reading" className="block">
            <p className="flex items-end gap-1.5">
              <b className="m-num text-6xl leading-[.85] font-light">{d.reading?.done ?? 0}</b>
              <span className="m-num pb-1 text-xl m-muted">/{d.reading?.target ?? "—"}</span>
              <span className="flex-1" />
              <span className="pb-1 text-sm">القراءة</span>
            </p>
            <span className="mt-1 block h-[3px]" style={{ width: `${readingShare(d) * 100}%`, background: "var(--m-ink)" }} />
          </Link>
          {d.streak > 0 && <p className="m-num text-sm">{d.streak} يوم متتالي</p>}
        </section>
      );
    case "chip":
      return (
        <p className="flex flex-wrap items-center gap-2">
          <span className="m-chip m-num text-sm font-bold">اليوم {d.done}/{d.required}</span>
          <span className="m-chip m-num text-sm font-bold">📖 {readingText(d.reading)}</span>
          {d.streak > 0 && <span className="m-flame m-num">🔥 {d.streak}</span>}
        </p>
      );
    default:
      return null;
  }
}
