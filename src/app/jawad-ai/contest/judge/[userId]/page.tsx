import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isJudge, participantFile } from "@/lib/contest/server";
import { VideoCard } from "../../ContestClient";

// «📁 ملف المشارك»: only their character sheets and their videos (the ones in the contest marked).
export const metadata: Metadata = { title: "ملف مشارك", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ParticipantPage({ params }: { params: Promise<{ userId: string }> }) {
  const user = await requireUser("/jawad-ai/contest/judge");
  if (!(await isJudge(user.email))) notFound();
  const { userId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) notFound();
  const f = await participantFile(userId);
  return (
    <main dir="rtl" className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <Link href="/jawad-ai/contest/judge" className="text-sm text-jw-muted">→ ملفات المشاركين</Link>
        <h1 className="m-0 text-3xl font-extrabold">📁 {f.name}</h1>
        <p className="m-0 text-sm text-jw-muted" dir="ltr">{f.email}</p>
      </header>
      <section className="space-y-2">
        <h2 className="m-0 text-xl font-bold">🧍 الكاركتر شيت ({f.sheets.length})</h2>
        {!f.sheets.length && <p className="text-jw-muted">ما فيه شيتات.</p>}
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {f.sheets.map((s) => (
            <li key={s.id} className="overflow-hidden rounded-2xl border border-jw-line bg-jw-surface">
              {s.url && (
                <a href={s.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt={s.title} className="aspect-square w-full object-cover" />
                </a>
              )}
              <p className="m-0 p-2 text-xs">{s.projectTitle} · {s.title}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="m-0 text-xl font-bold">🎬 الفيديوهات ({f.videos.length})</h2>
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {f.videos.map((v) => (
            <li key={v.id}>
              <VideoCard v={v}>{v.entered && <p className="m-0 text-xs font-bold text-jw-ok">✓ مضاف للمسابقة</p>}</VideoCard>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
