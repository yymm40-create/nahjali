import Link from "next/link";
import { t } from "@/lib/mahdi/i18n";
import Icon from "./Icon";
import { READ_CHALLENGE_PATH } from "./ReadChallengeInvite";

/** A way into «تحدي القراءة» from the reading and the challenges pages. */
export default function ReadChallengeLink() {
  return (
    <Link href={READ_CHALLENGE_PATH} className="m-card flex items-center gap-3 p-4 font-semibold">
      <span className="text-2xl" aria-hidden="true">🏆</span>
      <span className="flex-1">{t.readChallenge.card}</span>
      <Icon name="chevronLeft" size={18} />
    </Link>
  );
}
