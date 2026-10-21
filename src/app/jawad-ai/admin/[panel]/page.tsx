import { notFound } from "next/navigation";
import Stats from "@/app/admin/stats/page";
import Spend from "@/app/admin/spend/page";
import Profit from "@/app/admin/profit/page";
import Access from "@/app/admin/access/page";
import Limits from "@/app/admin/limits/page";
import Pricing from "@/app/admin/pricing/page";
import Islamic from "@/app/admin/islamic/page";
import Games from "@/app/admin/games/page";
import Content from "@/app/admin/content/page";
import Designer from "@/app/admin/designer/page";
import Photo from "@/app/admin/photo/page";
import Kharq from "@/app/admin/kharq/page";
import Credits from "@/app/admin/credits/page";
import Share from "@/app/admin/share/page";
import Course from "@/app/admin/course/page";
import Learn from "@/app/admin/learn/page";
import Storage from "@/app/admin/storage/page";
import Booklet from "@/app/admin/booklet/page";

export default async function UnifiedAdminPanel({ params, searchParams }: { params: Promise<{ panel: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { panel } = await params;
  const query = await searchParams;
  const r = typeof query.r === "string" ? query.r : undefined;
  switch (panel) {
    case "stats": return <Stats searchParams={Promise.resolve({ r })} />;
    case "spend": return <Spend searchParams={Promise.resolve({ r })} />;
    case "profit": return <Profit searchParams={Promise.resolve({ r })} />;
    case "access": return <Access />;
    case "limits": return <Limits />;
    case "pricing": return <Pricing />;
    case "islamic": return <Islamic />;
    case "games": return <Games />;
    case "content": return <Content />;
    case "designer": return <Designer />;
    case "photo": return <Photo />;
    case "kharq": return <Kharq />;
    case "credits": return <Credits />;
    case "share": return <Share />;
    case "course": return <Course />;
    case "learn": return <Learn />;
    case "storage": return <Storage />;
    case "booklet": return <Booklet />;
    default: notFound();
  }
}
