"use client";

// «⚡ جاهز بضغطة» above the prompt: the kinds of work people ask for most (config/jawad/playbooks.ts) as cards, the
// way the leading studios offer ready «Apps». A card takes a few words or chips and fills the studio's own form —
// the kind, a generator this account has, the shape, the reference slots and a prompt written from the playbook
// (config/jawad/ready-apps.ts) — with no AI call. The person adds their photo and presses «توليد» as usual.

import { useState } from "react";
import { composeReady, missingInput, pickReadyGenerator, READY_APPS, readyValues, visibleInputs, type ReadyApp, type ReadyValues } from "@config/jawad/ready-apps";
import Dialog from "../Dialog";
import Icon from "../Icon";
import type { StudioGenerator } from "./types";

type Filter = "all" | "image" | "video";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "image", label: "صور" },
  { id: "video", label: "فيديو" },
];

function ReadyCard({ app, values, onValues, generators, owner, onUse }: { app: ReadyApp; values: ReadyValues; onValues: (v: ReadyValues) => void; generators: StudioGenerator[]; owner: boolean; onUse: (generatorId: string) => void }) {
  const v = readyValues(app, values);
  // the generator follows the person's words (Arabic in the prompt wants one that reads it)
  const gid = pickReadyGenerator(app, composeReady(app, v), generators.map((g) => ({ id: g.id, usable: g.live || owner })));
  const gname = generators.find((g) => g.id === gid)?.name;
  const missing = missingInput(app, v);
  const set = (key: string, value: string) => onValues({ ...values, [key]: value });
  return (
    <li className="flex flex-col gap-2.5 rounded-xl border border-jw-line bg-jw-surface-2 p-3">
      <div className="flex items-start gap-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-jw-accent-soft text-xl" aria-hidden>{app.icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug">{app.name}</h3>
          <p className="text-xs text-jw-muted">{app.line}</p>
        </div>
        <span className="jw-chip shrink-0">{app.output === "image" ? "صورة" : "فيديو"}</span>
      </div>
      <p className="flex items-start gap-1.5 text-xs">
        <Icon name="upload" size={13} className="mt-0.5 shrink-0 text-jw-accent" />
        <span><span className="text-jw-muted">تضيف: </span>{app.needs}</span>
      </p>
      {visibleInputs(app, v).map((i) =>
        i.kind === "text" ? (
          <label key={i.key} className="block">
            <span className="jw-label !mb-1">{i.label}{i.optional && <span className="text-jw-faint"> (اختياري)</span>}</span>
            <input className="jw-input !py-1.5 text-sm" value={values[i.key] ?? ""} maxLength={i.max} placeholder={i.placeholder} onChange={(e) => set(i.key, e.target.value)} aria-invalid={missing?.key === i.key} />
          </label>
        ) : (
          <div key={i.key}>
            <span className="jw-label !mb-1">{i.label}</span>
            <div className="jw-seg" role="radiogroup" aria-label={i.label}>
              {i.choices.map((c) => (
                <button key={c.value} type="button" role="radio" aria-checked={v[i.key] === c.value} className="!min-h-8 !px-2.5 !text-xs" onClick={() => set(i.key, c.value)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ),
      )}
      {app.note && <p className="text-[11px] text-jw-faint">{app.note}</p>}
      <div className="mt-auto space-y-1.5 pt-1">
        {gid ? (
          <p className="text-[11px] text-jw-faint">على <span dir="ltr">{gname}</span></p>
        ) : (
          <p className="text-[11px] text-jw-warn">ما فيه مولّد {app.output === "image" ? "صور" : "فيديو"} يناسبه متاح لحسابك الحين.</p>
        )}
        <button type="button" className="jw-btn jw-btn-primary !min-h-9 w-full text-sm" disabled={!gid || Boolean(missing)} onClick={() => gid && onUse(gid)}>
          استخدمه
        </button>
        {missing && gid && <p className="text-[11px] text-jw-muted">اكتب «{missing.label}» أولًا.</p>}
      </div>
    </li>
  );
}

/** The entry under the style picker and the gallery it opens. */
export default function ReadyApps({ generators, owner, onUse }: { generators: StudioGenerator[]; owner: boolean; onUse: (app: ReadyApp, values: ReadyValues, generatorId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  // what was typed on each card stays while the page is open (closing the gallery doesn't lose it)
  const [values, setValues] = useState<Record<string, ReadyValues>>({});
  const shown = READY_APPS.filter((a) => filter === "all" || a.output === filter);
  return (
    <>
      <button type="button" className="flex w-full items-center gap-3 rounded-xl border border-jw-line bg-jw-surface-2 p-2 text-start hover:border-jw-accent" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-jw-accent-soft text-lg" aria-hidden>⚡</span>
        <span className="min-w-0 flex-1">
          <b className="block text-sm">جاهز بضغطة</b>
          <span className="line-clamp-1 text-xs text-jw-muted">{READY_APPS.length} استخدام جاهز: صورة منتج، إعلان، ثامبنيل، مؤثر ترند… اختر وأضف صورتك بس</span>
        </span>
        <span className="text-xs text-jw-accent">افتح</span>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="⚡ جاهز بضغطة" wide>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-jw-line px-4 py-2.5">
          <p className="text-xs text-jw-muted">اختر اللي تبي تسويه، واكتب كلمتين لو تبي. نعبّي لك النموذج كله مجانًا، وأنت تضيف صورتك وتضغط «توليد».</p>
          <div className="jw-seg" role="radiogroup" aria-label="النوع">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className="!min-h-8 !text-xs" onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="jw-scroll grid max-h-[72dvh] grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((app) => (
            <ReadyCard
              key={app.id}
              app={app}
              values={values[app.id] ?? {}}
              onValues={(v) => setValues((cur) => ({ ...cur, [app.id]: v }))}
              generators={generators}
              owner={owner}
              onUse={(gid) => {
                onUse(app, values[app.id] ?? {}, gid);
                setOpen(false);
              }}
            />
          ))}
        </ul>
      </Dialog>
    </>
  );
}
