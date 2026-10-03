"use client";

import { useMemo } from "react";
import { bookProgress, readingSummary } from "@/lib/mahdi/engine";
import { useMahdi } from "./Provider";

/** Reading data of the signed-in user, with progress per book and the time totals. */
export function useReading() {
  const { state } = useMahdi();
  const { reading, profile } = state.snap;
  const today = state.today;
  return useMemo(() => {
    const byBook = new Map<string, typeof reading.sessions>();
    for (const s of reading.sessions) (byBook.get(s.bookId) ?? byBook.set(s.bookId, []).get(s.bookId)!).push(s);
    const progress = (bookId: string) => {
      const entry = reading.library.find((e) => e.book.id === bookId);
      return bookProgress(byBook.get(bookId) ?? [], entry?.book.pages ?? 0);
    };
    return {
      reading,
      today,
      userId: profile.userId,
      summary: readingSummary(reading.sessions, today, profile.weekStart),
      current: reading.library.filter((e) => e.state === "reading"),
      progress,
      sessionsOf: (bookId: string) => byBook.get(bookId) ?? [],
    };
  }, [reading, today, profile.userId, profile.weekStart]);
}
