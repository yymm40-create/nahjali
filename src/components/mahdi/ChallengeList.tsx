"use client";

import Link from "next/link";
import { fmtDate, t } from "@/lib/mahdi/i18n";
import { challengeAsHabit, describeGoal } from "@/lib/mahdi/client/derive";
import type { Challenge } from "@/lib/mahdi/types";
import Icon from "./Icon";
import { useMahdi } from "./Provider";

/** Published challenges, grouped by section; ended ones go to the bottom. */
export default function ChallengeList() {
  const { state } = useMahdi();
  const { challenges, profile } = state.snap;
  const today = state.today;
  const joined = new Set(challenges.memberships.filter((m) => !m.leftOn).map((m) => m.challengeId));
  const isEnded = (c: Challenge) => Boolean(c.endsOn && c.endsOn < today);

  const card = (c: Challenge) => {
    const v = challengeAsHabit(c, { joinedOn: c.startsOn, leftOn: null }).versions[0];
    return (
      <li key={c.id}>
        <Link href={`/mahdi/challenges/${c.id}`} className="m-card flex items-center gap-3 p-4">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{c.title}</span>
            <span className="block text-sm m-muted">{describeGoal(v, profile.weekStart)}</span>
            <span className="m-num block text-sm m-muted">{t.challenges.period(fmtDate(c.startsOn), c.endsOn ? fmtDate(c.endsOn) : null)}</span>
          </span>
          {joined.has(c.id) && <span className="m-chip m-chip-success"><Icon name="check" size={14} /> {t.challenges.joined}</span>}
          {!joined.has(c.id) && c.startsOn > today && <span className="m-chip">{t.challenges.upcoming}</span>}
          {isEnded(c) && <span className="m-chip">{t.challenges.endedShort}</span>}
          <Icon name="chevronLeft" size={18} />
        </Link>
      </li>
    );
  };

  const live = challenges.list.filter((c) => !isEnded(c));
  const ended = challenges.list.filter(isEnded);
  if (!challenges.list.length) return <p className="m-card p-6 text-center m-muted">{t.challenges.empty}</p>;

  return (
    <div className="space-y-6">
      {challenges.sections.map((s) => {
        const items = live.filter((c) => c.sectionId === s.id);
        if (!items.length) return null;
        return (
          <section key={s.id} aria-labelledby={`sec-${s.id}`} className="space-y-3">
            <div>
              <h2 id={`sec-${s.id}`} className="flex items-center gap-2 text-lg font-semibold">
                {s.icon && <span aria-hidden="true">{s.icon}</span>} {s.name}
              </h2>
              {s.description && <p className="text-sm m-muted">{s.description}</p>}
            </div>
            <ul className="space-y-3">{items.map(card)}</ul>
          </section>
        );
      })}
      {ended.length > 0 && (
        <section aria-labelledby="sec-ended" className="space-y-3">
          <h2 id="sec-ended" className="text-lg font-semibold m-muted">{t.challenges.endedGroup}</h2>
          <ul className="space-y-3">{ended.map(card)}</ul>
        </section>
      )}
    </div>
  );
}
