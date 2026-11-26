"use client";

import { useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import AssistantChat from "./AssistantChat";
import SheikhChat from "./SheikhChat";
import Icon from "./Icon";
import Robot from "./Robot";

const A = t.assistant;
const S = t.sheikh;
const SIZE = 60;
const EDGE = 12;

/** The space the bottom bar takes on phones (the chat stays above it). */
function navSpace() {
  const nav = document.querySelector<HTMLElement>(".m-bottom-nav");
  return nav && nav.offsetParent !== null ? nav.getBoundingClientRect().height : 0;
}

/**
 * The team's chat («المساعد»), opened by a reply notification with ?assistant=1 on any screen. The floating robot that
 * used to sit over every screen is gone (the plan approved on 26 November 2026): «الشيخ الذكي» has its own page, opened
 * from «أنا» and from the reading.
 */
export default function AssistantFloat({ openFromLink, onLinkClosed, onRead }: { openFromLink: boolean; onLinkClosed: () => void; onRead: () => void }) {
  const [full, setFull] = useState(false);
  if (!openFromLink) return null;
  return (
    <ChatPanel
      side="left"
      kind="team"
      full={full}
      onFull={setFull}
      canHide={false}
      onFold={() => {
        setFull(false);
        onLinkClosed();
      }}
      onHide={onLinkClosed}
      onRead={onRead}
    />
  );
}

/**
 * Where the chat opens: at the bottom corner, above the bar (where there is more room), never
 * under the top bar nor over the bottom bar.
 */
function placeChat(side: "left" | "right"): React.CSSProperties {
  const vh = window.innerHeight;
  const nav = navSpace();
  const top = vh - nav - 14 - SIZE;
  const bottom = vh - nav - 14;
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
