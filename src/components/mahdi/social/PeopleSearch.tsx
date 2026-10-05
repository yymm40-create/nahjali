"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { SocialUser } from "@/lib/mahdi/social";
import Icon from "../Icon";
import { UserChip } from "./PostCard";

const S = t.social.search;

/**
 * «ابحث عن الموالين»: results appear while typing (the first letters are enough; Arabic letter forms, diacritics and
 * small typos don't matter). Everyone can be found unless their account is private.
 */
export default function PeopleSearch() {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<SocialUser[] | null>(null);
  const [error, setError] = useState("");
  const asked = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (!query) return;
    const n = ++asked.current;
    const timer = setTimeout(() => {
      mahdiFetch<{ people: SocialUser[] }>(`/api/mahdi/social/search?q=${encodeURIComponent(query)}`)
        .then((r) => {
          if (n !== asked.current) return; // an older answer arriving late
          setPeople(r.people);
          setError("");
        })
        .catch((e: Error) => n === asked.current && setError(e.message));
    }, 220);
    return () => clearTimeout(timer);
  }, [q]);

  const shown = q.trim() ? people : null;

  return (
    <section aria-label={S.label} className="space-y-2" role="search">
      <label className="relative block">
        <span className="sr-only">{S.label}</span>
        <span className="m-muted pointer-events-none absolute inset-y-0 start-3 grid place-items-center">
          <Icon name="search" size={18} />
        </span>
        <input
          type="search"
          className="m-field ps-10"
          placeholder={S.placeholder}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!e.target.value.trim()) setPeople(null);
          }}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          dir="auto"
          aria-controls="m-people-results"
          enterKeyHint="search"
        />
      </label>
      {error && <p className="m-error text-sm" role="alert">{error}</p>}
      {shown && (
        <ul id="m-people-results" className="m-card divide-y p-1" style={{ borderColor: "var(--m-line)" }} aria-live="polite">
          {shown.length === 0 ? (
            <li className="m-muted p-3 text-sm">{S.empty}</li>
          ) : (
            shown.map((u) => (
              <li key={u.id} className="flex items-center p-2" style={{ borderColor: "var(--m-line)" }}>
                <UserChip user={u} />
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
