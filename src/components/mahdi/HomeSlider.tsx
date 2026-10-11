"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { t } from "@/lib/mahdi/i18n";
import CommunityFeed from "./CommunityFeed";
import HomeBoard from "./HomeBoard";
import Icon from "./Icon";
import JoinPrompt from "./JoinPrompt";
import { useMahdi } from "./Provider";
import PeopleSearch from "./social/PeopleSearch";
import { StoriesBar } from "./social/Stories";

const H = t.slider;

/**
 * The home screen: the board of cards (HomeBoard). «المتابَعون» (the stories and the posts of the people followed) is
 * no longer a slider on top of the home — the redesign keeps the home calm — it is a place of its own in the side menu
 * (☰), at /mahdi?view=following.
 */
export default function HomeSlider() {
  const following = useSearchParams().get("view") === "following";
  if (!following) return <HomeBoard />;
  return (
    <div className="space-y-4">
      <Link href="/mahdi" className="m-btn m-btn-ghost m-btn-sm">
        <Icon name="chevronRight" size={18} /> {H.home}
      </Link>
      <FollowingPane />
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
