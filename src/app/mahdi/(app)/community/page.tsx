"use client";

import HubDoors from "@/components/mahdi/HubDoors";
import { DOORS } from "@/components/mahdi/nav";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { t } from "@/lib/mahdi/i18n";
import CommunityFeed from "@/components/mahdi/CommunityFeed";
import JoinPrompt from "@/components/mahdi/JoinPrompt";
import { StoriesBar } from "@/components/mahdi/social/Stories";
import PeopleSearch from "@/components/mahdi/social/PeopleSearch";
import PageHead from "@/components/mahdi/social/PageHead";
import { FeedbackCard } from "@/components/mahdi/Feedback";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";

const TABS = ["feed", "explore"] as const;
type Tab = (typeof TABS)[number];
const LABEL: Record<Tab, string> = { feed: t.community.tabLabels.feed, explore: t.community.tabLabels.explore };
/** The tabs that moved out of this page (the plan of 26 November 2026): old links still land in the right place. */
const MOVED: Record<string, string> = { ranking: "/mahdi/challenges", challenges: "/mahdi/challenges", groups: "/mahdi/groups" };

/**
 * «المجتمع»: one clear feed. The stories ring on top (the achievement yellow), the row of places (المجموعات ·
 * التحديات · المسابقة …), then two choices: «المتابَعون» and «استكشف». A new post or story is the top bar's «+»;
 * «صفحتي» stays here and in «أنا». Posts need the user to join the community first.
 */
export default function CommunityPage() {
  const { state } = useMahdi();
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("tab");
  const tab: Tab = TABS.includes(q as Tab) ? (q as Tab) : "feed";
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ feed: null, explore: null });

  useEffect(() => {
    if (q && MOVED[q]) router.replace(MOVED[q]);
  }, [q, router]);

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
      <PageHead title={t.community.title}>
        {joined && me && (
          <Link href={`/mahdi/u/${encodeURIComponent(me)}`} className="m-btn m-btn-quiet m-btn-sm">
            <Icon name="user" size={18} /> {t.social.myPage}
          </Link>
        )}
      </PageHead>

      {joined &&
        (state.snap.privacy.storiesInFeed ? (
          <StoriesBar />
        ) : (
          <Link href="/mahdi/stories" className="m-door">
            <Icon name="camera" size={18} /> {t.social.stories.open}
          </Link>
        ))}

      <HubDoors doors={DOORS.community} label="أماكن المجتمع" />

      <div role="tablist" aria-label={t.community.tabs} className="grid grid-cols-2 gap-2">
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
            className="m-option min-h-11 px-3.5 text-sm font-semibold"
            onClick={() => choose(k)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {LABEL[k]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-4">
        {!joined ? (
          <JoinPrompt />
        ) : (
          <>
            {tab === "explore" ? (
              <PeopleSearch />
            ) : (
              <Link href="/mahdi/share" className="m-card flex items-center gap-3 p-3.5">
                <span className="m-row-ic" aria-hidden="true">
                  <Icon name="sparkle" size={20} />
                </span>
                <span className="flex-1 font-semibold">{t.community.share}</span>
                <Icon name="chevronLeft" size={18} />
              </Link>
            )}
            <CommunityFeed key={tab} source={tab === "explore" ? "explore" : "following"} />
            <p className="m-hint text-center text-xs">{t.social.rules}</p>
          </>
        )}
      </div>
      <FeedbackCard place="community" />
    </div>
  );
}
