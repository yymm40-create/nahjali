import Icon, { type IconName } from "../Icon";

/**
 * The loading, empty and error look of «المجتمع» (the plan of 26 November 2026: never a bare «جارٍ التحميل», never an
 * error that disappears in silence). Built on the shared `.m-skel` and `.m-empty` pieces.
 */

/** Grey shapes where the content will be: post cards, or rows of a list. */
export function Skeleton({ kind = "rows", count = 3, label = "لحظة، نجهّز الصفحة" }: { kind?: "posts" | "rows" | "cards"; count?: number; label?: string }) {
  return (
    <div className="space-y-3" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, i) =>
        kind === "posts" ? (
          <div key={i} className="m-card space-y-3 p-4" aria-hidden="true">
            <div className="flex items-center gap-3">
              <div className="m-skel size-10 shrink-0 !rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="m-skel h-3.5 w-2/5" />
                <div className="m-skel h-3 w-1/4" />
              </div>
            </div>
            <div className="m-skel h-48" />
            <div className="m-skel h-3.5 w-3/5" />
          </div>
        ) : kind === "cards" ? (
          <div key={i} className="m-skel h-24" aria-hidden="true" />
        ) : (
          <div key={i} className="m-card flex items-center gap-3 p-4" aria-hidden="true">
            <div className="m-skel size-10 shrink-0 !rounded-2xl" />
            <div className="flex-1 space-y-2">
              <div className="m-skel h-3.5 w-1/2" />
              <div className="m-skel h-3 w-1/3" />
            </div>
          </div>
        ),
      )}
    </div>
  );
}

/** Nothing here yet: a calm icon, one sentence, and at most one way forward. */
export function Empty({ icon = "sparkle", title, body, children }: { icon?: IconName; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="m-card m-empty">
      <span className="m-empty-ic" aria-hidden="true">
        <Icon name={icon} size={26} />
      </span>
      <p className="font-semibold">{title}</p>
      {body && <p className="max-w-sm text-sm m-muted">{body}</p>}
      {children}
    </div>
  );
}

/** It did not load: what happened, in plain words, and «جرّب مرة ثانية». */
export function ErrorState({ message, onRetry, children }: { message: string; onRetry?: () => void; children?: React.ReactNode }) {
  return (
    <div className="m-card m-empty" role="alert">
      <span className="m-empty-ic" aria-hidden="true">
        <Icon name="offline" size={26} />
      </span>
      <p className="max-w-sm">{message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {onRetry && (
          <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={onRetry}>
            جرّب مرة ثانية
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
