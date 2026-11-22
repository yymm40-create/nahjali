"use client";

// «تحدي القراءة»: what a member's pages are made of — day by day, each line with where it came from (a book's pages,
// a habit in pages, a group program, a unified challenge), how many pages, and what doesn't count and why. Mine for
// everyone; anyone's for the owner, who can also take a session out as «read before» (and put it back).

import { useCallback, useEffect, useState } from "react";
import { fmtDate, fmtNum, t, weekdayName } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { ReadDetailRow } from "@/lib/mahdi/read-challenge";
import Sheet from "./Sheet";

const D = t.readChallenge.detail;
const ranges = (r: [number, number][] | null) => (r ?? []).map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join("، ");

export default function ReadChallengeDetail({ who, name, onClose, onChanged }: { who: string; name: string; onClose: () => void; onChanged: () => void }) {
  const [rows, setRows] = useState<ReadDetailRow[] | null>(null);
  const [owner, setOwner] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    () =>
      mahdiFetch<{ rows: ReadDetailRow[]; owner: boolean }>(`/api/mahdi/read-challenge?detail=${encodeURIComponent(who)}`)
        .then((r) => {
          setRows(r.rows);
          setOwner(r.owner);
        })
        .catch((e) => setError((e as Error).message)),
    [who],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function setEarlier(row: ReadDetailRow, earlier: boolean) {
    setBusy(row.refId);
    try {
      await mahdiFetch("/api/mahdi/read-challenge", { method: "POST", json: { session: row.refId, earlier } });
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  }

  const counted = (rows ?? []).filter((r) => r.counted).reduce((n, r) => n + r.pages, 0);
  const left = (rows ?? []).filter((r) => !r.counted).reduce((n, r) => n + r.pages, 0);
  const days = [...new Set((rows ?? []).map((r) => r.day))];

  return (
    <Sheet open onClose={onClose} title={D.title(name)}>
      <div className="space-y-4">
        {error && <p className="m-error text-sm" role="alert">{error}</p>}
        {!rows && !error && <p className="m-muted">{t.common.loading}</p>}
        {rows && (
          <>
            <p className="m-num font-semibold">{D.total(Math.floor(counted))}</p>
            {left > 0 && <p className="m-num text-sm m-muted">{D.notCountedTotal(Math.floor(left))}</p>}
            {rows.length === 0 && <p className="m-note text-sm">{D.empty}</p>}
            {days.map((day) => {
              const list = rows.filter((r) => r.day === day);
              const sum = list.filter((r) => r.counted).reduce((n, r) => n + r.pages, 0);
              return (
                <section key={day} className="space-y-1.5">
                  <h3 className="flex items-baseline justify-between gap-2 border-b pb-1 text-sm font-semibold" style={{ borderColor: "var(--m-line)" }}>
                    <span>
                      {weekdayName(day)} <span className="m-num m-muted font-normal">{fmtDate(day)}</span>
                    </span>
                    <span className="m-num m-gold">{D.pages(Math.floor(sum))}</span>
                  </h3>
                  <ul className="space-y-1.5">
                    {list.map((r, i) => (
                      <li key={`${r.refId}-${i}`} className="flex items-start gap-2 text-sm" style={r.counted ? undefined : { opacity: 0.6 }}>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold" dir="auto">
                            {r.title}
                          </span>
                          <span className="block text-xs m-muted">
                            {D.source[r.source]}
                            {r.ranges && r.ranges.length > 0 && <span className="m-num" dir="ltr"> · {ranges(r.ranges)}</span>}
                          </span>
                          {!r.counted && r.why && <span className="block text-xs" style={{ color: "var(--m-error)" }}>{D.why[r.why]}</span>}
                          {owner && r.source === "book" && (r.counted || r.why === "earlier") && (
                            <button type="button" className="mt-1 text-xs font-semibold m-gold underline" disabled={busy === r.refId} onClick={() => void setEarlier(r, r.counted)}>
                              {r.counted ? D.markEarlier : D.unmarkEarlier}
                            </button>
                          )}
                        </span>
                        <span className={`m-num shrink-0 font-semibold ${r.counted ? "" : "line-through"}`}>{fmtNum(Math.floor(r.pages))}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </div>
    </Sheet>
  );
}
