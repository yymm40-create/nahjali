"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { bySort } from "@/lib/mahdi/client/derive";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import AssistantFloat from "./AssistantFloat";
import { FeedbackPrompt, FeedbackSheet } from "./Feedback";
import HabitForm from "./HabitForm";
import Icon, { type IconName } from "./Icon";
import ProjectForm from "./ProjectForm";
import { useMahdi } from "./Provider";
import Sheet from "./Sheet";
import Toasts from "./Toasts";
import Avatar from "./Avatar";
import RewardReveal from "./RewardReveal";

const NAV: { href: string; label: string; side?: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/mahdi", label: t.nav.home, icon: "home", match: (p) => p === "/mahdi" || p.startsWith("/mahdi/day") },
  { href: "/mahdi/projects", label: t.nav.projects, side: t.nav.side.projects, icon: "projects", match: (p) => p.startsWith("/mahdi/projects") || p.startsWith("/mahdi/habits") },
  { href: "/mahdi/reading", label: t.nav.reading, side: t.nav.side.reading, icon: "book", match: (p) => p.startsWith("/mahdi/reading") },
  { href: "/mahdi/progress", label: t.nav.progress, side: t.nav.side.progress, icon: "progress", match: (p) => p.startsWith("/mahdi/progress") },
  { href: "/mahdi/community", label: t.nav.community, side: t.nav.side.community, icon: "globe", match: (p) => p.startsWith("/mahdi/community") || p.startsWith("/mahdi/challenges") || p.startsWith("/mahdi/share") },
];

/** Tells the top bar to ask again how many notifications are unread (after reading them). */
export const INBOX_EVENT = "mahdi:inbox";

/** How many notifications are unread: asked on opening, every minute, when the app comes back, and on INBOX_EVENT. */
function useUnread() {
  const [unread, setUnread] = useState(0);
  const refresh = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    mahdiFetch<{ unread: number }>("/api/mahdi/inbox?count=1")
      .then((r) => setUnread(r.unread))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const every = setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener(INBOX_EVENT, refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(INBOX_EVENT, refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refresh]);
  return { unread, refresh };
}

/** The context of the "+" button: inside a project it means "a habit in this project". */
function useAddContext() {
  const pathname = usePathname();
  const m = pathname.match(/^\/mahdi\/projects\/([0-9a-f-]{36})/i);
  return m?.[1];
}

export default function AppShell({ children, familyMember = false }: { children: React.ReactNode; familyMember?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useMahdi();
  const contextProject = useAddContext();
  const [menu, setMenu] = useState(false);
  const [newHabit, setNewHabit] = useState(false);
  const [newProject, setNewProject] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const { unread, refresh } = useUnread();
  // A reply notification opens «المساعد» with ?assistant=1 on any screen
  const searchParams = useSearchParams();
  const assistantFromLink = searchParams.get("assistant") === "1";
  const linkClosed = () => router.replace(pathname, { scroll: false });

  const projects = state.snap.projects.filter((p) => !p.archivedAt).sort(bySort);
  const inProject = projects.find((p) => p.id === contextProject);
  const { profile } = state.snap;

  const onAdd = () => {
    if (projects.length === 0) setNewProject(true);
    else if (inProject) setNewHabit(true);
    else setMenu(true);
  };

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[272px_1fr]">
      {/* Desktop: side navigation */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-e px-4 py-6 lg:flex" style={{ borderColor: "var(--m-line)", background: "color-mix(in srgb, var(--m-surface-solid) 70%, transparent)" }}>
        <Link href="/mahdi" className="px-2">
          <span className="m-display m-gold block text-3xl">{t.brand}</span>
        </Link>
        <nav aria-label={t.nav.main} className="flex flex-col gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="m-side-item" aria-current={n.match(pathname) ? "page" : undefined}>
              <Icon name={n.icon} /> {n.side ?? n.label}
            </Link>
          ))}
        </nav>
        <button type="button" className="m-btn m-btn-primary" onClick={onAdd}>
          <Icon name="plus" /> {inProject ? t.add.habitIn(inProject.name) : t.nav.add}
        </button>
        <div className="mt-auto space-y-3">
          <Link href="/mahdi/more" className="m-soft flex items-center gap-3 p-3" aria-label={t.nav.account}>
            <Avatar profile={profile} size={40} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{t.mawla(profile.displayName)}</span>
            </span>
          </Link>
          <button type="button" className="m-side-item w-full text-sm" onClick={() => setFeedback(true)}>
            <Icon name="chat" size={18} /> {t.feedback.cta}
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Every screen: back to the site, the community, the notifications and the account, always in the same place */}
        <header className="m-topbar" aria-label={t.bar.label}>
          <Link href="/" className="m-bar-site">
            <Icon name="chevronRight" size={18} strokeWidth={2.2} />
            <span className="lg:hidden">{t.bar.site}</span>
            <span className="hidden lg:inline">{t.bar.siteLong}</span>
          </Link>
          <Link href="/mahdi" className="m-display m-gold min-w-0 truncate text-lg max-sm:hidden lg:hidden">{t.brand}</Link>
          <span className="flex-1" />
          <Link href="/mahdi/community" className="m-bar-btn" aria-current={NAV[4].match(pathname) ? "page" : undefined}>
            <Icon name="globe" size={24} />
            <span>{t.bar.community}</span>
          </Link>
          <Link
            href="/mahdi/inbox"
            className="m-bar-btn relative"
            aria-label={unread ? t.bar.inboxUnread(unread) : t.bar.inbox}
            aria-current={pathname.startsWith("/mahdi/inbox") ? "page" : undefined}
          >
            <Icon name="bell" size={24} />
            <span>{t.bar.inbox}</span>
            {unread > 0 && <span className="m-badge m-num" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
          </Link>
          <Link href="/mahdi/more" className="m-bar-btn" aria-label={t.nav.account} aria-current={pathname.startsWith("/mahdi/more") ? "page" : undefined}>
            <Avatar profile={profile} size={26} />
            <span>{t.bar.account}</span>
          </Link>
        </header>
        {familyMember && (
          <Link href="/mahdi/more/family" className="m-note mx-4 mt-3 flex items-center gap-2 text-sm font-semibold sm:mx-6 lg:mx-10">
            <Icon name="users" size={18} />
            <span className="flex-1">{t.family.memberBanner(profile.displayName)}</span>
            <span className="m-gold">{t.family.switchAccount}</span>
          </Link>
        )}
        <SyncBanner />
        <main id="m-main" className="m-content-pad mx-auto w-full max-w-[1120px] px-4 pt-4 sm:px-6 lg:px-10 lg:pt-8">
          {children}
        </main>
      </div>

      {/* Phones: bottom navigation with the "+" in the middle (the community and the account are in the top bar) */}
      <nav aria-label={t.nav.main} className="m-bottom-nav lg:hidden">
        <div className="mx-auto grid h-full max-w-xl grid-cols-5 items-center px-1">
          {NAV.slice(0, 2).map((n) => (
            <Link key={n.href} href={n.href} className="m-nav-item" aria-current={n.match(pathname) ? "page" : undefined}>
              <Icon name={n.icon} /> {n.label}
            </Link>
          ))}
          <div className="grid place-items-center">
            <button type="button" className="m-fab" onClick={onAdd} aria-label={inProject ? t.add.habitIn(inProject.name) : t.nav.add}>
              <Icon name="plus" size={28} strokeWidth={2.2} />
            </button>
          </div>
          {NAV.slice(2, 4).map((n) => (
            <Link key={n.href} href={n.href} className="m-nav-item" aria-current={n.match(pathname) ? "page" : undefined}>
              <Icon name={n.icon} /> {n.label}
            </Link>
          ))}
        </div>
      </nav>

      <Sheet open={menu} onClose={() => setMenu(false)} title={t.add.title}>
        <div className="grid gap-3">
          <button
            type="button"
            className="m-option flex items-center gap-4 p-4 text-start"
            onClick={() => {
              setMenu(false);
              setNewHabit(true);
            }}
          >
            <span className="m-soft grid size-12 place-items-center">
              <Icon name="target" />
            </span>
            <span>
              <span className="block font-semibold">{t.add.habit}</span>
              <span className="m-hint">{t.add.habitHint}</span>
            </span>
          </button>
          <button
            type="button"
            className="m-option flex items-center gap-4 p-4 text-start"
            onClick={() => {
              setMenu(false);
              setNewProject(true);
            }}
          >
            <span className="m-soft grid size-12 place-items-center">
              <Icon name="projects" />
            </span>
            <span>
              <span className="block font-semibold">{t.add.project}</span>
              <span className="m-hint">{t.add.projectHint}</span>
            </span>
          </button>
        </div>
      </Sheet>
      <HabitForm open={newHabit} onClose={() => setNewHabit(false)} projectId={inProject?.id} />
      <ProjectForm open={newProject} onClose={() => setNewProject(false)} onSaved={(id) => router.push(`/mahdi/projects/${id}`)} />
      <FeedbackSheet open={feedback} onClose={() => setFeedback(false)} place="sidebar" />
      <AssistantFloat openFromLink={assistantFromLink} onLinkClosed={linkClosed} onRead={refresh} />
      <FeedbackPrompt />
      <RewardReveal />
      <Toasts />
    </div>
  );
}

/** Offline / waiting-to-send notice. */
function SyncBanner() {
  const { state } = useMahdi();
  if (state.online && !state.syncError) return null;
  return (
    <div role="status" className="m-note mx-4 mt-3 flex items-center gap-2 text-sm font-semibold sm:mx-6 lg:mx-10">
      <Icon name="offline" size={18} />
      <span>{!state.online ? t.common.offline : state.syncError}</span>
      {state.pending.length > 0 && <span className="m-muted ms-auto">{t.common.syncing(state.pending.length)}</span>}
    </div>
  );
}
