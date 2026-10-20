"use client";

import Link from "next/link";
import Icon from "@/components/mahdi/Icon";
import FreeReading from "@/components/mahdi/khatma/FreeReading";
import { TimeHabitLink, useReaderState } from "@/components/mahdi/khatma/ReaderClock";
import { minutesText, wholeMinutes } from "@/lib/mahdi/khatma/reader";

/** «قراءة حرة»: where to open the Quran with no khatma, and the habit the reading time fills. */
export default function FreeReadingPage() {
  const { state, setHabit } = useReaderState();
  return (
    <div className="space-y-5">
      <Link href="/mahdi/khatma" className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> ختمتي
      </Link>
      <FreeReading />
      {state && (
        <section className="m-card space-y-2 p-4">
          <h2 className="font-semibold">⏱ وقت القراءة</h2>
          <p className="m-num text-sm m-muted">قرأت اليوم {minutesText(wholeMinutes(state.todaySeconds))}.</p>
          <TimeHabitLink reader={state} onChange={(id) => void setHabit(id)} />
        </section>
      )}
    </div>
  );
}
