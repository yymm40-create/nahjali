"use client";

import Link from "next/link";
import BrandLogo from "./BrandLogo";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { bySort } from "@/lib/mahdi/client/derive";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import AndroidNews from "./AndroidNews";
import ReadChallengeInvite from "./ReadChallengeInvite";
import AssistantFloat from "./AssistantFloat";
import { FeedbackPrompt } from "./Feedback";
import HabitForm from "./HabitForm";
import Icon from "./Icon";
import { COMMUNITY, ME, READING, TABS, isTabRoot, parentOf, tabOf, titleOf } from "./nav";
import ProjectForm from "./ProjectForm";
import { useMahdi } from "./Provider";
import Sheet from "./Sheet";
import Toasts from "./Toasts";
import Avatar from "./Avatar";
import RewardReveal from "./RewardReveal";

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

/**
 * The way back: the screens visited in this tab of the browser, in order. «رجوع» goes back when the previous screen is
 * ours, else (opened from a link or a notification) one step up (nav.parentOf).
 */
const TRAIL = "mahdi:trail";
function useTrail(pathname: string) {
  useEffect(() => {
    try {
      const trail: string[] = JSON.parse(sessionStorage.getItem(TRAIL) ?? "[]");
      if (trail.length > 1 && trail[trail.length - 2] === pathname) trail.pop();
      else if (trail[trail.length - 1] !== pathname) trail.push(pathname);
      sessionStorage.setItem(TRAIL, JSON.stringify(trail.slice(-40)));
    } catch {}
  }, [pathname]);
}
/** True once the page is scrolled: the bar's small title and hairline show then (large titles). */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 28);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return scrolled;
}
function canGoBack() {
  try {
    return JSON.parse(sessionStorage.getItem(TRAIL) ?? "[]").length > 1;
  } catch {
    return false;
  }
}

export default function AppShell({ children, familyMember = false }: { children: React.ReactNode; familyMember?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useMahdi();
  const contextProject = useAddContext();
  const [menu, setMenu] = useState<null | "habits" | "reading" | "community">(null);
  const [newHabit, setNewHabit] = useState(false);
  const [newProject, setNewProject] = useState(false);
  const { unread, refresh } = useUnread();
  useTrail(pathname);
  const scrolled = useScrolled();
  // A reply notification opens the team's chat («المساعد») with ?assistant=1 on any screen
  const searchParams = useSearchParams();
  const assistantFromLink = searchParams.get("assistant") === "1";
  const linkClosed = () => router.replace(pathname, { scroll: false });

  const projects = state.snap.projects.filter((p) => !p.archivedAt).sort(bySort);
  const inProject = projects.find((p) => p.id === contextProject);
  const { profile } = state.snap;
  const tab = tabOf(pathname);
  const root = isTabRoot(pathname);
  const title = titleOf(pathname);

  // «+» understands where you are: a habit on the day and the habits, a book or a khatma in the reading, a post or a
  // story in the community; nothing in «أنا»
  const addKind: "habits" | "reading" | "community" | null =
    tab === COMMUNITY ? "community" : tab === READING ? "reading" : tab === ME ? null : "habits";
  const addLabel = addKind === "community" ? "منشور جديد" : addKind === "reading" ? "أضف للقراءة" : inProject ? t.add.habitIn(inProject.name) : t.nav.add;
  const onAdd = () => {
    if (addKind === "habits") {
      if (projects.length === 0) setNewProject(true);
      else if (inProject) setNewHabit(true);
      else setMenu("habits");
    } else if (addKind) setMenu(addKind);
  };
  const back = () => {
    if (canGoBack()) router.back();
    else router.push(parentOf(pathname));
  };

  const bell = (
    <Link
      href="/mahdi/inbox"
      className="m-menu-btn relative"
      aria-label={unread ? t.bar.inboxUnread(unread) : t.bar.inbox}
      aria-current={pathname.startsWith("/mahdi/inbox") ? "page" : undefined}
    >
      <Icon name="bell" size={22} />
      {unread > 0 && <span className="m-badge m-num" aria-hidden="true" />}
    </Link>
  );

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[256px_1fr]">
      {/* Computer: the same five destinations, always open */}
      <aside className="m-side sticky top-0 hidden h-dvh flex-col gap-1 overflow-y-auto px-4 lg:flex">
        <Link href="/mahdi" className="m-brand flex items-center gap-2 px-2 pt-6 pb-4 text-2xl"><BrandLogo />{t.brand}</Link>
        {addKind && (
          <button type="button" className="m-btn m-btn-primary mb-3 w-full" onClick={onAdd}>
            <Icon name="plus" /> {addLabel}
          </button>
        )}
        <nav aria-label={t.nav.main} className="grid gap-1">
          {TABS.map((n) => (
            <Link key={n.href} href={n.href} className="m-side-item" aria-current={tab === n ? "page" : undefined}>
              <Icon name={n.icon} /> {n.label}
            </Link>
          ))}
        </nav>
        <Link href="/mahdi/more" className="m-soft mt-auto mb-4 flex items-center gap-3 p-3" aria-label={t.nav.account}>
          <Avatar profile={profile} size={40} />
          <span className="min-w-0 truncate text-sm font-semibold">{t.mawla(profile.displayName)}</span>
        </Link>
      </aside>

      <div className="min-w-0">
        {/* The top bar, the same everywhere: a destination's name, or «رجوع» and the screen's name inside it */}
        <header className="m-topbar" aria-label={t.bar.label} data-scrolled={scrolled ? "" : undefined}>
          {root ? (
            <h2 className="m-bar-title">{title}</h2>
          ) : (
            <>
              <button type="button" className="m-menu-btn" onClick={back} aria-label={t.common.back}>
                <Icon name="chevronRight" size={26} strokeWidth={2.2} />
              </button>
              <h2 className="m-bar-title m-bar-title-inner">{title}</h2>
            </>
          )}
          <span className="flex-1" />
          {root && addKind && (
            <button type="button" className="m-menu-btn m-bar-add lg:hidden" onClick={onAdd} aria-label={addLabel}>
              <Icon name="plus" size={24} strokeWidth={2.2} />
            </button>
          )}
          {bell}
        </header>
        {familyMember && (
          <Link href="/mahdi/more/family" className="m-note mx-4 mt-3 flex items-center gap-2 text-sm font-semibold sm:mx-6 lg:mx-10">
            <Icon name="users" size={18} />
            <span className="flex-1">{t.family.memberBanner(profile.displayName)}</span>
            <span className="m-gold">{t.family.switchAccount}</span>
          </Link>
        )}
        <SyncBanner />
        <AndroidNews />
        <ReadChallengeInvite />
        <main id="m-main" key={tab?.href ?? "x"} className="m-content-pad m-page-in mx-auto w-full max-w-[1120px] px-4 pt-4 sm:px-6 lg:px-10 lg:pt-8">
          {children}
        </main>
      </div>

      {/* Phones: the five destinations, a floating glass bar */}
      <nav aria-label={t.nav.main} className="m-bottom-nav lg:hidden">
        <div className="m-tabbar">
          {TABS.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="m-nav-item"
              aria-current={tab === n ? "page" : undefined}
              onClick={() => {
                // a second tap on the open destination takes you to its top
                if (tab === n && pathname === n.href) window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <span className="m-nav-ic">
                <Icon name={n.icon} />
                {n === ME && unread > 0 && <span className="m-dot-badge" aria-hidden="true" />}
              </span>
              {n.label}
            </Link>
          ))}
        </div>
      </nav>

      <Sheet open={menu !== null} onClose={() => setMenu(null)} title={menu === "community" ? "شارك" : menu === "reading" ? "أضف للقراءة" : t.add.title}>
        <div className="grid gap-3">
          {(menu === "habits"
            ? [
                { icon: "target" as const, label: t.add.habit, hint: t.add.habitHint, go: () => setNewHabit(true) },
                { icon: "projects" as const, label: t.add.project, hint: t.add.projectHint, go: () => setNewProject(true) },
              ]
            : menu === "reading"
              ? [
                  { icon: "book" as const, label: "كتاب جديد", hint: "أضف كتاب لمكتبتك وابدأ تقراه", go: () => router.push("/mahdi/reading/add") },
                  { icon: "book" as const, label: "ختمة قرآن", hint: "ختمتك أنت، أو ختمة مع مجموعتك", go: () => router.push("/mahdi/khatma") },
                ]
              : [
                  { icon: "edit" as const, label: "منشور جديد", hint: "صورة أو اقتباس لأصحابك", go: () => router.push("/mahdi/post/new") },
                  { icon: "camera" as const, label: "قصة", hint: "تختفي بعد يوم", go: () => router.push("/mahdi/stories") },
                ]
          ).map((o) => (
            <button
              key={o.label}
              type="button"
              className="m-option flex items-center gap-4 p-4 text-start"
              onClick={() => {
                setMenu(null);
                o.go();
              }}
            >
              <span className="m-soft grid size-12 place-items-center">
                <Icon name={o.icon} />
              </span>
              <span>
                <span className="block font-semibold">{o.label}</span>
                <span className="m-hint">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
      <HabitForm open={newHabit} onClose={() => setNewHabit(false)} projectId={inProject?.id} />
      <ProjectForm open={newProject} onClose={() => setNewProject(false)} onSaved={(id) => router.push(`/mahdi/projects/${id}`)} />
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
