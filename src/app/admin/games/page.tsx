import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@config/site";
import { GAMES } from "@config/games";
import GamesAdmin from "./GamesAdmin";

export const metadata = { title: "صانع الألعاب الذكي | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** Owner only: «قنبر»'s template, the games library, and the tests. */
export default async function GamesAdminPage() {
  const user = await requireUser("/admin/games");
  if (!isAdmin(user.email)) notFound();
  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">🎮 {GAMES.name}</h1>
        <Link href={GAMES.base} className="chip">افتح القسم ↗</Link>
      </div>
      <GamesAdmin />
    </div>
  );
}
