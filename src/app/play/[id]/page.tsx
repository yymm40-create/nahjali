import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import PlayFrame from "@/components/jawad/games/PlayFrame";
import { publicGame } from "@/lib/games/build";
import { GAMES } from "@config/games";
import { pagePath } from "@config/games-build";
import "./play.css";

export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: "#0b0718", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover" };

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "aljawadai.app";
  return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const g = await publicGame(id).catch(() => null);
  if (!g) return { title: "لعبة | الجواد الذكي" };
  const title = `${g.title} 🎮 | الجواد الذكي`;
  const description = g.summary || "لعبة صنعها «صانع الألعاب الذكي» — اضغط وابدأ اللعب.";
  const image = g.cover ? `${await origin()}${g.cover}` : undefined;
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, type: "website", siteName: "الجواد الذكي", locale: "ar", ...(image ? { images: [{ url: image, width: 1200, height: 675, alt: g.title }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

/** A game «صانع الألعاب الذكي» built: full screen, for anyone with its link (no sign-in). */
export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await publicGame(id).catch(() => null);
  if (!g) notFound();
  if (!g.html) {
    return (
      <main className="pl-wait" dir="rtl">
        <div>
          <span aria-hidden>🎲</span>
          <h1>{g.title || "لعبة"}</h1>
          <p>اللعبة لسا تنبني… ارجع لها بعد دقايق.</p>
          <a href={GAMES.base}>اصنع لعبتك أنت ←</a>
        </div>
      </main>
    );
  }
  return <PlayFrame id={id} title={g.title} src={pagePath(id, g.version)} makeHref={GAMES.base} />;
}
