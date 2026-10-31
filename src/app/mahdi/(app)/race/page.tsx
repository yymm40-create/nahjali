"use client";

import { Suspense } from "react";
import RaceHome from "@/components/mahdi/race/RaceHome";

/** «المسابقة»: join a day's team race with a code and a selfie, or (the site's owners) start one. */
export default function RacePage() {
  return (
    <div className="space-y-6">
      <h1 className="m-display text-3xl">المسابقة</h1>
      <Suspense>
        <RaceHome />
      </Suspense>
    </div>
  );
}
