"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { PostView } from "@/lib/mahdi/social";
import Icon from "@/components/mahdi/Icon";
import PostCard from "@/components/mahdi/social/PostCard";

/** One post on its own page (from a notification), with its comments open. */
export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<PostView | null>(null);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    mahdiFetch<{ post: PostView }>(`/api/mahdi/community/posts/${id}`)
      .then((r) => live && setPost(r.post))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [id]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/mahdi/community" className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> {t.community.title}
      </Link>
      {gone ? (
        <p className="m-card p-6 text-center m-muted">{t.community.deleted}</p>
      ) : post ? (
        <PostCard post={post} onChange={setPost} onRemoved={() => setGone(true)} openComments />
      ) : error ? (
        <p className="m-card p-6 text-center">{error}</p>
      ) : (
        <p className="m-muted">{t.common.loading}</p>
      )}
    </div>
  );
}
