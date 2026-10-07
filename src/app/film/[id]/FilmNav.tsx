"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { FILM_STAGES, type FilmStage } from "@config/film";
import { useFilmBase } from "../FilmBase";
import "@/app/jawad-ai/film/film-theme.css";

/** The sections of a film project, in order; `reached` is the project stage from which a section opens. */
const SECTIONS: { key: string; label: string; icon: string; path: string; reached: FilmStage; ready: boolean }[] = [
  { key: "story", label: "القصة", icon: "📝", path: "", reached: "screenwriter", ready: true },
  { key: "script", label: "السيناريست", icon: "✍️", path: "/script", reached: "screenwriter", ready: true },
  { key: "sheets", label: "صانع الشيت", icon: "🎨", path: "/sheets", reached: "sheets", ready: true },
  { key: "director", label: "المخرج", icon: "🎥", path: "/director", reached: "director", ready: true },
  { key: "videos", label: "التوليد", icon: "🎬", path: "/videos", reached: "director", ready: true },
  { key: "voices", label: "الأصوات", icon: "🎙️", path: "/voices", reached: "director", ready: true },
  { key: "edit", label: "المونتاج", icon: "✂️", path: "/edit", reached: "director", ready: true },
];

const order = (s: FilmStage) => FILM_STAGES.findIndex((x) => x.key === s);

/** Sections bar: reached sections are links, the rest are locked until the project gets there. */
export default function FilmNav({ projectId, stage, videosOpen }: { projectId: string; stage: FilmStage; videosOpen: boolean }) {
  const pathname = usePathname();
  const base = `${useFilmBase()}/${projectId}`;
  // the section open now slides into view
  const row = useRef<HTMLOListElement>(null);
  useEffect(() => {
    row.current?.querySelector("[data-active]")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [pathname]);
  return (
    <nav aria-label="أقسام المشروع" className="film-steps">
      <ol className="film-swipe" ref={row}>
        {SECTIONS.map((s, i) => {
          const href = base + s.path;
          // The generation page opens once the director has an approved generation
          const open = s.ready && order(stage) >= order(s.reached) && (!["videos", "voices", "edit"].includes(s.key) || videosOpen);
          const active = pathname === href;
          const done = order(stage) > order(s.reached) || (s.key === "story" && order(stage) > 0);
          const body = (
            <>
              <span className="film-option-icon" aria-hidden>{s.icon}</span>
              <span className="film-option-step">{!open ? "🔒" : done ? "✓" : i + 1}</span>
              <h3>{s.label}</h3>
            </>
          );
          return (
            <li key={s.key} data-active={active || undefined}>
              {open ? (
                <Link href={href} aria-current={active ? "page" : undefined} className="film-option" data-tone={active ? "gold" : done ? undefined : "light"} data-active={active}>
                  {body}
                </Link>
              ) : (
                <span aria-disabled="true" className="film-option" data-tone="light" title={s.ready ? "توصل له بعد ما تخلص اللي قبله" : "قريبًا"}>
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
