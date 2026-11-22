"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { setAssistantPrefs, useAssistantPrefs } from "@/lib/mahdi/client/assistant-prefs";
import AssistantChat from "./AssistantChat";
import SheikhChat from "./SheikhChat";
import Icon from "./Icon";
import { useMahdi } from "./Provider";
import Robot from "./Robot";

const A = t.assistant;
const S = t.sheikh;
const SIZE = 60;
const EDGE = 12;
/** A press that moves less than this is a tap, not a drag. */
const TAP_PX = 6;

/** The space the bottom bar takes on phones (the button stays above it). */
function navSpace() {
  const nav = document.querySelector<HTMLElement>(".m-bottom-nav");
  return nav && nav.offsetParent !== null ? nav.getBoundingClientRect().height : 0;
}

/**
 * The robot floats over every screen at the bottom (above the bar), never in the way. Tap it for «الشيخ الذكي» (the
 * owner, 22 November 2026: the robot is the sheikh now): a small chat that leaves the screen usable, or «كبّر» for the
 * whole screen (phone or laptop); the conversation is kept. Fold the chat back into the robot, drag the robot anywhere
 * (it settles on the nearest side and keeps its place), or hide it (it comes back from «حسابي»). A reply notification
 * from the team opens the team's chat («المساعد») with ?assistant=1 even when the robot is hidden.
 */
export default function AssistantFloat({ openFromLink, onLinkClosed, onRead }: { openFromLink: boolean; onLinkClosed: () => void; onRead: () => void }) {
  const { toast } = useMahdi();
  const prefs = useAssistantPrefs();
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const press = useRef<{ id: number; x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const [moves, setMoves] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const shown = open || openFromLink;

  const close = () => {
    setOpen(false);
    setFull(false);
    if (openFromLink) onLinkClosed();
    button.current?.focus();
  };

  // Esc folds the chat
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: r.left, top: r.top, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const mx = e.clientX - p.x;
    const my = e.clientY - p.y;
    if (!p.moved && Math.hypot(mx, my) < TAP_PX) return;
    p.moved = true;
    const maxX = window.innerWidth - SIZE - EDGE;
    const maxY = window.innerHeight - SIZE - EDGE - navSpace();
    setDrag({ x: Math.min(Math.max(EDGE, p.left + mx), maxX), y: Math.min(Math.max(EDGE + 56, p.top + my), maxY) });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    press.current = null;
    if (!p || p.id !== e.pointerId) return;
    if (!p.moved || !drag) {
      setDrag(null);
      if (shown) close();
      else setOpen(true);
      return;
    }
    // Settles on the nearest side, at the height it was left
    const side = drag.x + SIZE / 2 < window.innerWidth / 2 ? "left" : "right";
    setAssistantPrefs({ side, bottom: Math.round(window.innerHeight - drag.y - SIZE) });
    setDrag(null);
    setMoves((n) => n + 1); // an open chat moves with it
  };

  const side = prefs.side ?? "left";
  const place: React.CSSProperties = drag
    ? { left: drag.x, top: drag.y, transition: "none" }
    : { [side]: EDGE, bottom: prefs.bottom !== undefined ? `max(${prefs.bottom}px, calc(var(--m-float-min)))` : "var(--m-float-bottom)" };

  return (
    <>
      {shown && (
        <ChatPanel
          key={moves}
          side={side}
          kind={openFromLink ? "team" : "sheikh"}
          full={full}
          onFull={setFull}
          canHide={!prefs.hidden}
          onFold={close}
          onHide={() => {
            setAssistantPrefs({ hidden: true });
            close();
            toast(A.hidden);
          }}
          onRead={onRead}
        />
      )}
      {!prefs.hidden && !full && (
        <button
          ref={button}
          type="button"
          className="m-assist-bubble"
          style={place}
          aria-label={shown ? S.fold : S.open}
          aria-expanded={shown}
          data-dragging={drag ? "" : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={(e) => {
            // Enter or Space (a pointer's tap is handled on release, to tell it from a drag)
            if (e.detail !== 0) return;
            if (shown) close();
            else setOpen(true);
          }}
          onPointerCancel={() => {
            press.current = null;
            setDrag(null);
          }}
        >
          <Robot size={50} />
        </button>
      )}
    </>
  );
}

/**
 * Where the chat opens: next to the robot, on its side, above it or below it (where there is more room), never
 * under the top bar nor over the bottom bar.
 */
function placeChat(side: "left" | "right"): React.CSSProperties {
  const vh = window.innerHeight;
  const nav = navSpace();
  const r = document.querySelector(".m-assist-bubble")?.getBoundingClientRect();
  const top = r ? r.top : vh - nav - 14 - SIZE;
  const bottom = r ? r.bottom : vh - nav - 14;
  const above = top - 10 - 64;
  const below = vh - nav - 8 - (bottom + 8);
  return above >= below
    ? { [side]: EDGE, bottom: vh - top + 10, maxHeight: Math.min(460, above) }
    : { [side]: EDGE, top: bottom + 8, maxHeight: Math.min(460, below) };
}

/**
 * The chat: the robot and the name, «كبّر» / «صغّر», fold, hide, and the conversation — the sheikh's, or the team's
 * when a reply notification opened it. Not modal while small (the screen stays usable); at full size it covers it.
 */
function ChatPanel({
  side,
  kind,
  full,
  onFull,
  canHide,
  onFold,
  onHide,
  onRead,
}: {
  side: "left" | "right";
  kind: "sheikh" | "team";
  full: boolean;
  onFull: (v: boolean) => void;
  canHide: boolean;
  onFold: () => void;
  onHide: () => void;
  onRead: () => void;
}) {
  const [place] = useState(() => placeChat(side));
  const title = kind === "sheikh" ? S.title : A.title;
  return (
    <div role="dialog" aria-modal={full ? "true" : "false"} aria-label={title} className="m-assist-panel" style={full ? undefined : place} data-full={full ? "" : undefined}>
      <div className="flex items-center gap-2">
        <Robot size={34} />
        <p className="flex-1 font-semibold">{title}</p>
        {kind === "sheikh" && (
          <button type="button" className="m-icon-btn size-9" onClick={() => onFull(!full)} aria-label={full ? S.shrink : S.expand} title={full ? S.shrink : S.expand}>
            <Icon name={full ? "shrink" : "expand"} size={18} />
          </button>
        )}
        <button type="button" className="m-icon-btn size-9" onClick={onFold} aria-label={S.fold} title={S.fold}>
          <Icon name={full ? "close" : "chevronDown"} size={20} />
        </button>
        {canHide && !full && (
          <button type="button" className="m-icon-btn size-9" aria-label={A.hide} title={A.hide} onClick={onHide}>
            <Icon name="eyeOff" size={18} />
          </button>
        )}
      </div>
      {kind === "sheikh" ? <SheikhChat autoFocus={full} /> : <AssistantChat onRead={onRead} />}
    </div>
  );
}
