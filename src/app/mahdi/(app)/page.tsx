import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HomeSlider from "@/components/mahdi/HomeSlider";

export const dynamic = "force-dynamic";

export default async function MahdiHome() {
  // arrived from a group's join link and now signed in: to the join page
  if ((await cookies()).has("mahdi_gjoin")) redirect("/mahdi/groups/join");
  return <HomeSlider />;
}
