"use client";

import { t } from "@/lib/mahdi/i18n";
import ChallengeList from "@/components/mahdi/ChallengeList";

/** Unified challenges set by the admin: the same definition for everyone, so comparing is fair. */
export default function ChallengesPage() {
  return (
    <div className="space-y-6">
      <h1 className="m-display text-3xl">{t.challenges.title}</h1>
      <p className="m-note">{t.challenges.intro}</p>
      <ChallengeList />
    </div>
  );
}
