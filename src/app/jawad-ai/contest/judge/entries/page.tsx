import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { allEntries, isJudge } from "@/lib/contest/server";
import { PlacePicker, VideoCard } from "../../ContestClient";

// «🎞️ كل الفيديوهات المضافة»: every entry with its maker's name, a person's videos together in one card, and under
// each video the places (1st, 2nd, 3rd) — the three picked show on the site.
export const metadata: Metadata = { title: "فيديوهات المسابقة", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EntriesPage() {
  const user = await requireUser("/jawad-ai/contest/judge/entries");
  if (!(await isJudge(user.email))) notFound();
  const { missing, groups } = await allEntries();
  const placed = groups.flatMap((g) => g.videos.filter((v) => v.place).map((v) => ({ place: v.place!, name: g.name, title: v.projectTitle }))).sort((a, b) => a.place - b.place);
  return (
    <main dir="rtl" className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <header className="space-y-2">
        <Link href="/jawad-ai/contest/judge" className="text-sm text-jw-muted">→ التحكيم</Link>
        <h1 className="m-0 text-3xl font-extrabold">🎞️ فيديوهات المسابقة</h1>
        <p className="m-0 text-jw-muted">اختر تحت أي فيديو مركزه. المراكز الثلاثة تطلع في الصفحة الرئيسية للموقع مباشرة، والضغط مرة ثانية على نفس المركز يشيله.</p>
        {!!placed.length && (
          <p className="m-0 font-bold">
            {placed.map((p) => `${["", "🥇", "🥈", "🥉"][p.place]} ${p.name}${p.title ? ` («${p.title}»)` : ""}`).join(" · ")}
          </p>
        )}
      </header>
      {missing && <p className="rounded-xl border border-red-500/40 p-3 text-red-400">جداول المسابقة ما انضافت. شغّل الملف <span dir="ltr">supabase/migrations/0088_film_contest.sql</span> في Supabase.</p>}
      {!groups.length && <p className="text-jw-muted">ما فيه فيديوهات مضافة للحين.</p>}
      <ul className="m-0 list-none space-y-4 p-0">
        {groups.map((g) => (
          <li key={g.userId} className="space-y-3 rounded-3xl border border-jw-line p-4">
            <h2 className="m-0 text-xl font-bold">
              👤 {g.name} <span className="text-sm font-normal text-jw-muted">· {g.videos.length} {g.videos.length === 1 ? "فيديو" : "فيديوهات"}</span>
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.videos.map((v) => (
                <VideoCard key={v.id} v={v}>
                  <PlacePicker v={v} />
                </VideoCard>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
