import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Riyal from "@/components/Riyal";
import { loadTree } from "@/lib/learn/server";
import { COURSE } from "@config/course";
import "./course.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الدورات", description: "دورات الجواد الذكي المسجلة." };

/** The courses on sale, each with its own page and price. One course: straight to its page. */
export default async function CoursesPage() {
  const list = (await loadTree({ onlyPublished: true }).catch(() => [])).filter((c) => c.priceSar);
  if (list.length === 1) redirect(`${COURSE.base}/${list[0].id}`);
  return (
    <div className="cr" dir="rtl">
      <section className="cr-band">
        <div className="cr-in">
          <h1 className="cr-h">الدورات</h1>
          {list.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map((c) => (
                <li key={c.id}>
                  <Link href={`${COURSE.base}/${c.id}`} className="cr-btn block p-4">
                    <b className="block text-lg">{c.title}</b>
                    {c.summary && <span className="cr-mute block">{c.summary}</span>}
                    <Riyal halalas={(c.priceSar ?? 0) * 100} size={26} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cr-lead">ما فيه دورات معروضة للبيع الحين.</p>
          )}
        </div>
      </section>
    </div>
  );
}
