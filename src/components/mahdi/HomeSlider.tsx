"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import CommunityFeed from "./CommunityFeed";
import DayView from "./DayView";
import Icon from "./Icon";
import JoinPrompt from "./JoinPrompt";
import { useMahdi } from "./Provider";
import PeopleSearch from "./social/PeopleSearch";
import { StoriesBar } from "./social/Stories";

const H = t.slider;
type View = "following" | "home";
// Right to left: «المتابَعون» on the right, «الرئيسية» on the left
const VIEWS: View[] = ["following", "home"];
/** How far a finger moves sideways before the screen changes. */
const SWIPE_PX = 70;

/**
 * The home screen with its slider at the top: «الرئيسية» (the day: progress, habits, reading…) or «المتابَعون» (stories,
 * adding a story, and the posts of the people followed, in their own look). Tap a side of the slider, or move a
 * finger sideways on the screen: to the right for «المتابَعون», to the left for «الرئيسية». The choice stays in the
 * address (?view=following).
 */
export default function HomeSlider() {
  const [view, setView] = useState<View>(useSearchParams().get("view") === "following" ? "following" : "home");
  const [enter, setEnter] = useState<"" | "from-left" | "from-right">("");
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; y: number; id: number; on: boolean } | null>(null);
  const tabs = useRef<Record<View, HTMLButtonElement | null>>({ following: null, home: null });

  function choose(next: View, focus = false) {
    if (next !== view) {
      setEnter(next === "following" ? "from-left" : "from-right");
      setView(next);
      const url = new URL(location.href);
      if (next === "following") url.searchParams.set("view", "following");
      else url.searchParams.delete("view");
      history.replaceState(null, "", url);
      window.scrollTo({ top: 0 });
    }
    if (focus) tabs.current[next]?.focus();
  }

  // A finger moving sideways (not on something that scrolls sideways itself, nor while typing)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    if ((e.target as Element).closest(".m-scroll-x, input, textarea, select, dialog, [data-noswipe]")) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.on) {
      if (Math.abs(my) > 12 && Math.abs(my) > Math.abs(mx)) return void (drag.current = null); // scrolling up or down
      if (Math.abs(mx) < 12) return;
      d.on = true;
    }
    // Only towards the other screen; a light pull the other way
    const toward = view === "home" ? mx > 0 : mx < 0;
    setDx(toward ? mx * 0.6 : mx * 0.15);
  };
  const onPointerEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.on) return;
    if (view === "home" && dx > SWIPE_PX * 0.6) choose("following");
    else if (view === "following" && dx < -SWIPE_PX * 0.6) choose("home");
    setDx(0);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") choose("following", true);
    else if (e.key === "ArrowLeft") choose("home", true);
  };

  return (
    <div className="space-y-4">
      <div className="m-slider-wrap">
        <div role="tablist" aria-label={H.label} className="m-slider" data-view={view}>
          <span className="m-slider-knob" aria-hidden="true" />
          {VIEWS.map((v) => (
            <button
              key={v}
              ref={(el) => {
                tabs.current[v] = el;
              }}
              type="button"
              role="tab"
              id={`view-${v}`}
              aria-selected={view === v}
              aria-controls="view-panel"
              tabIndex={view === v ? 0 : -1}
              onClick={() => choose(v)}
              onKeyDown={onKey}
            >
              <Icon name={v === "home" ? "home" : "users"} size={18} /> {H[v]}
            </button>
          ))}
        </div>
      </div>
      <div
        id="view-panel"
        role="tabpanel"
        aria-labelledby={`view-${view}`}
        key={view}
        className={`m-pane ${enter ? `m-pane-${enter}` : ""}`}
        style={{ touchAction: "pan-y", transform: dx ? `translateX(${dx}px)` : undefined, opacity: dx ? 1 - Math.min(Math.abs(dx) / 400, 0.4) : undefined, transition: dx ? "none" : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {view === "home" ? <DayView home /> : <FollowingPane />}
      </div>
    </div>
  );
}

/** «المتابَعون»: the stories (with «أضف قصة» opening the camera) and the posts of the people I follow. */
function FollowingPane() {
  const { state } = useMahdi();
  if (!state.snap.privacy.community) return <JoinPrompt />;
  return (
    <div className="m-following space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="m-display text-2xl">{H.followingTitle}</h1>
        <Link href="/mahdi/post/new" className="m-btn m-btn-primary m-btn-sm">
          <Icon name="plus" size={18} /> {H.newPost}
        </Link>
      </div>
      <PeopleSearch />
      <StoriesBar big />
      <CommunityFeed
        source="following"
        flat
        empty={
          <div className="m-card space-y-3 p-6 text-center">
            <p className="m-muted">{t.social.followingEmpty}</p>
            <Link href="/mahdi/community?tab=explore" className="m-btn m-btn-primary">
              <Icon name="search" size={18} /> {H.explore}
            </Link>
          </div>
        }
      />
    </div>
  );
}
