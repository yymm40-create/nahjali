import type { Metadata } from "next";
import { LearnView } from "@/components/mahdi/health/LearnView";

export const metadata: Metadata = { title: "الصحة العلوية: تعلّم" };

export default function Page() {
  return <LearnView />;
}
