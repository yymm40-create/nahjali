import CalendarView from "./CalendarView";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { m } = await searchParams;
  return <CalendarView month={typeof m === "string" ? m : undefined} />;
}
