"use client";

import { useSearchParams } from "next/navigation";
import { useRef } from "react";
import { t } from "@/lib/mahdi/i18n";
import ChallengeList from "@/components/mahdi/ChallengeList";
import CommunityFeed from "@/components/mahdi/CommunityFeed";
import JoinPrompt from "@/components/mahdi/JoinPrompt";
import LeaderboardTab from "@/components/mahdi/LeaderboardTab";
import { useMahdi } from "@/components/mahdi/Provider";

const TABS = ["feed", "ranking", "challenges"] as const;
type Tab = (typeof TABS)[number];
const LABEL = t.community.tabLabels;

/** «المجتمع»: the wall, the ranking and the unified challenges. The wall and the ranking need the user to join first. */
export default function CommunityPage() {
  const { state } = useMahdi();
  const params = useSearchParams();
  const q = params.get("tab");
  const tab: Tab = TABS.includes(q as Tab) ? (q as Tab) : "feed";
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ feed: null, ranking: null, challenges: null });

  // The tab lives in the address (?tab=); replaceState changes it without reloading the page or the data
  const choose = (next: Tab) => {
    const url = new URL(location.href);
    url.searchParams.set("tab", next);
    history.replaceState(null, "", url);
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    // Right arrow goes to the previous tab in right-to-left reading order
    const step = e.key === "ArrowLeft" ? 1 : e.key === "ArrowRight" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(i + step + TABS.length) % TABS.length];
    choose(next);
    refs.current[next]?.focus();
  };

  const joined = state.snap.privacy.community;

  return (
    <div className="space-y-5">
      <h1 className="m-display text-3xl">{t.community.title}</h1>
      <div role="tablist" aria-label={t.community.tabs} className="grid grid-cols-3 gap-2">
        {TABS.map((k, i) => (
          <button
            key={k}
            ref={(el) => {
              refs.current[k] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            tabIndex={tab === k ? 0 : -1}
            className="m-option min-h-11 px-2 text-sm font-semibold"
            onClick={() => choose(k)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {LABEL[k]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "challenges" ? <ChallengeList /> : !joined ? <JoinPrompt /> : tab === "feed" ? <CommunityFeed /> : <LeaderboardTab />}
      </div>
    </div>
  );
}
