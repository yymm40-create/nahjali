import MonthReport from "./MonthReport";

export default async function MonthPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { m } = await searchParams;
  return <MonthReport month={typeof m === "string" ? m : undefined} />;
}
