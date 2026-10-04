import SheetsView from "@/app/film/_views/Sheets";

export const metadata = { title: "صانع الشيت" };
export const dynamic = "force-dynamic";

export default async function JawadFilmSheets({ params }: PageProps<"/jawad-ai/film/[id]/sheets">) {
  return <SheetsView id={(await params).id} base="/jawad-ai/film" />;
}
