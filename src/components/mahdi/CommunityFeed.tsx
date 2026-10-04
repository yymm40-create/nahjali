"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { PostView } from "@/lib/mahdi/social";
import Icon from "./Icon";
import PostCard from "./social/PostCard";

const S = t.social;

/** Counts a post as seen when at least half of it stays on screen for a second (sent in small batches). */
function useViewTracker() {
  const queue = useRef(new Set<string>());
  const sent = useRef(new Set<string>());
  const io = useRef<IntersectionObserver | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const flush = () => {
      const ids = [...queue.current];
      if (!ids.length) return;
      queue.current.clear();
      mahdiFetch("/api/mahdi/community/views", { method: "POST", json: { posts: ids } }).catch(() => {});
    };
    io.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.post;
          if (!id || sent.current.has(id)) continue;
          if (e.isIntersecting) {
            if (!timers.current.has(id))
              timers.current.set(
                id,
                setTimeout(() => {
                  sent.current.add(id);
                  queue.current.add(id);
                }, 1000),
              );
          } else {
            clearTimeout(timers.current.get(id));
            timers.current.delete(id);
          }
        }
      },
      { threshold: 0.5 },
    );
    const every = setInterval(flush, 3000);
    const all = timers.current;
    return () => {
      clearInterval(every);
      flush();
      io.current?.disconnect();
      all.forEach((t2) => clearTimeout(t2));
    };
  }, []);

  return (el: HTMLElement | null) => {
    const card = el?.querySelector("[data-post]");
    if (card && io.current) io.current.observe(card);
  };
}

/** A feed of posts: «المتابَعون», «استكشف», or one person's page (`user`). */
export default function CommunityFeed({ source = "following", user, empty }: { source?: "following" | "explore"; user?: string; empty?: React.ReactNode }) {
  const [posts, setPosts] = useState<PostView[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const watch = useViewTracker();
  const base = user ? `/api/mahdi/community/posts?user=${encodeURIComponent(user)}` : `/api/mahdi/community/posts?feed=${source}`;
  const fetchPage = (before?: string) => mahdiFetch<{ posts: PostView[]; more: boolean }>(`${base}${before ? `&before=${encodeURIComponent(before)}` : ""}`);

  // The newest posts: on opening, and again when «حاول مرة أخرى» is pressed
  useEffect(() => {
    let live = true;
    fetchPage()
      .then((res) => {
        if (!live) return;
        setPosts(res.posts);
        setMore(res.more);
        setError("");
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, base]);

  async function loadMore(before: string) {
    setLoading(true);
    try {
      const res = await fetchPage(before);
      setPosts((prev) => {
        const known = new Set((prev ?? []).map((p) => p.id));
        return [...(prev ?? []), ...res.posts.filter((p) => !known.has(p.id))];
      });
      setMore(res.more);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }

  if (error && !posts) {
    return (
      <p className="m-error" role="alert">
        {error} <button type="button" className="underline" onClick={() => setReload((n) => n + 1)}>{t.common.retry}</button>
      </p>
    );
  }
  if (!posts) return <p className="m-muted">{t.common.loading}</p>;

  return (
    <div className="space-y-5">
      {posts.length === 0 ? (
        (empty ?? <p className="m-card p-6 text-center m-muted">{source === "explore" ? S.exploreEmpty : S.followingEmpty}</p>)
      ) : (
        <ul className="space-y-5" aria-label={t.community.feed}>
          {posts.map((p) => (
            <li key={p.id} ref={watch}>
              <PostCard post={p} onChange={(np) => setPosts((list) => (list ?? []).map((x) => (x.id === np.id ? np : x)))} onRemoved={(id) => setPosts((list) => (list ?? []).filter((x) => x.id !== id))} />
            </li>
          ))}
        </ul>
      )}
      {error && <p className="m-error" role="alert">{error}</p>}
      {more && (
        <button type="button" className="m-btn m-btn-ghost w-full" disabled={loading} onClick={() => loadMore(posts[posts.length - 1].createdAt)}>
          {loading ? t.common.loading : t.community.loadMore}
        </button>
      )}
      {!user && source === "following" && posts.length === 0 && (
        <Link href="/mahdi/community?tab=explore" className="m-btn m-btn-ghost w-full">
          <Icon name="search" size={18} /> {t.community.tabLabels.explore}
        </Link>
      )}
    </div>
  );
}
