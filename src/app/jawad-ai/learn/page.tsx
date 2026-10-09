import type { Metadata } from "next";
import Link from "next/link";
import { requireJawadUser } from "@/lib/jawad/server/access";
import { myCourses } from "@/lib/learn/server";
import { COURSE } from "@config/course";
import { LEARN } from "@config/learn";
import "@/components/learn/learn.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "دروسي", robots: { index: false } };

/** The student's place: the courses they may watch. */
export default async function LearnHome() {
  const { user } = await requireJawadUser(LEARN.base);
  const courses = await myCourses(user);
  return (
    <div className="ln-wrap" dir="rtl">
      <h1 className="text-2xl font-extrabold">📚 دروسي</h1>
      {courses.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {courses.map((c) => {
            const lessons = c.days.flatMap((d) => d.lessons).filter((l) => l.status === "ready").length;
            return (
              <Link key={c.id} href={`${LEARN.base}/${c.id}`} className="ln-card block">
                <h2 className="font-extrabold">{c.title}</h2>
                {c.summary && <p className="ln-dim mt-1">{c.summary}</p>}
                <p className="ln-dim mt-2">{c.days.length} أيام · {lessons} فيديو{!c.published && " · (مخفية عن الطلاب)"}</p>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="ln-card space-y-2">
          <p className="font-bold">ما عندك دورات مفتوحة لين الحين.</p>
          <p className="ln-dim">إذا حوّلت وأكّد المالك اشتراكك، تظهر دورتك هنا تلقائيًا.</p>
          <Link href={COURSE.base} className="btn btn-primary inline-block">صفحة {COURSE.name}</Link>
        </div>
      )}
    </div>
  );
}
