import type { Metadata } from "next";
import HealthApp from "@/components/mahdi/health/HealthApp";

export const metadata: Metadata = { title: "الصحة العلوية" };

/** «الصحة العلوية»: the gym and nutrition plan, built from the international recommendations, into the habits. */
export default function HealthPage() {
  return <HealthApp />;
}
