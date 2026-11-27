import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@config/site";
import { VOTE_PERFORMERS, VOTE_POINTS, VOTE_TITLE } from "@config/mahdi-vote";
import { getMahdiSession } from "@/lib/mahdi/server/session";
import { loadVoteResults } from "@/lib/mahdi/server/vote";
import "../vote.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `نتائج ${VOTE_TITLE}`, robots: { index: false, follow: false, nocache: true } };

const num = (n: number) => n.toLocaleString("ar-SA");
const when = (iso: string) => new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** «تصويت محبوبة الباري» — the results, for the site's owners only (the same check as «المسابقة»'s leader panel). */
export default async function QasidaVoteResults() {
  const { user } = await getMahdiSession();
  if (!user) redirect("/mahdi/login?next=/mahdi/vote/results");
  if (!isAdmin(user.email)) notFound();
  const res = await loadVoteResults();
  const names = new Map(VOTE_PERFORMERS.map((p) => [p.id, p.name]));
  const total = res?.rows.length ?? 0;
  const radood = res?.rows.filter((r) => r.radood).length ?? 0;
  const top = Math.max(1, ...(res?.tally.map((t) => t.points) ?? [0]));

  return (
    <div className="mahdi-root qv-page" data-mtheme="sun" dir="rtl" lang="ar">
      <main id="m-main" className="qv-main space-y-4">
        <header className="qv-hero">
          <p className="qv-eyebrow">للإدارة فقط</p>
          <h1 className="m-display qv-title">نتائج التصويت</h1>
          <p className="qv-line">
            {num(total)} صوت · منها {num(radood)} من الرواديد · صوت الجمهور {num(VOTE_POINTS.public)} نقطة وصوت الرادود {num(VOTE_POINTS.radood)}
          </p>
        </header>

        {!res ? (
          <p className="m-note">جدول التصويت غير موجود بعد: شغّل ملف supabase/migrations/0136_mahdi_qasida_vote.sql في Supabase.</p>
        ) : (
          <>
            <section className="qv-step">
              <div className="qv-step-head">
                <h2 className="qv-step-title">الترتيب بالنقاط</h2>
                <span className="qv-step-sub">نقاط · أصوات</span>
              </div>
              {res.tally.map((t, i) => (
                <div key={t.id} className="qv-res-row" data-first={(i === 0 && t.points > 0) || undefined}>
                  <span className="qv-res-rank">{num(i + 1)}</span>
                  <Image src={t.photo} alt="" width={96} height={120} sizes="48px" className="qv-res-photo" />
                  <div className="qv-res-body">
                    <p className="font-bold">{t.name}</p>
                    <p className="m-hint">
                      {num(t.votes)} صوت ({num(t.votes - t.radood)} جمهور + {num(t.radood)} رادود)
                    </p>
                    <div className="qv-res-bar">
                      <div className="qv-res-fill" style={{ width: `${(t.points / top) * 100}%` }} />
                    </div>
                  </div>
                  <div className="qv-res-pts">
                    <b className="m-num">{num(t.points)}</b>
                    <span className="m-hint">نقطة</span>
                  </div>
                </div>
              ))}
            </section>

            <section className="qv-step">
              <div className="qv-step-head">
                <h2 className="qv-step-title">الأصوات</h2>
                <span className="qv-step-sub">الأحدث أولًا</span>
              </div>
              {res.rows.length === 0 && <p className="m-hint">ما وصل أي صوت للحين.</p>}
              {res.rows.map((r) => (
                <div key={r.id} className="qv-vote">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{r.name}</span>
                    {r.radood && <span className="m-chip m-chip-gold">رادود · ٢</span>}
                    <span className="m-hint">← {names.get(r.performer) ?? r.performer}</span>
                    <span className="m-hint ms-auto">{when(r.created_at)}</span>
                  </div>
                  {r.reason && <p className="mt-1 whitespace-pre-line">{r.reason}</p>}
                </div>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
