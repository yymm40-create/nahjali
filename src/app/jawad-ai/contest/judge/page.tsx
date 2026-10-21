import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@config/site";
import { isJudge, judges, participants } from "@/lib/contest/server";
import { Judges } from "../ContestClient";

// «⚖️ التحكيم»: the owner and the judges the owner added. A file for every participant (their sheets and videos), and
// the page of every entry grouped by person where the places are picked.
export const metadata: Metadata = { title: "تحكيم المسابقة", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso).toLocaleString("ar", { timeZone: "Asia/Riyadh", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default async function JudgePage() {
  const user = await requireUser("/jawad-ai/contest/judge");
  if (!(await isJudge(user.email))) notFound();
  const owner = isAdmin(user.email);
  const [{ missing, people }, list] = await Promise.all([participants(), owner ? judges() : Promise.resolve([])]);
  return (
    <main dir="rtl" className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <header className="space-y-2">
        <Link href="/jawad-ai/contest" className="text-sm text-jw-muted">→ صفحة المسابقة</Link>
        <h1 className="m-0 text-3xl font-extrabold">⚖️ تحكيم مسابقة الفيلم السينمائي</h1>
        <Link href="/jawad-ai/contest/judge/entries" className="jw-btn jw-btn-primary inline-flex !min-h-11">
          🎞️ كل الفيديوهات المضافة · اختر المراكز
        </Link>
      </header>
      {missing && <p className="rounded-xl border border-red-500/40 p-3 text-red-400">جداول المسابقة ما انضافت. شغّل الملف <span dir="ltr">supabase/migrations/0088_film_contest.sql</span> في Supabase.</p>}
      {owner && <Judges emails={list} />}
      <section className="space-y-2">
        <h2 className="m-0 text-xl font-bold">📁 ملفات المشاركين ({people.length})</h2>
        {!people.length && <p className="text-jw-muted">ما أحد أضاف فيديو للحين.</p>}
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => (
            <li key={p.userId}>
              <Link href={`/jawad-ai/contest/judge/${p.userId}`} className="block rounded-2xl border border-jw-line bg-jw-surface p-4 hover:border-jw-accent">
                <p className="m-0 text-lg font-bold">📁 {p.name}</p>
                <p className="m-0 text-xs text-jw-muted" dir="ltr">{p.email}</p>
                <p className="m-0 mt-1 text-sm">{p.entries} {p.entries === 1 ? "فيديو مضاف" : "فيديوهات مضافة"} · من {fmt(p.since)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
