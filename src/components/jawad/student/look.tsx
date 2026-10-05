// «الطالب الذكي» — the colours and symbols of each output and step, and small decorative samples.

export const KIND_LOOK: Record<string, { emoji: string; grad: string }> = {
  summary: { emoji: "📝", grad: "linear-gradient(135deg,#a855f7,#6366f1)" },
  explain: { emoji: "💡", grad: "linear-gradient(135deg,#f59e0b,#f97316)" },
  transcript: { emoji: "📄", grad: "linear-gradient(135deg,#64748b,#334155)" },
  book: { emoji: "📘", grad: "linear-gradient(135deg,#0ea5e9,#2563eb)" },
  slides: { emoji: "🎞️", grad: "linear-gradient(135deg,#ec4899,#db2777)" },
  audio: { emoji: "🎧", grad: "linear-gradient(135deg,#10b981,#059669)" },
  quiz: { emoji: "🎯", grad: "linear-gradient(135deg,#f43f5e,#e11d48)" },
};

export const STEP_LOOK = [
  { emoji: "📤", label: "المادة", grad: "linear-gradient(135deg,#0ea5e9,#6366f1)" },
  { emoji: "🔍", label: "مراجعة النص", grad: "linear-gradient(135deg,#a855f7,#7c3aed)" },
  { emoji: "🧠", label: "الفهم", grad: "linear-gradient(135deg,#ec4899,#db2777)" },
  { emoji: "🧭", label: "حدود المصدر", grad: "linear-gradient(135deg,#f59e0b,#f97316)" },
  { emoji: "✨", label: "النواتج", grad: "linear-gradient(135deg,#10b981,#0ea5e9)" },
] as const;

export function Tile({ emoji, grad, size = 48 }: { emoji: string; grad: string; size?: number }) {
  return (
    <span className="st-tile shrink-0" style={{ background: grad, width: size, height: size, fontSize: size * 0.48 }} aria-hidden>
      {emoji}
    </span>
  );
}

/** A tiny picture of what each output looks like (decorative). */
export function KindSample({ kind }: { kind: string }) {
  const line = (w: string, c = "rgba(29,22,64,.18)") => <span className="block h-1.5 rounded-full" style={{ width: w, background: c }} />;
  switch (kind) {
    case "slides":
      return (
        <div className="aspect-video rounded-xl p-2" style={{ background: "linear-gradient(135deg,#1e1b4b,#7c3aed 60%,#db2777)" }}>
          <span className="mb-1 block h-2 w-1/2 rounded-full bg-white/90" />
          <div className="grid grid-cols-3 gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="block h-6 rounded-md bg-white/25" />
            ))}
          </div>
        </div>
      );
    case "book":
      return (
        <div className="flex aspect-video gap-1 rounded-xl bg-white p-2 shadow-inner">
          <div className="flex-1 space-y-1">
            <span className="block h-2 w-2/3 rounded-full bg-sky-500" />
            {line("100%")}
            {line("90%")}
            {line("95%")}
            {line("60%")}
          </div>
          <span className="w-1/3 rounded-md bg-gradient-to-br from-amber-200 to-pink-200" />
        </div>
      );
    case "audio":
      return (
        <div className="flex aspect-video items-center justify-center gap-1 rounded-xl bg-emerald-50 p-2">
          {[6, 14, 22, 12, 26, 18, 9, 20, 13, 7].map((h, i) => (
            <span key={i} className="w-1.5 animate-pulse rounded-full bg-emerald-500" style={{ height: h, animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
      );
    case "quiz":
      return (
        <div className="aspect-video space-y-1 rounded-xl bg-rose-50 p-2">
          {line("80%", "rgba(225,29,72,.5)")}
          {["✓", "", ""].map((m, i) => (
            <span key={i} className="flex items-center gap-1 text-[9px]">
              <span className={`grid size-3 place-items-center rounded-full border ${m ? "border-emerald-500 bg-emerald-500 text-white" : "border-rose-300 bg-white"}`}>{m}</span>
              {line("60%")}
            </span>
          ))}
        </div>
      );
    default:
      return (
        <div className="aspect-video space-y-1 rounded-xl bg-white p-2 shadow-inner">
          <span className="block h-2 w-1/2 rounded-full" style={{ background: KIND_LOOK[kind]?.grad }} />
          {line("100%")}
          {line("85%")}
          <span className="block rounded-md bg-amber-100 px-1 py-0.5">{line("70%", "rgba(217,119,6,.45)")}</span>
          {line("92%")}
        </div>
      );
  }
}
