import { redirect } from "next/navigation";
import { requireFilmUser } from "@/lib/film/access";
import NewProject from "../new/NewProject";

export default async function NewFilmView({ base }: { base: string }) {
  const { allowed } = await requireFilmUser(`${base}/new`);
  if (!allowed) redirect(base);
  return <NewProject />;
}
