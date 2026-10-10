import { redirect } from "next/navigation";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { JAWAD } from "@config/jawad/brand";
import MemoryPage from "./MemoryPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "ذاكرتي" };

/** «ذاكرتي»: what the robots remember about me — see it, edit it, clear it, turn it on or off. */
export default async function Page() {
  const { user } = await jawadSession();
  if (!user) redirect(jawadLogin(`${JAWAD.base}/memory`));
  return <MemoryPage />;
}
