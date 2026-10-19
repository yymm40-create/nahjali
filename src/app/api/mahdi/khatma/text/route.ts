import { NextResponse } from "next/server";
import { isDivision, portionCount, portionSummary, portionTitle } from "@/lib/mahdi/khatma/portions";
import { portionText, QURAN_SOURCE } from "@/lib/mahdi/khatma/text";

/**
 * The words of one portion of the Quran: `?d=juz|hizb|half|quarter&n=…`. The same for everyone and never changing, so
 * it is cached everywhere; nothing about the reader is in it.
 */
export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const d = q.get("d");
  const n = Number(q.get("n"));
  if (!isDivision(d) || !Number.isInteger(n) || n < 1 || n > portionCount(d)) return NextResponse.json({ error: "غير صالح" }, { status: 400 });
  const { range } = portionSummary(d, n);
  return NextResponse.json(
    { title: portionTitle(d, n), range, ...portionText(d, n), source: QURAN_SOURCE },
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400" } },
  );
}
