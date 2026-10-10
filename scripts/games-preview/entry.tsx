// The games maker drawn in a plain browser page (its API answered by run.mjs): the conversation with its two ways, the
// «اصنع اللعبة» sheet and the games' cards (?view=chat), and a built game's play page (?view=play).
import { createRoot } from "react-dom/client";
import GamesChat from "@/components/jawad/games/GamesChat";
import PlayFrame from "@/components/jawad/games/PlayFrame";
import "@/app/jawad-ai/games/games.css";
import "@/app/play/[id]/play.css";

const view = new URLSearchParams(location.search).get("view");
createRoot(document.getElementById("root")!).render(
  view === "play" ? <PlayFrame id="11111111-1111-1111-1111-111111111111" title="قفزة الصحراء" src="/api/games/play/11111111-1111-1111-1111-111111111111?v=1" makeHref="/jawad-ai/games" /> : <GamesChat name="صانع الألعاب الذكي" persona="قنبر" loginHref={null} />,
);
