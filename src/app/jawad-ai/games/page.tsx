import { notFound } from "next/navigation";
import GamesChat from "@/components/jawad/games/GamesChat";
import { gamesAllowed } from "@/lib/games/access";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { GAMES } from "@config/games";
import "./games.css";

export const dynamic = "force-dynamic";
export const metadata = { title: GAMES.name, description: "صانع الألعاب الذكي: صف لعبتك بالعربي، و«قنبر» يصممها ويبنيها وتلعبها من الجوال برابط تشاركه." };

/** «صانع الألعاب الذكي»: a chat with «قنبر». The owner always; others only when the section is on and they hold «games». */
export default async function GamesPage() {
  const [{ user, owner }, rt] = await Promise.all([jawadSession(), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "games");
  if (!section) notFound();
  // the page's one heading for search engines and screen readers (the chat draws its own look)
  if (!user)
    return (
      <>
        <h1 className="sr-only">صانع الألعاب الذكي: صمّم لعبتك والعبها برابط</h1>
        <GamesChat name={section.name} persona={GAMES.persona} loginHref={jawadLogin(GAMES.base)} />
      </>
    );
  if (!owner && !(await gamesAllowed(user.email))) notFound();
  return <GamesChat name={section.name} persona={GAMES.persona} loginHref={null} />;
}
