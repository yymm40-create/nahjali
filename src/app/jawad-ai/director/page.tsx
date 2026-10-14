import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "جواد المخرج" };

export default function DirectorPage() {
  redirect("/jawad-ai/images?director=1");
}
