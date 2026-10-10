"use client";

// «المشهد» — the one page of a film: the steps as a numbered rail, the scene's number (the ring) with every piece being
// made ticking under it, «المكتبة» a tap away, «الرجوع الذكي» when an edit reached later work, and the open step's work
// beside it all. Moving between steps never leaves this shell (the step's panel slides in).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/fetch";
import { FILM_STAGES, type FilmStage as Stage } from "@config/film";
import { STEPS } from "./steps";
import type { Progress } from "@/lib/film/progress-math";
import type { Impact } from "@/lib/film/impact";
import { useFilmBase } from "../FilmBase";
import StepWhy from "../StepWhy";
import { openSajjad } from "../SajjadPanel";
import ImpactCard from "./ImpactCard";
import LibraryDrawer from "./LibraryDrawer";
import Meter, { RunningList } from "./Meter";
import "./stage.css";

const order = (s: Stage) => FILM_STAGES.findIndex((x) => x.key === s);

export interface StageProps {
  projectId: string;
  title: string;
  stage: Stage;
  /** the generation page and what follows open once the director approved a shot */
  videosOpen: boolean;
  cost: string;
  progress: Progress;
  impacts: Impact[];
  children: React.ReactNode;
}

export default function FilmStage({ projectId, title, stage, videosOpen, cost, progress: initial, impacts, children }: StageProps) {
  const pathname = usePathname();
  const filmBase = useFilmBase();
  const base = `${filmBase}/${projectId}`;
  const [progress, setProgress] = useState(initial);
  const [lib, setLib] = useState(false);
  const here = STEPS.find((s) => pathname === base + s.path);
  const rail = useRef<HTMLElement>(null);

  // the server's numbers again: every few seconds while something runs, else now and then
  const running = progress.running.length > 0;
  useEffect(() => {
    let live = true;
    const tick = async () => {
      // nobody is looking (another tab, the device asleep): wait for the next tick
      if (document.hidden) return;
      try {
        const p = await api<Progress>(`/api/film/projects/${projectId}/progress`);
        if (live) setProgress(p);
      } catch {
        // keep going
      }
    };
    const t = setInterval(tick, running ? 5000 : 30000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [projectId, running, pathname]);
  // the page's own data changed (a refresh after an action): read the numbers once more
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setProgress(initial);
  }, [initial]);
  useEffect(() => {
    rail.current?.querySelector("[aria-current='page']")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [pathname]);

  const waiting = impacts.find((i) => i.status === "awaiting_approval");

  return (
    <div className="fs">
      <div className="fs-room" aria-hidden>
        <div className="beam" />
        <div className="dust" />
        <div className="grain" />
      </div>
      <div className="fs-wrap">
        <div className="fs-side space-y-3">
          <div className="fs-glass fs-top">
            <Meter percent={progress.percent} busy={running} />
            <div className="fs-title">
              <span className="fs-kicker">مشهد</span>
              <h1 title={title}>{title}</h1>
              <p>{cost} · {FILM_STAGES.find((s) => s.key === stage)?.label}</p>
            </div>
            <button type="button" className="fs-tool" aria-pressed={lib} onClick={() => setLib(true)} title="كل اللي انصنع في هذا المشهد">
              🗂️ <span className="hidden sm:inline">المكتبة</span>
            </button>
          </div>
          <RunningList items={progress.running} />
          <nav className="fs-glass fs-rail" aria-label="خطوات المشهد" ref={rail}>
            {STEPS.map((s, i) => {
              const href = base + s.path;
              const open = order(stage) >= order(s.reached) && (!["videos", "voices", "edit"].includes(s.key) || videosOpen);
              const active = pathname === href;
              const p = progress.steps[s.key];
              const done = (p?.percent ?? 0) >= 100;
              const body = (
                <>
                  <span className="n">{!open ? "🔒" : done ? "✓" : i + 1}</span>
                  <span className="t">
                    <b>{s.icon} {s.label}</b>
                    <small>{open && p && p.of > 1 && !done ? `${p.done} من ${p.of}` : s.hint}</small>
                  </span>
                  <span className="bar"><i style={{ width: `${p?.percent ?? 0}%` }} /></span>
                </>
              );
              return open ? (
                <Link key={s.key} href={href} className="fs-step" aria-current={active ? "page" : undefined} data-done={done || undefined} data-ask={progress.asking.includes(s.key) || undefined}>
                  {body}
                </Link>
              ) : (
                <span key={s.key} className="fs-step" aria-disabled="true" title="تفتح بعد ما تخلص اللي قبلها">{body}</span>
              );
            })}
          </nav>
          <div className="flex gap-2">
            <button type="button" className="fs-tool flex-1 justify-center" onClick={() => openSajjad()}>🧑‍🏫 اسأل سجاد</button>
            <Link href={filmBase} className="fs-tool justify-center">← أفلامي</Link>
          </div>
        </div>

        <main className="fs-main space-y-4" key={pathname}>
          {waiting && <ImpactCard projectId={projectId} impact={waiting} />}
          {here && <StepWhy step={here.key} />}
          <div className="fs-panel space-y-4">{children}</div>
        </main>
      </div>
      {lib && <LibraryDrawer projectId={projectId} onClose={() => setLib(false)} />}
    </div>
  );
}
