import type { Metadata } from "next";
import TodayView from "@/components/mahdi/health/TodayView";

export const metadata: Metadata = { title: "الصحة العلوية" };

/** «الصحة العلوية»: today's workout and food tracker (or the welcome before a plan exists). */
export default function HealthPage() {
  return <TodayView />;
}
