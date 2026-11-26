// «رابط حسابي»: a person's reading as their public link shows it — pages this month, all the pages, books finished,
// what they're reading now, and their place in «تحدي القراءة». Plain markup: drawn on the server page of the link and
// on the person's page in the app.
import { fmtNum, t } from "@/lib/mahdi/i18n";
import type { PublicReading } from "@/lib/mahdi/social";
import Icon from "./Icon";

const R = t.publicReading;
// the first three: a medal in the colour of the place (gold, silver, bronze) — drawn, not an emoji
export const MEDAL_COLORS = ["var(--m-gold)", "#9aa5b8", "#d08a4e"];

export default function PublicReadingCard({ reading }: { reading: PublicReading }) {
  const c = reading.challenge;
  return (
    <section className="m-card space-y-4 p-5" aria-label={R.title}>
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon name="book" size={20} className="m-gold" /> {R.title}
      </h2>
      {c && (
        <div className="rounded-2xl p-4 text-center" style={{ background: "color-mix(in srgb, var(--m-gold) 14%, transparent)" }}>
          <p className="text-sm m-muted">{c.over ? R.challengeOver(c.title) : R.challenge(c.title)}</p>
          <p className="m-num text-3xl font-bold">
            {c.rank <= 3 && c.pages > 0 && (
              <span style={{ color: MEDAL_COLORS[c.rank - 1] }}>
                <Icon name="medal" size={28} className="m-ico" strokeWidth={2.2} />
              </span>
            )}
            {R.rank(fmtNum(c.rank), fmtNum(c.total))}
          </p>
          <p className="m-num text-sm font-semibold m-gold">{R.pages(fmtNum(c.pages))}</p>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="m-num text-2xl font-bold">{fmtNum(reading.monthPages)}</p>
          <p className="text-xs m-muted">{R.month}</p>
        </div>
        <div>
          <p className="m-num text-2xl font-bold">{fmtNum(reading.totalPages)}</p>
          <p className="text-xs m-muted">{R.total}</p>
        </div>
        <div>
          <p className="m-num text-2xl font-bold">{fmtNum(reading.finished)}</p>
          <p className="text-xs m-muted">{R.finished}</p>
        </div>
      </div>
      {reading.now.length > 0 && (
        <p className="text-sm">
          <span className="m-muted">{R.now}</span> {reading.now.map((x) => `«${x}»`).join("، ")}
        </p>
      )}
    </section>
  );
}
