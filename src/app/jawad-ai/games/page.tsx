import { notFound } from "next/navigation";
import GamesChat from "@/components/jawad/games/GamesChat";
import { gamesAllowed } from "@/lib/games/access";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { GAMES } from "@config/games";
import "./games.css";

export const dynamic = "force-dynamic";
export const metadata = { title: GAMES.name };

/** «صانع الألعاب الذكي»: a chat with «قنبر». The owner always; others only when the section is on and they hold «games». */
export default async function GamesPage() {
  const [{ user, owner }, rt] = await Promise.all([jawadSession(), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "games");
  if (!section) notFound();
  if (!user) return <GamesChat name={section.name} persona={GAMES.persona} loginHref={jawadLogin(GAMES.base)} />;
  if (!owner && !(await gamesAllowed(user.email))) notFound();
  return <GamesChat name={section.name} persona={GAMES.persona} loginHref={null} />;
}
