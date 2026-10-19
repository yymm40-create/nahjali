import type { Metadata } from "next";
import Link from "next/link";
import { requireJawadUser } from "@/lib/jawad/server/access";
import { myCourses } from "@/lib/learn/server";
import { COURSE } from "@config/course";
import { LEARN } from "@config/learn";
import "@/components/learn/learn.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "دوراتي", robots: { index: false } };

/** The student's place: the courses they may watch. */
export default async function LearnHome() {
  const { user } = await requireJawadUser(LEARN.base);
  const courses = await myCourses(user);
  return (
    <div className="ln-page" dir="rtl">
      <div className="ln-wrap">
        <div>
          <span className="ln-kicker">دوراتي · {String(courses.length).padStart(2, "0")}</span>
          <h1 className="ln-title">دوراتك</h1>
        </div>
        {courses.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => {
              const lessons = c.days.flatMap((d) => d.lessons).filter((l) => l.status === "ready").length;
              return (
                <Link key={c.id} href={`${LEARN.base}/${c.id}`} className="ln-card">
                  <div className="ln-art" aria-hidden>🎬</div>
                  <h2 className="text-lg font-extrabold">{c.title}</h2>
                  {c.summary && <p className="ln-dim">{c.summary}</p>}
                  <p className="ln-dim">{c.days.length} أيام · {lessons} فيديو{!c.published && " · (مخفية عن الطلاب)"}</p>
                  <span className="ln-go">ابدأ المشاهدة ←</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="ln-card space-y-2">
            <p className="font-bold">ما عندك دورات مفتوحة لين الحين.</p>
            <p className="ln-dim">إذا حوّلت وأكّد المالك اشتراكك، تظهر دورتك هنا مباشرة.</p>
          </div>
        )}
        <Link href={COURSE.base} className="ln-btn dark justify-self-start">🛒 تصفّح الدورات واشترِ</Link>
      </div>
    </div>
  );
}
