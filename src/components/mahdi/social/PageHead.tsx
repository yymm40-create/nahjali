/**
 * The head of a screen in «المجتمع» (the community page, groups, challenges, the race): one big title, an optional
 * line under it, and at most one action at the end. The top bar already has the back arrow, so the page has none.
 */
export default function PageHead({ title, sub, eyebrow, children }: { title: string; sub?: React.ReactNode; eyebrow?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="m-eyebrow">{eyebrow}</p>}
        <h1 className="m-display text-3xl leading-tight">{title}</h1>
        {sub && <div className="text-sm m-muted">{sub}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2 pt-1">{children}</div>}
    </header>
  );
}
