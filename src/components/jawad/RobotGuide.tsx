"use client";

// The page's robot introducing itself: on the first visit to its page a card pops up (who it is, what it does, how to
// start); after that a small bubble with its face stays on the page — it can be dragged anywhere, and folded into a
// thin tab on the side so it never sits on anything — and pressing it brings the card back. Where it was put and
// whether it is folded are remembered on this device.

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { robotFor } from "@config/jawad/robots";
import "./robot-guide.css";
import RobotFace from "@/components/RobotFace";

const POS = "jw-robot-pos";
const FOLD = "jw-robot-fold";
const seenKey = (id: string) => `jw-robot-seen:${id}`;
const SIZE = 58;

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private window: remembered for this page only */
  }
};

/** Inside the screen, with room for the bubble. */
const clamp = (x: number, y: number) => ({
  x: Math.min(Math.max(8, x), window.innerWidth - SIZE - 8),
  y: Math.min(Math.max(70, y), window.innerHeight - SIZE - 90),
});

export default function RobotGuide() {
  const path = usePathname() ?? "";
  const robot = robotFor(path);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [folded, setFolded] = useState(false);
  const drag = useRef<{ dx: number; dy: number; moved: boolean; id: number } | null>(null);

  // where it was left, folded or not, and the first-visit card (a full-screen editing page only gets the bubble)
  useEffect(() => {
    if (!robot) return;
    const saved = (() => {
      try {
        return JSON.parse(read(POS) ?? "null") as { x: number; y: number } | null;
      } catch {
        return null;
      }
    })();
    const start = saved ? clamp(saved.x, saved.y) : clamp(window.innerWidth - SIZE - 14, window.innerHeight * 0.55);
    const workPage = /^\/jawad-ai\/editor\/[^/]+/.test(path);
    const first = read(seenKey(robot.id)) !== "1" && !workPage;
    const t = window.setTimeout(() => {
      setPos(start);
      setFolded(read(FOLD) === "1");
      if (first) {
        setOpen(true);
        write(seenKey(robot.id), "1");
      }
    }, first ? 700 : 0);
    const keep = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", keep);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", keep);
    };
  }, [robot, path]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  if (!robot || !pos) return null;

  const onDown = (e: React.PointerEvent) => {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const next = clamp(e.clientX - d.dx, e.clientY - d.dy);
    if (!d.moved && Math.hypot(next.x - pos.x, next.y - pos.y) < 5) return;
    d.moved = true;
    setPos(next);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) write(POS, JSON.stringify(pos));
    else setOpen(true);
  };
  const fold = (v: boolean) => {
    setFolded(v);
    write(FOLD, v ? "1" : "0");
  };
  const leftSide = pos.x < window.innerWidth / 2;
  const style = { ["--rg-a" as string]: robot.tint[0], ["--rg-b" as string]: robot.tint[1] } as React.CSSProperties;

  return (
    <>
      {folded ? (
        <button type="button" className={`rg-tab ${leftSide ? "left" : "right"}`} style={{ ...style, top: pos.y }} onClick={() => fold(false)} aria-label={`أظهر ${robot.name}`} title={robot.name}>
          <RobotFace id={robot.id} size={24} />
        </button>
      ) : (
        <div className="rg-bubble" style={{ ...style, left: pos.x, top: pos.y }}>
          <button
            type="button"
            className="rg-face"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => (drag.current = null)}
            aria-label={`${robot.name}: تعرّف عليّ`}
            title={`${robot.name} — اضغط تعرّف عليّ، واسحب لتحريكي`}
          >
            <RobotFace id={robot.id} size={50} />
          </button>
          <span className="rg-name">{robot.name}</span>
          <button type="button" className="rg-fold" onClick={() => fold(true)} aria-label="صغّر على الجنب" title="صغّر على الجنب">
            –
          </button>
        </div>
      )}

      {open && (
        <div className="rg-back" role="dialog" aria-modal="true" aria-label={`تعرّف على ${robot.name}`} dir="rtl" onClick={() => setOpen(false)}>
          <div className="rg-card" style={style} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="rg-x" onClick={() => setOpen(false)} aria-label="إغلاق">✕</button>
            <div className="rg-hero">
              <span className="rg-big" aria-hidden><RobotFace id={robot.id} size={60} /></span>
              <div>
                <h2>هلا! أنا {robot.name}</h2>
                <p>{robot.role}</p>
              </div>
            </div>
            <h3>وش أسوي لك؟</h3>
            <ul>
              {robot.does.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <h3>كيف نبدأ؟</h3>
            <ol>
              {robot.start.map((s, i) => (
                <li key={s}>
                  <b>{i + 1}</b>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <button type="button" className="rg-go" onClick={() => setOpen(false)}>
              يلا نبدأ
            </button>
            <p className="rg-hint">تلقاني في الزر الصغير بوجهي، اسحبه لأي مكان أو صغّره على الجنب.</p>
          </div>
        </div>
      )}
    </>
  );
}
