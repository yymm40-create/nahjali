"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef } from "react";
import { t } from "@/lib/mahdi/i18n";
import ChallengeList from "@/components/mahdi/ChallengeList";
import CommunityFeed from "@/components/mahdi/CommunityFeed";
import GroupsHome from "@/components/mahdi/GroupsHome";
import JoinPrompt from "@/components/mahdi/JoinPrompt";
import { StoriesBar } from "@/components/mahdi/social/Stories";
import LeaderboardTab from "@/components/mahdi/LeaderboardTab";
import { FeedbackCard } from "@/components/mahdi/Feedback";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";

const TABS = ["feed", "explore", "ranking", "challenges", "groups"] as const;
type Tab = (typeof TABS)[number];
const LABEL = { ...t.community.tabLabels, groups: t.groups.tab };

/**
 * «المجتمع»: posts of the people I follow, «استكشف» (public posts), the ranking, the unified challenges and the
 * groups. Posts and the ranking need the user to join first.
 */
export default function CommunityPage() {
  const { state } = useMahdi();
  const params = useSearchParams();
  const q = params.get("tab");
  const tab: Tab = TABS.includes(q as Tab) ? (q as Tab) : "feed";
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ feed: null, explore: null, ranking: null, challenges: null, groups: null });

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
  const me = state.snap.username;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="m-display text-3xl">{t.community.title}</h1>
        {joined && (
          <div className="flex gap-2">
            {me && (
              <Link href={`/mahdi/u/${encodeURIComponent(me)}`} className="m-btn m-btn-ghost m-btn-sm">
                <Icon name="user" size={18} /> {t.social.myPage}
              </Link>
            )}
            <Link href="/mahdi/post/new" className="m-btn m-btn-primary m-btn-sm">
              <Icon name="plus" size={18} /> {t.social.newPost}
            </Link>
          </div>
        )}
      </div>
      <div role="tablist" aria-label={t.community.tabs} className="m-scroll-x -mx-1 flex gap-1.5 px-1 pb-1">
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
            className="m-option min-h-11 shrink-0 px-3.5 text-sm font-semibold"
            onClick={() => choose(k)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {LABEL[k]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "groups" ? (
          <GroupsHome />
        ) : tab === "challenges" ? (
          <ChallengeList />
        ) : !joined ? (
          <JoinPrompt />
        ) : tab === "ranking" ? (
          <LeaderboardTab />
        ) : (
          <div className="space-y-4">
            {state.snap.privacy.storiesInFeed ? (
              <StoriesBar compact />
            ) : (
              <Link href="/mahdi/stories" className="m-btn m-btn-ghost w-full">
                <Icon name="play" size={18} /> {t.social.stories.open}
              </Link>
            )}
            <p className="m-note text-sm">{t.social.rules}</p>
            <Link href="/mahdi/share" className="m-btn m-btn-ghost w-full">
              <Icon name="sparkle" size={18} /> {t.community.share}
            </Link>
            <CommunityFeed key={tab} source={tab === "explore" ? "explore" : "following"} />
          </div>
        )}
      </div>
      <FeedbackCard place="community" />
    </div>
  );
}
