"use client";

// The frame of «الصحة العلوية»: a gym of its own inside «لأجل المهدي» — a dark iron header with عباس, the doctor's note,
// the page, a tab bar at the bottom (اليوم · خطتي · التقدم · تعلّم), عباس's chat on the side, and the way back.

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "../BrandLogo";
import Toasts from "@/components/mahdi/Toasts";
import CoachChat from "./CoachChat";
import { useHealth } from "./HealthProvider";
import "./health.css";

const TABS = [
  { href: "/mahdi/health", icon: "🔥", label: "اليوم", match: (p: string) => p === "/mahdi/health" },
  { href: "/mahdi/health/plan", icon: "📋", label: "خطتي", match: (p: string) => /\/(plan|habits|setup)/.test(p) },
  { href: "/mahdi/health/progress", icon: "📈", label: "التقدم", match: (p: string) => p.includes("/progress") },
  { href: "/mahdi/health/learn", icon: "🧠", label: "تعلّم", match: (p: string) => p.includes("/learn") || p.includes("/research") },
];

export default function GymShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  const { loaded } = useHealth();
  return (
    <div className="gym-app" dir="rtl">
      <header className="gym-top">
        <Link href="/mahdi" className="gym-back" aria-label="رجوع إلى لأجل المهدي">
          → لأجل المهدي
        </Link>
        <Link href="/mahdi/health" className="gym-brand">
          <BrandLogo size={52} />
          <span>
            الصحة <em>العلوية</em>
          </span>
        </Link>
      </header>
      <main className="gym gym-main space-y-4" id="main">
        <p className="gym-doctor" role="note">
          🩺 <b>عندك مشاكل صحية؟</b> ارجع لطبيبك للتأكد قبل ما تبدأ. وتذكّر: الذكاء الاصطناعي قد يخطئ.
        </p>
        {loaded ? children : <p className="gym-dim py-10 text-center">لحظة… 🏋️</p>}
      </main>
      <nav className="gym-tabs" aria-label="الصحة العلوية">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={t.match(path) ? "page" : undefined}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </nav>
      {loaded && <CoachChat />}
      <Toasts />
    </div>
  );
}
