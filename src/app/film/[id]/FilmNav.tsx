"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FILM_STAGES, type FilmStage } from "@config/film";

/** The sections of a film project, in order; `reached` is the project stage from which a section opens. */
const SECTIONS: { key: string; label: string; icon: string; path: string; reached: FilmStage; ready: boolean }[] = [
  { key: "story", label: "القصة", icon: "📝", path: "", reached: "screenwriter", ready: true },
  { key: "script", label: "السيناريست", icon: "✍️", path: "/script", reached: "screenwriter", ready: true },
  { key: "sheets", label: "صانع الشيت", icon: "🎨", path: "/sheets", reached: "sheets", ready: true },
  { key: "director", label: "المخرج", icon: "🎥", path: "/director", reached: "director", ready: true },
  { key: "voices", label: "الأصوات", icon: "🎙️", path: "/voices", reached: "voices", ready: false },
];

const order = (s: FilmStage) => FILM_STAGES.findIndex((x) => x.key === s);

/** Sections bar: reached sections are links, the rest are locked until the project gets there. */
export default function FilmNav({ projectId, stage }: { projectId: string; stage: FilmStage }) {
  const pathname = usePathname();
  const base = `/film/${projectId}`;
  return (
    <nav aria-label="أقسام المشروع" className="card p-2">
      <ol className="grid grid-cols-5 gap-1 text-center">
        {SECTIONS.map((s) => {
          const href = base + s.path;
          const open = s.ready && order(stage) >= order(s.reached);
          const active = pathname === href;
          const done = order(stage) > order(s.reached) || (s.key === "story" && order(stage) > 0);
          const tile = (
            <>
              <span className={`relative grid h-11 place-items-center rounded-2xl text-xl ${active ? "bg-gold text-on-gold" : open ? (done ? "bg-teal text-white" : "bg-surface-2") : "bg-surface-2 opacity-40"}`}>
                {s.icon}
                {!open && <span className="absolute -end-1 -top-1 text-xs" aria-hidden>🔒</span>}
              </span>
              <span className={`block text-[11px] font-extrabold ${active ? "text-ink" : "text-muted"}`}>{s.label}</span>
            </>
          );
          return (
            <li key={s.key}>
              {open ? (
                <Link href={href} aria-current={active ? "page" : undefined} className="block space-y-1">{tile}</Link>
              ) : (
                <span aria-disabled className="block cursor-not-allowed space-y-1" title={s.ready ? "توصل له بعد ما تخلص اللي قبله" : "قريبًا"}>{tile}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
