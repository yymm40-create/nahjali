"use client";

import Link from "next/link";
import { useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import Icon from "@/components/mahdi/Icon";
import JoinPrompt from "@/components/mahdi/JoinPrompt";
import { useMahdi } from "@/components/mahdi/Provider";
import { StoriesBar } from "@/components/mahdi/social/Stories";
import StoryCamera from "@/components/mahdi/social/StoryCamera";

/** «القصص» in their own place (for those who keep them off the top of the community). */
export default function StoriesPage() {
  const { state } = useMahdi();
  const [camera, setCamera] = useState(false);
  const [reload, setReload] = useState(0);
  if (!state.snap.privacy.community) return <JoinPrompt />;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/mahdi/community" className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> {t.community.title}
      </Link>
      <div className="flex items-center justify-between gap-2">
        <h1 className="m-display text-3xl">{t.social.stories.title}</h1>
        <button type="button" className="m-btn m-btn-primary m-btn-sm" onClick={() => setCamera(true)}>
          <Icon name="camera" size={18} /> {t.social.stories.new}
        </button>
      </div>
      <section className="m-card p-4">
        <StoriesBar key={reload} />
      </section>
      <p className="m-hint">{t.social.stories.expires}</p>
      <StoryCamera open={camera} onClose={() => setCamera(false)} onPublished={() => setReload((n) => n + 1)} />
    </div>
  );
}
