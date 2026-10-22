import { redirect } from "next/navigation";
import { requireFilmUser } from "@/lib/film/access";
import NewProject from "../new/NewProject";

/** «?map=1» (the link of «خريطة فيلم الدقيقة») survives the sign-in and opens a short scene on the story map. */
export default async function NewFilmView({ base, map = false }: { base: string; map?: boolean }) {
  const { allowed } = await requireFilmUser(`${base}/new${map ? "?map=1" : ""}`);
  if (!allowed) redirect(base);
  return <NewProject />;
}
