import WeekReport from "./WeekReport";

export default async function WeekPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { start } = await searchParams;
  return <WeekReport start={typeof start === "string" ? start : undefined} />;
}
