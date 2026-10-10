// «الجواد الذكي» — the home of a signed-in person, in the front page's colours: a hero that greets them and asks what to make
// (QuickStart), their latest works, every section as a bright card, a line to the packages, and the ads. Mobile first.

import Link from "next/link";
import type { ReactNode } from "react";
import QuickStart, { type QuickSection } from "./QuickStart";
import type { LandingTool } from "./Landing";
import { CREDITS } from "@config/credits";
import "./landing.css";
import "./home.css";

export interface RecentWork {
  url: string;
  kind: "image" | "video" | "audio";
  href: string;
  label: string;
}

export default function Home({ first, owner, userId, sections, tools, recent, ads }: { first: string; owner: boolean; userId: string; sections: QuickSection[]; tools: LandingTool[]; recent: RecentWork[]; ads: ReactNode }) {
  const works = `/jawad-ai/${sections.find((s) => s.output)?.id ?? "images"}?tab=works`;
  return (
    <div className="ld hm" dir="rtl">
      <Link href={CREDITS.base} className="ld-promo">🎁 كل ما كبرت الباقة زاد رصيدك المجاني — <b>اشحن رصيدك</b></Link>

      <header className="ld-hero hm-hero">
        <div className="ld-in">
          <span className="ld-eyebrow hm-hi"><i aria-hidden />هلا{first ? ` ${first}` : ""} 👋 حيّاك في الجواد الذكي</span>
          <h1>
            وش <span className="ld-grad">نصنع اليوم</span>؟
          </h1>
          <QuickStart hero sections={sections} userId={userId} loginHref={null} />
          <nav className="hm-links" aria-label="روابط سريعة">
            <Link href={CREDITS.base} className="hot">💳 اشحن رصيدك</Link>
            <Link href={works}>🗂️ أعمالي</Link>
            {owner && <Link href="/admin">⚙️ لوحة التحكم</Link>}
          </nav>
        </div>
      </header>

      {recent.length > 0 && (
        <section className="hm-sec" aria-labelledby="jw-recent">
          <div className="ld-in">
            <div className="hm-head">
              <h2 id="jw-recent">آخر أعمالك</h2>
              <Link href={works}>كل أعمالي ←</Link>
            </div>
            <div className="hm-works">
              {recent.map((t, i) => (
                <Link key={i} href={t.href} className="hm-work" title={t.label}>
                  <span>
                    {t.kind === "video" ? (
                      <video src={`${t.url}#t=0.1`} muted playsInline preload="metadata" />
                    ) : t.kind === "audio" ? (
                      <span className="hm-aud" aria-hidden>🎧</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                      <img src={t.url} alt="" loading="lazy" />
                    )}
                    {t.kind === "video" && <span className="hm-play" aria-hidden>▶</span>}
                  </span>
                  <b dir="auto">{t.label}</b>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="hm-sec" aria-labelledby="jw-sections">
        <div className="ld-in">
          <div className="hm-head">
            <h2 id="jw-sections">كل أدواتك</h2>
          </div>
          <ul className="ld-tools">
            {tools.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="ld-tool" style={{ ["--t" as string]: t.tint }}>
                  <span className="ld-ticon" aria-hidden>{t.icon}</span>
                  <b>{t.name}</b>
                  <span>{t.line}</span>
                  <em>افتح ←</em>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="hm-sec">
        <div className="ld-in">
          <div className="hm-packs">
            <div>
              <b>رصيدك يخلص؟ اشحن بباقة 🎁</b>
              <span>تحويل بنكي سهل، وكل ما كبرت الباقة زاد رصيدك المجاني.</span>
            </div>
            <Link href={CREDITS.base} className="ld-cta">شوف الباقات ←</Link>
          </div>
        </div>
      </section>

      {ads && (
        <section className="hm-sec hm-ads" aria-label="إعلانات">
          <div className="ld-in">{ads}</div>
        </section>
      )}
      {!ads && owner && (
        <p className="hm-sec" style={{ textAlign: "center", fontSize: 13, color: "var(--ld-mute)" }}>
          لا توجد إعلانات منشورة. <Link href="/jawad-ai/admin/ads" style={{ color: "var(--ld-gold)" }}>أضف الإعلانات</Link>
        </p>
      )}
    </div>
  );
}
