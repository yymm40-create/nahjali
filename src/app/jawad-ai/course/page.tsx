import type { Metadata } from "next";
import Link from "next/link";
import Riyal from "@/components/Riyal";
import { jawadSession } from "@/lib/jawad/server/access";
import { loadTree, myCourses } from "@/lib/learn/server";
import { COURSE } from "@config/course";
import { LEARN } from "@config/learn";
import "./course.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الدورات", description: "دورات الجواد الذكي المسجلة: اختر دورتك واشترك." };

const ICONS = ["🎬", "🎨", "🎙️", "🧠", "📚", "⚡"];
const two = (n: number) => String(n).padStart(2, "0");

/** «الدورات»: every course on sale, as cards (a course already bought says so and opens in «دوراتي»). */
export default async function CoursesPage() {
  const [{ user }, list] = await Promise.all([jawadSession(), loadTree({ onlyPublished: true }).catch(() => [])]);
  const sale = list.filter((c) => c.priceSar);
  const owned = new Set(user ? (await myCourses(user).catch(() => [])).map((c) => c.id) : []);
  return (
    <div className="cr" dir="rtl">
      <header className="cr-hero">
        <div className="cr-in">
          <span className="cr-kicker cr-reveal">الدورات · {two(sale.length)}</span>
          <h1 className="cr-reveal" style={{ ["--i" as string]: 1 }}>تعلّم تصنع بالذكاء الاصطناعي <em>خطوة بخطوة</em></h1>
          <p className="cr-sub cr-reveal" style={{ ["--i" as string]: 2 }}>دورات مسجلة تشوفها متى ما تبي. اختر الدورة، ادفع بتحويل بنكي، وتنفتح لك في «دوراتي» بعد التأكيد.</p>
          {user && owned.size > 0 && <Link href={LEARN.base} className="cr-btn cr-reveal" style={{ ["--i" as string]: 3 }}>📚 افتح دوراتي ({owned.size})</Link>}
        </div>
      </header>
      <section className="cr-band" style={{ paddingTop: 0 }}>
        <div className="cr-in cr-wide">
          {sale.length ? (
            <ul className="cr-shop-grid">
              {sale.map((c, i) => {
                const mine = owned.has(c.id);
                const lessons = c.days.flatMap((d) => d.lessons).filter((l) => l.status === "ready").length;
                return (
                  <li key={c.id} className="cr-reveal" style={{ ["--i" as string]: i + 3 }}>
                    <Link href={mine ? `${LEARN.base}/${c.id}` : `${COURSE.base}/${c.id}`} className="cr-course">
                      <div className="cr-course-art">
                        <span className="cr-kicker">دورة · {two(i + 1)} / {two(sale.length)}</span>
                        <b aria-hidden>{ICONS[i % ICONS.length]}</b>
                      </div>
                      {mine && <span className="cr-owned">✓ عندك</span>}
                      <h2>{c.title}</h2>
                      {c.summary && <p>{c.summary}</p>}
                      <p className="cr-mute">{c.days.length} أيام{lessons ? ` · ${lessons} فيديو` : ""}</p>
                      <div className="cr-course-foot">
                        <Riyal halalas={(c.priceSar ?? 0) * 100} was={c.wasSar && c.wasSar > (c.priceSar ?? 0) ? c.wasSar * 100 : null} size={22} className="cr-cn" />
                        <span className="cr-course-go">{mine ? "افتحها" : "التفاصيل والاشتراك"} ←</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="cr-lead" style={{ textAlign: "center" }}>ما فيه دورات معروضة للبيع الحين. ترقّب قريبًا.</p>
          )}
        </div>
      </section>
    </div>
  );
}
