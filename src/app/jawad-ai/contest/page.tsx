import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isJudge, myVideos } from "@/lib/contest/server";
import { MyVideos } from "./ContestClient";

// «مسابقة الفيلم السينمائي»: reached ONLY by its link (nothing on the site points here). The person signs in with their
// account and sees the videos they made in the cinematic film maker; «أضف إلى المنصة» enters one in the contest.
export const metadata: Metadata = { title: "مسابقة الفيلم السينمائي", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ContestPage() {
  const user = await requireUser("/jawad-ai/contest");
  const [videos, judge] = await Promise.all([myVideos(user.id), isJudge(user.email)]);
  const n = videos.filter((v) => v.entered).length;
  return (
    <main dir="rtl" className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <header className="space-y-1">
        <h1 className="m-0 text-3xl font-extrabold">🏆 مسابقة الفيلم السينمائي</h1>
        <p className="m-0 text-jw-muted">هذي الفيديوهات اللي صنعتها في «صانع الفيلم السينمائي». اختر اللي تبي تشارك فيه واضغط «➕ أضف إلى المنصة» — يوصل للجنة على طول. تقدر تسحبه متى ما تبي.</p>
        <p className="m-0 text-sm font-bold">{n ? `✓ مشارك بـ ${n} ${n === 1 ? "فيديو" : "فيديوهات"}` : "ما أضفت شي للحين."}</p>
        {judge && (
          <Link href="/jawad-ai/contest/judge" className="jw-btn inline-flex !min-h-10">
            ⚖️ صفحة التحكيم
          </Link>
        )}
      </header>
      {videos.length ? (
        <MyVideos videos={videos} />
      ) : (
        <p className="rounded-2xl border border-jw-line p-4 text-jw-muted">
          ما عندك فيديوهات جاهزة في صانع الفيلم السينمائي للحين. <Link href="/film" className="underline">ابدأ مشهدك</Link> وارجع هنا لما يطلع الفيديو.
        </p>
      )}
    </main>
  );
}
