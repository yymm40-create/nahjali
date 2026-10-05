"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { FollowState, ProfileView, SocialUser } from "@/lib/mahdi/social";
import Avatar from "@/components/mahdi/Avatar";
import CommunityFeed from "@/components/mahdi/CommunityFeed";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";
import Sheet from "@/components/mahdi/Sheet";
import { UserChip } from "@/components/mahdi/social/PostCard";

const P = t.social.profile;

/** A person's page in the community: who they are, who follows whom, and their posts (if I may see them). */
export default function PersonPage() {
  const { username } = useParams<{ username: string }>();
  const name = decodeURIComponent(username);
  const params = useSearchParams();
  const { state, toast } = useMahdi();
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<{ which: "followers" | "following" | "requests"; people: SocialUser[] | null } | null>(params.get("requests") ? { which: "requests", people: null } : null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    mahdiFetch<{ profile: ProfileView }>(`/api/mahdi/social/users/${encodeURIComponent(name)}`)
      .then((r) => live && (setProfile(r.profile), setError("")))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [name, reload]);

  useEffect(() => {
    if (!list || list.people || list.which === "requests") return;
    let live = true;
    mahdiFetch<{ people: SocialUser[] }>(`/api/mahdi/social/users/${encodeURIComponent(name)}?list=${list.which}`)
      .then((r) => live && setList((l) => (l ? { ...l, people: r.people } : l)))
      .catch((e) => live && toast((e as Error).message));
    return () => {
      live = false;
    };
  }, [list, name, toast]);

  async function act(action: string, who = name) {
    setBusy(true);
    try {
      await mahdiFetch<{ state: FollowState }>("/api/mahdi/social/follow", { method: "POST", json: { username: who, action } });
      setReload((n) => n + 1);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  if (error) return <p className="m-card p-6 text-center">{error}</p>;
  if (!profile) return <p className="m-muted">{t.common.loading}</p>;
  const { user, counts } = profile;
  const self = profile.state === "self";
  const requests = profile.requests ?? [];
  const shown = list?.which === "requests" ? requests : list?.people;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="m-card space-y-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar profile={user} size={84} />
          <div className="min-w-0 space-y-1">
            <h1 className="m-display truncate text-2xl">{user.displayName}</h1>
            {user.username && <p className="m-muted text-sm"><bdi dir="ltr">@{user.username}</bdi></p>}
            <div className="flex flex-wrap gap-1.5">
              {profile.private && <span className="m-chip"><Icon name="lock" size={14} /> {t.privacy.privateAccount}</span>}
              {profile.followsMe && !self && <span className="m-chip">{P.followsYou}</span>}
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="m-soft py-2">
            <dt className="m-muted text-xs">{P.posts}</dt>
            <dd className="m-num text-xl font-semibold">{fmtNum(counts.posts)}</dd>
          </div>
          {(["followers", "following"] as const).map((k) => (
            <button key={k} type="button" className="m-soft py-2 disabled:cursor-default" disabled={!profile.canSee} onClick={() => setList({ which: k, people: null })}>
              <dt className="m-muted text-xs">{P[k]}</dt>
              <dd className="m-num text-xl font-semibold">{fmtNum(counts[k])}</dd>
            </button>
          ))}
        </dl>
        {self ? (
          <div className="flex flex-wrap gap-2">
            <Link href="/mahdi/post/new" className="m-btn m-btn-primary m-btn-sm flex-1"><Icon name="plus" size={18} /> {t.social.newPost}</Link>
            <Link href="/mahdi/more/privacy" className="m-btn m-btn-ghost m-btn-sm"><Icon name="lock" size={18} /> {P.editPrivacy}</Link>
            {requests.length > 0 && (
              <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => setList({ which: "requests", people: null })}>
                <Icon name="users" size={18} /> {P.requests} <span className="m-num">({requests.length})</span>
              </button>
            )}
          </div>
        ) : !state.snap.privacy.community ? (
          <p className="m-hint">{t.social.post.needCommunity}</p>
        ) : profile.state === "following" ? (
          <button type="button" className="m-btn m-btn-ghost w-full" disabled={busy} onClick={() => act("unfollow")}><Icon name="check" size={18} /> {P.following2} · {P.unfollow}</button>
        ) : profile.state === "pending" ? (
          <button type="button" className="m-btn m-btn-ghost w-full" disabled={busy} onClick={() => act("unfollow")}>{P.requested} · {P.cancelRequest}</button>
        ) : (
          <>
            {params.get("invited") && <p className="m-card p-3 text-center text-sm">{t.social.invite.arrived(profile.user.displayName)}</p>}
            <button type="button" className="m-btn m-btn-primary w-full" disabled={busy} onClick={() => act("follow")}><Icon name="plus" size={18} /> {profile.followsMe ? P.followBack : P.follow}</button>
          </>
        )}
      </header>

      {profile.canSee ? (
        <CommunityFeed user={user.username ?? name} empty={<p className="m-card p-6 text-center m-muted">{self ? P.emptyMine : P.empty}</p>} />
      ) : (
        <section className="m-card space-y-2 p-6 text-center">
          <Icon name="lock" size={32} className="m-gold mx-auto" />
          <p className="font-semibold">{P.private}</p>
          <p className="m-muted text-sm">{P.privateBody}</p>
        </section>
      )}

      <Sheet open={Boolean(list)} onClose={() => setList(null)} title={list ? (list.which === "requests" ? P.requests : P[list.which]) : ""}>
        <ul className="space-y-2">
          {!shown && <li className="m-muted text-sm">{t.common.loading}</li>}
          {shown?.length === 0 && <li className="m-muted text-sm">{P.listEmpty}</li>}
          {shown?.map((u) => (
            <li key={u.id} className="flex items-center gap-2">
              <UserChip user={u} />
              {list?.which === "requests" && u.username && (
                <>
                  <button type="button" className="m-btn m-btn-primary m-btn-sm" disabled={busy} onClick={() => act("accept", u.username!)}>{P.accept}</button>
                  <button type="button" className="m-btn m-btn-ghost m-btn-sm" disabled={busy} onClick={() => act("decline", u.username!)}>{P.decline}</button>
                </>
              )}
              {list?.which === "followers" && self && u.username && (
                <button type="button" className="m-btn m-btn-quiet m-btn-sm" disabled={busy} onClick={() => act("remove", u.username!).then(() => setList({ which: "followers", people: null }))}>{P.removeFollower}</button>
              )}
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
