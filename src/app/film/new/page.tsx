import { redirect } from "next/navigation";
import { requireFilmUser } from "@/lib/film/access";
import NewProject from "./NewProject";

export const metadata = { title: "مشروع فيلم جديد | نهج علي" };

export default async function NewFilmPage() {
  const { allowed } = await requireFilmUser("/film/new");
  if (!allowed) redirect("/film");
  return <NewProject />;
}
