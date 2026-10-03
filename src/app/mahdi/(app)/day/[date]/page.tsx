import { notFound } from "next/navigation";
import DayView from "@/components/mahdi/DayView";
import { isISODate } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";

export const metadata = { title: t.common.previousDay };

/** Any earlier day, to log what was forgotten or correct it (future days open today instead). */
export default async function MahdiDay({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isISODate(date)) notFound();
  return <DayView date={date} />;
}
