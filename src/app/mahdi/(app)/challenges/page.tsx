"use client";

import { t } from "@/lib/mahdi/i18n";
import ChallengeList from "@/components/mahdi/ChallengeList";
import FriendsBoard from "@/components/mahdi/FriendsBoard";
import ReadChallengeLink from "@/components/mahdi/ReadChallengeLink";
import PageHead from "@/components/mahdi/social/PageHead";

/**
 * «التحديات»: every challenge in one place (المجتمع › التحديات). The unified challenges set by the admin (the same
 * definition for everyone, so comparing is fair), «تحدي القراءة», and a small weekly ranking among friends.
 */
export default function ChallengesPage() {
  return (
    <div className="space-y-6">
      <PageHead title={t.community.challenges} sub={t.challenges.intro} />
      <ReadChallengeLink />
      <ChallengeList />
      <FriendsBoard />
    </div>
  );
}
