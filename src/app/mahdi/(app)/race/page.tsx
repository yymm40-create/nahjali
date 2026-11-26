"use client";

import { Suspense } from "react";
import RaceHome from "@/components/mahdi/race/RaceHome";
import PageHead from "@/components/mahdi/social/PageHead";
import { Skeleton } from "@/components/mahdi/social/States";

/** «المسابقة»: join a day's team race with a code and a selfie, or (the site's owners) start one. */
export default function RacePage() {
  return (
    <div className="space-y-6">
      <PageHead title="المسابقة" sub="ادخل سباق اليوم بالكود وسلفي، والقائد يدير الفريقين والألعاب." />
      <Suspense fallback={<Skeleton kind="cards" count={2} />}>
        <RaceHome />
      </Suspense>
    </div>
  );
}
