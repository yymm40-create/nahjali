"use client";

// «الصحة العلوية» inside the app's own frame (the plan «واجهة لأجل المهدي الجديدة», phase 7): the same top bar with
// «رجوع» and the title, the same five destinations with «عاداتي» lit, and the person's own design. Its four views sit in
// one row on top of their pages (no second bar at the bottom), the doctor's note stays above every page, and
// عباس's chat is one bubble on the side. Everything shares one HealthProvider (the plan, the setup, the tracker).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HEALTH_VIEWS, healthViewOf } from "@/lib/mahdi/health/route";
import CoachChat from "./CoachChat";
import HealthProvider, { useHealth } from "./HealthProvider";
import "./health.css";

function Views({ path }: { path: string }) {
  const on = healthViewOf(path);
  if (!on) return null;
  return (
    <nav className="gym-views" aria-label="أقسام الصحة العلوية">
      {HEALTH_VIEWS.map((v) => (
        <Link key={v.href} href={v.href} scroll={false} aria-current={v === on ? "page" : undefined}>
          {v.label}
        </Link>
      ))}
    </nav>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  const { loaded } = useHealth();
  return (
    <div className="gym space-y-4" dir="rtl">
      <Views path={path} />
      <p className="gym-doctor" role="note">
        <b>عندك مشاكل صحية؟</b> ارجع لطبيبك للتأكد قبل ما تبدأ. وتذكّر: الذكاء الاصطناعي قد يخطئ.
      </p>
      {loaded ? (
        children
      ) : (
        <div className="space-y-3" aria-busy="true" aria-label="لحظة">
          <div className="gym-skeleton h-28" />
          <div className="gym-skeleton h-20" />
          <div className="gym-skeleton h-20" />
        </div>
      )}
      {loaded && <CoachChat />}
    </div>
  );
}

export default function HealthFrame({ children }: { children: React.ReactNode }) {
  return (
    <HealthProvider>
      <Frame>{children}</Frame>
    </HealthProvider>
  );
}
