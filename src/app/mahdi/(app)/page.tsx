import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HomeSlider from "@/components/mahdi/HomeSlider";

export const dynamic = "force-dynamic";

export default async function MahdiHome() {
  // arrived from a group's join link and now signed in: to the join page
  const jar = await cookies();
  if (jar.has("mahdi_gjoin")) redirect("/mahdi/groups/join");
  // arrived from a «مسابقة الثبات» link and now signed in: to the contest
  if (jar.has("mahdi_cjoin")) redirect("/api/mahdi/contests/go?resume=1");
  return <HomeSlider />;
}
