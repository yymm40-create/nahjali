import type { Metadata } from "next";
import VoteForm from "@/components/mahdi/vote/VoteForm";
import { VOTE_LINE, VOTE_TITLE } from "@config/mahdi-vote";
import "./vote.css";

// unlisted: no link to it anywhere in the app, not in the sitemap, not for search engines — it opens only from its own address
export const metadata: Metadata = {
  title: VOTE_TITLE,
  description: VOTE_LINE,
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/** «تصويت محبوبة الباري»: no sign-in — a name, one performance, and an optional «ليش؟». */
export default function QasidaVotePage() {
  return <VoteForm />;
}
