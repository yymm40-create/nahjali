import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import ReviewWatch from "@/components/jawad/editor/ReviewWatch";
import { publicReview } from "@/lib/editor/review-server";
import { LINK_STATE_AR } from "@/lib/editor/review";

export const dynamic = "force-dynamic";

const review = cache((slug: string) => publicReview(slug).catch(() => null));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const r = await review((await params).slug);
  // a personal link: never listed by search engines
  return { title: r ? `مراجعة: ${r.title || "مونتاج"}` : "الرابط غير متاح", robots: { index: false, follow: false } };
}

/** «رابط مراجعة للعميل» (no sign-in): watch the video, comment on its moments, draw on the frame, say «موافق». */
export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await review(slug);
  if (!r) notFound();
  if (r.state !== "on") {
    return (
      <div className="mx-auto max-w-xl px-4 pb-16 pt-10">
        <div className="jw-panel space-y-2 p-6 text-center">
          <p className="m-0 text-3xl" aria-hidden>⏸️</p>
          <h1 className="m-0 text-lg font-semibold" dir="auto">{r.title || "مراجعة فيديو"}</h1>
          <p className="m-0 text-sm text-jw-muted">رابط المراجعة {LINK_STATE_AR[r.state]}. {r.state === "expired" ? "انتهت مدته؛ اطلب من صاحب الفيديو يمدّده." : "صاحب الفيديو وقّفه؛ اطلب منه يشغّله."}</p>
        </div>
      </div>
    );
  }
  return <ReviewWatch slug={slug} initial={JSON.parse(JSON.stringify(r))} />;
}
