"use client";

import { generatorById } from "@config/jawad/generators";
import Dialog from "../Dialog";
import Icon from "../Icon";
import type { StudioGenerator } from "./types";

function Sample({ g, className }: { g: StudioGenerator; className: string }) {
  return g.sampleUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={g.sampleUrl} alt={`مثال من ${g.name}`} className={`${className} object-cover`} loading="lazy" />
  ) : (
    <div className={`${className} grid place-items-center bg-[radial-gradient(120%_120%_at_100%_0%,var(--jw-accent-soft),transparent_60%)]`}>
      <span className="text-xs text-jw-faint">لا توجد صورة نموذجية بعد</span>
    </div>
  );
}

/** The big card at the top of the panel: the chosen generator and its sample picture. Opens the picker. */
export function GeneratorCard({ gen, onOpen, owner }: { gen: StudioGenerator; onOpen: () => void; owner: boolean }) {
  const def = generatorById(gen.id)!;
  return (
    <button type="button" onClick={onOpen} className="jw-panel group block w-full overflow-hidden text-start transition-colors hover:border-jw-line-strong" aria-haspopup="dialog" aria-label={`المولد: ${gen.name}. اضغط للتغيير`}>
      <div className="relative">
        <Sample g={gen} className="aspect-[16/7] w-full" />
        {!gen.live && owner && <span className="jw-chip absolute start-2 top-2 bg-black/70 !text-white">مخفي عن المستخدمين</span>}
      </div>
      <div className="flex items-center justify-between gap-3 px-3.5 py-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold" dir="ltr" style={{ textAlign: "right" }}>{gen.name}</p>
          <p className="truncate text-xs text-jw-muted" dir="ltr" style={{ textAlign: "right" }}>
            {def.provider.label} · {def.model.id}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-jw-muted group-hover:text-jw-ink">
          تغيير <Icon name="chevronDown" size={14} />
        </span>
      </div>
    </button>
  );
}

/** The list of generators of this section, each with its own sample picture and availability. */
export function GeneratorPicker({
  open,
  onClose,
  generators,
  current,
  onPick,
  owner,
}: {
  open: boolean;
  onClose: () => void;
  generators: StudioGenerator[];
  current: string;
  onPick: (id: string) => void;
  owner: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="اختر المولد">
      <ul className="jw-scroll grid max-h-[70dvh] grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2">
        {generators.map((g) => {
          const def = generatorById(g.id)!;
          const active = g.id === current;
          return (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(g.id);
                  onClose();
                }}
                aria-pressed={active}
                className={`block w-full overflow-hidden rounded-xl border text-start transition-colors ${active ? "border-jw-accent bg-jw-accent-soft" : "border-jw-line bg-jw-surface-2 hover:border-jw-line-strong"}`}
              >
                <Sample g={g} className="aspect-video w-full" />
                <div className="space-y-1 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold" dir="ltr">{g.name}</span>
                    {active && <Icon name="check" size={16} className="text-jw-accent" />}
                  </div>
                  <p className="text-xs text-jw-muted" dir="ltr" style={{ textAlign: "right" }}>{def.provider.label} · {def.model.id}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {def.modes.map((m) => (
                      <span key={m.id} className="jw-chip">{m.label}</span>
                    ))}
                  </div>
                  <p className={`pt-1 text-xs ${g.live ? "text-jw-ok" : "text-jw-warn"}`}>{g.live ? "متاح" : owner ? `مخفي عن المستخدمين — ${g.reason ?? ""}` : "غير متاح"}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
