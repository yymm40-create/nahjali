// «لأجل المهدي» drawn in a plain browser page with a mock account (screenshots by run.mjs). The page is picked by
// ?page=; the address path is the screen's real one, so the menus highlight it.
import { createRoot } from "react-dom/client";
import type { ComponentType } from "react";
import AppShell from "@/components/mahdi/AppShell";
import MahdiProvider from "@/components/mahdi/Provider";
import ThemeRoot from "@/components/mahdi/ThemeRoot";
import HomeSlider from "@/components/mahdi/HomeSlider";
import GymShell from "@/components/mahdi/health/GymShell";
import HealthProvider from "@/components/mahdi/health/HealthProvider";
import TodayView from "@/components/mahdi/health/TodayView";
import ProjectsPage from "@/app/mahdi/(app)/projects/page";
import ReadingPage from "@/app/mahdi/(app)/reading/page";
import KhatmaPage from "@/app/mahdi/(app)/khatma/page";
import GroupsPage from "@/app/mahdi/(app)/groups/page";
import CommunityPage from "@/app/mahdi/(app)/community/page";
import ChallengesPage from "@/app/mahdi/(app)/challenges/page";
import ProgressPage from "@/app/mahdi/(app)/progress/page";
import WeekReport from "@/app/mahdi/(app)/progress/week/WeekReport";
import { api, shrine, snapshot } from "./mock";
import "@/app/mahdi/mahdi.css";

const PAGES: Record<string, [string, ComponentType]> = {
  home: ["/mahdi", HomeSlider],
  habits: ["/mahdi/projects", ProjectsPage],
  reading: ["/mahdi/reading", ReadingPage],
  khatma: ["/mahdi/khatma", KhatmaPage],
  groups: ["/mahdi/groups", GroupsPage],
  health: ["/mahdi/health", TodayView],
  community: ["/mahdi/community", CommunityPage],
  challenges: ["/mahdi/challenges", ChallengesPage],
  progress: ["/mahdi/progress", ProgressPage],
  week: ["/mahdi/progress/week", () => <WeekReport />],
};

// Every call to the API answers from the mock account
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes("/api/")) return realFetch(input, init);
  const method = (init?.method ?? "GET").toUpperCase();
  let body = api(url, method);
  if (body === null) {
    console.log(`[mock] unhandled ${method} ${url}`);
    body = {};
  }
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
};

const key = new URLSearchParams(location.search).get("page") ?? "home";
const [path, Page] = PAGES[key] ?? PAGES.home;
window.__PV_PATH = path;
try {
  localStorage.clear();
} catch {}

createRoot(document.getElementById("root")!).render(
  <ThemeRoot initialTheme={snapshot.profile.theme} initialShrine={shrine} initialPlace={snapshot.profile.shrinePlace} fontClass="pv-fonts" skipLabel="تخطَّ إلى المحتوى">
    <MahdiProvider initial={snapshot}>
      {key === "health" ? (
        <HealthProvider>
          <GymShell>
            <Page />
          </GymShell>
        </HealthProvider>
      ) : (
        <AppShell>
          <Page />
        </AppShell>
      )}
    </MahdiProvider>
  </ThemeRoot>,
);
