import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireJawadUser } from "@/lib/jawad/server/access";
import { myCourses } from "@/lib/learn/server";
import { LEARN } from "@config/learn";
import LearnCourse from "@/components/learn/LearnCourse";
import "@/components/learn/learn.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الدورة", robots: { index: false } };

/** One course: its days and videos, and the protected player. */
export default async function LearnCoursePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ l?: string }> }) {
  const { id } = await params;
  const { l } = await searchParams;
  const { user } = await requireJawadUser(`${LEARN.base}/${id}`);
  const course = (await myCourses(user)).find((c) => c.id === id);
  if (!course) notFound();
  return (
    <div className="ln-wrap" dir="rtl">
      <Link href={LEARN.base} className="ln-dim">→ دروسي</Link>
      <LearnCourse course={course} initial={l ?? null} />
    </div>
  );
}
