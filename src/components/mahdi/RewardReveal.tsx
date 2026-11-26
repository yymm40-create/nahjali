"use client";

import Link from "next/link";
import { MILESTONES } from "@config/mahdi-rewards";
import { t } from "@/lib/mahdi/i18n";
import { pickPhrase } from "@/lib/mahdi/client/derive";
import Icon from "./Icon";
import { useMahdi } from "./Provider";
import Sheet from "./Sheet";
import { usePopupTurn } from "./usePopupTurn";

/**
 * A calm reveal when a milestone is reached: what it means and what it opens. It waits its turn («نافذة وحدة بس في كل زيارة»):
 * after something completed, and only if nothing else opened during this visit; otherwise it stays unseen until the next visit.
 */
export default function RewardReveal() {
  const { revealed, closeReveal: markSeen, state } = useMahdi();
  const list = MILESTONES.filter((m) => revealed.includes(m.id));
  const phrase = pickPhrase(state.snap.phrases, "milestone", revealed.join());
  const { show, done } = usePopupTurn("reward", list.length > 0);
  const closeReveal = () => {
    done();
    markSeen();
  };
  return (
    <Sheet open={show} onClose={closeReveal} title={t.rewards.newTitle}>
      <div className="space-y-5 text-center">
        <span className="m-reveal mx-auto grid size-20 place-items-center rounded-full" style={{ background: "linear-gradient(180deg, var(--m-gold-2), var(--m-gold))", color: "var(--m-gold-ink)" }}>
          <Icon name="sparkle" size={38} />
        </span>
        {list.map((m) => (
          <div key={m.id} className="space-y-1">
            <p className="m-display m-gold text-2xl">{m.title}</p>
            <p>{m.description}</p>
            <p className="text-sm m-muted">
              {t.rewards.opens} {m.rewardLabel}
            </p>
          </div>
        ))}
        {phrase && <p className="m-note text-sm">{phrase.text}</p>}
        <Link href="/mahdi/more/rewards" className="m-btn m-btn-primary w-full" onClick={closeReveal}>
          {t.rewards.apply}
        </Link>
      </div>
    </Sheet>
  );
}
