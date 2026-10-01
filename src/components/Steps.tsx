/** Simple progress dots for multi-step screens. */
export default function Steps({ labels, current }: { labels: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="الخطوات">
      {labels.map((label, i) => (
        <li key={label} className="flex flex-1 flex-col items-center gap-1" aria-current={i === current ? "step" : undefined}>
          <span className={`h-2 w-full rounded-full transition ${i <= current ? "bg-gold" : "bg-line"}`} />
          <span className={`text-xs font-extrabold ${i === current ? "text-ink" : "text-muted"}`}>{label}</span>
        </li>
      ))}
    </ol>
  );
}
