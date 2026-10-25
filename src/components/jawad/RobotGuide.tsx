"use client";

// The page's robot introducing itself: a thin tab on the side, never a pop-up by itself. Opened, a small bubble with its
// face stays on the page — it can be dragged anywhere and folded back into the thin tab so it never sits on anything —
// and pressing it brings the intro card. Where it was put and whether it is folded are remembered on this device.

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { robotFor } from "@config/jawad/robots";
import "./robot-guide.css";
import RobotFace from "@/components/RobotFace";

const POS = "jw-robot-pos";
const FOLD = "jw-robot-fold";
const SEEN = "jw-robot-intro-seen";
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
  // where the robot has its own chat bubble already — «حيدرة كت» inside a project (Editor.tsx) and «سجاد» in the film
  // maker (SajjadPanel.tsx) — that bubble is the robot's ONE icon (movable, foldable): no second one beside it
  const robot = /^\/jawad-ai\/editor\/[^/]+/.test(path) || /^\/jawad-ai\/film(\/|$)/.test(path) ? null : robotFor(path);
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
    // quiet by default (the owner, 25 October 2026: the pop-ups and icons were annoying): after the first visit no card opens by itself, and
    // the icon starts folded into a thin tab on the side until the person opens it
    // the one exception (the owner: the intro window only at the start): the very first visit on this device shows the
    // small card once, with the icon open beside it; after that it is only ever opened by a press
    const first = read(SEEN) !== "1";
    const t = window.setTimeout(() => {
      setPos(start);
      setFolded(first ? false : read(FOLD) !== "0");
      if (first) {
        setOpen(true);
        write(SEEN, "1");
      }
    }, 0);
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
    const away = (e: PointerEvent) => !(e.target as Element | null)?.closest?.(".rg-bubble, .rg-pop") && setOpen(false);
    window.addEventListener("keydown", esc);
    window.addEventListener("pointerdown", away);
    return () => {
      window.removeEventListener("keydown", esc);
      window.removeEventListener("pointerdown", away);
    };
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
    else setOpen((v) => !v);
  };
  const fold = (v: boolean) => {
    setFolded(v);
    if (v) setOpen(false);
    write(FOLD, v ? "1" : "0");
  };
  const leftSide = pos.x < window.innerWidth / 2;
  // the intro is part of the icon: a small card attached to it (above it low on the screen, below it high), on its side
  const POP_W = Math.min(264, window.innerWidth - 24);
  const popAt: React.CSSProperties = {
    width: POP_W,
    left: Math.min(Math.max(8, leftSide ? pos.x : pos.x + SIZE - POP_W), window.innerWidth - POP_W - 8),
    ...(pos.y > window.innerHeight / 2 ? { bottom: window.innerHeight - pos.y + 8 } : { top: pos.y + SIZE + 24 }),
  };
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

      {open && !folded && (
        <div className="rg-pop" style={{ ...style, ...popAt }} role="dialog" aria-label={`تعرّف على ${robot.name}`} dir="rtl">
          <button type="button" className="rg-x" onClick={() => setOpen(false)} aria-label="إغلاق">✕</button>
          <h2>هلا! أنا {robot.name}</h2>
          <p className="rg-role">{robot.role}</p>
          <ul>
            {robot.does.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p className="rg-start">
            <b>نبدأ؟</b> {robot.start.join(" ← ")}
          </p>
        </div>
      )}
    </>
  );
}
