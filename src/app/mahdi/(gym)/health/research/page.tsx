import type { Metadata } from "next";
import Link from "next/link";
import { RESEARCH, SOURCES, sourceById } from "@config/mahdi/health-research";

export const metadata: Metadata = { title: "الصحة العلوية: البحث والمصادر" };

/** The research «الصحة العلوية» is built on: every recommendation with its source. */
export default function HealthResearchPage() {
  return (
    <div className="space-y-4">
      <section className="gym-hero space-y-2">
        <span className="gym-eyebrow">📚 البحث</span>
        <h1 className="gym-title">
          التوصيات <em>العالمية</em> في التمرين والتغذية
        </h1>
        <p className="gym-small">جمعنا لك اللي توصي فيه منظمة الصحة العالمية، والكلية الأمريكية للطب الرياضي (تحديث 2026)، والكلية الأمريكية لأطباء النساء والولادة، والجمعية الدولية للتغذية الرياضية، والإرشادات الغذائية 2025–2030، ومعهد الطب الأمريكي، والمجلات الطبية — للرجل والمرأة، الحامل وغير الحامل، والمرضعة وبعد الولادة. خطتك في «الصحة العلوية» تنحسب من هذي الأرقام.</p>
        <Link href="/mahdi/health" className="gym-btn sm">→ ارجع لخطتي</Link>
      </section>

      <nav className="gym-chips" aria-label="الأقسام">
        {RESEARCH.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="gym-chip">
            {s.icon} {s.title.split(":")[0]}
          </a>
        ))}
      </nav>

      {RESEARCH.map((s) => (
        <section key={s.id} id={s.id} className="gym-card space-y-3 scroll-mt-20">
          <div>
            <h2 className="text-lg font-black">
              {s.icon} {s.title}
            </h2>
            <span className="gym-small">لمين: {s.for}</span>
          </div>
          <ul className="gym-list text-sm">
            {s.points.map((pt) => (
              <li key={pt.text}>
                <span>
                  {pt.text}{" "}
                  <span className="gym-ref">
                    [
                    {pt.src.map((id, i) => (
                      <span key={id}>
                        {i > 0 && "، "}
                        <a href={`#src-${id}`}>{sourceById(id)?.org.split(" (")[0] ?? id} {sourceById(id)?.year}</a>
                      </span>
                    ))}
                    ]
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="gym-card space-y-2">
        <h2 className="text-lg font-black">🔗 المصادر</h2>
        <ol className="space-y-2 text-sm">
          {SOURCES.map((s, i) => (
            <li key={s.id} id={`src-${s.id}`} className="scroll-mt-20">
              <b>{i + 1}.</b> {s.org} ({s.year}). <span dir="ltr" className="inline-block">{s.title}</span>. <span className="gym-dim">{s.where}</span>.{" "}
              <a href={s.url} target="_blank" rel="noreferrer" className="gym-ref underline">
                الرابط
              </a>
            </li>
          ))}
        </ol>
      </section>
      <p className="gym-small text-center">توصيات عامة للأصحاء، ما تغني عن الطبيب.</p>
    </div>
  );
}
