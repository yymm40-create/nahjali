"use client";

/**
 * The clear choice at the start of a film and of a series: «هل تبيني أبحث لتطوير القصة؟». Yes → سجاد opens right
 * after and asks for the scope; no → he still researches later whenever he is asked («ابحث لي عن…»).
 */
export default function ResearchChoice({ value, onChange, compact }: { value: "yes" | "no" | ""; onChange: (v: "yes" | "no") => void; compact?: boolean }) {
  const options = [
    { v: "yes" as const, icon: "🔎", title: "نعم، ابحث", text: "سجاد يبحث في الإنترنت ضمن النطاق اللي تحدده، ويعطيك نتائج تعتمدها أو تحذفها." },
    { v: "no" as const, icon: "✍️", title: "لا، أكمل من قصتي", text: "ولو احتجت بحث بعدين، قول لسجاد «ابحث لي عن…» في أي وقت." },
  ];
  return (
    <fieldset className={compact ? "space-y-1.5" : "card space-y-3 p-5"}>
      <legend className={compact ? "text-sm font-extrabold" : "font-extrabold"}>هل تبيني أبحث لتطوير القصة؟</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            className={`rounded-2xl border-2 p-3 text-start transition ${value === o.v ? "border-[#1f63f0] bg-[#eef3ff]" : "border-black/10 bg-white hover:border-black/30"}`}
            aria-pressed={value === o.v}
            onClick={() => onChange(o.v)}
          >
            <p className={compact ? "text-sm font-black" : "text-lg font-black"}>
              <span aria-hidden>{o.icon}</span> {o.title}
            </p>
            {!compact && <p className="mt-1 text-xs font-bold leading-5 text-muted">{o.text}</p>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
