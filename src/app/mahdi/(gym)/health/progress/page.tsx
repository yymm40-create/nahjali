import type { Metadata } from "next";
import { Suspense } from "react";
import ProgressView from "@/components/mahdi/health/ProgressView";

export const metadata: Metadata = { title: "الصحة العلوية: التقدم" };

export default function Page() {
  return (
    <Suspense>
      <ProgressView />
    </Suspense>
  );
}
