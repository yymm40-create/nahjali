import { notFound } from "next/navigation";
import { Marhey } from "next/font/google";
import ZaynabStudio from "@/components/jawad/zaynab/ZaynabStudio";
import { requireJawadUser } from "@/lib/jawad/server/access";
import { ZAYNAB_BASE } from "@config/jawad/zaynab";
import "./zaynab.css";

// the joyful letters the greeting is written in over the picture (drawn by the page itself, never by the image model)
const joyful = Marhey({ subsets: ["arabic"], weight: ["400", "700"], preload: false, display: "swap" });

export const dynamic = "force-dynamic";
// unlisted: no card on the bar, not in any list, not for search engines — it opens only from its own address
export const metadata = { title: "في حضرة السيدة زينب عليها السلام", robots: { index: false, follow: false } };

export default async function ZaynabPage() {
  const { user, allowed } = await requireJawadUser(ZAYNAB_BASE);
  if (!allowed) notFound();
  return <div><ZaynabStudio userId={user.id} fontFamily={joyful.style.fontFamily} /></div>;
}
