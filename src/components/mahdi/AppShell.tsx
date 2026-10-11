"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { bySort } from "@/lib/mahdi/client/derive";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import AssistantFloat from "./AssistantFloat";
import { FeedbackPrompt, FeedbackSheet } from "./Feedback";
import HabitForm from "./HabitForm";
import Icon from "./Icon";
import { BOTTOM, navGroups } from "./nav";
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

  const groups = navGroups(state.snap.username ?? null);
  const [drawer, setDrawer] = useState(false);
  const menuList = (onPick?: () => void) => (
    <nav aria-label={t.nav.main}>
      {groups.map((g) => (
        <div key={g.title} className="m-drawer-group">
          <p>{g.title}</p>
          {g.items.map((n) => (
            <Link key={n.href} href={n.href} className="m-drawer-item" aria-current={n.match(pathname) ? "page" : undefined} onClick={onPick}>
              <span className="m-drawer-ic" style={{ "--ic": n.color } as React.CSSProperties}>
                <Icon name={n.icon} size={19} />
              </span>
              <span className="min-w-0 flex-1 truncate">{n.label}</span>
              {n.href === "/mahdi/inbox" && unread > 0 && <span className="m-badge m-num static" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
            </Link>
          ))}
        </div>
      ))}
      <div className="m-drawer-group">
        <p>أخرى</p>
        <button type="button" className="m-drawer-item w-full" onClick={() => { onPick?.(); setFeedback(true); }}>
          <span className="m-drawer-ic" style={{ "--ic": "#0ea5e9" } as React.CSSProperties}><Icon name="chat" size={19} /></span>
          <span className="flex-1 text-start">{t.feedback.cta}</span>
        </button>
        <Link href="/" className="m-drawer-item" onClick={onPick}>
          <span className="m-drawer-ic" style={{ "--ic": "#475569" } as React.CSSProperties}><Icon name="chevronRight" size={19} /></span>
          <span className="flex-1">{t.bar.siteLong}</span>
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[288px_1fr]">
      {/* Computer: the same full menu, always open */}
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-e lg:flex" style={{ borderColor: "var(--m-line)", background: "color-mix(in srgb, var(--m-surface-solid) 78%, transparent)" }}>
        <div className="flex items-center gap-3 px-5 pt-6 pb-2">
          <Link href="/mahdi" className="m-brand flex-1 text-2xl">{t.brand}</Link>
        </div>
        <div className="px-4 py-2">
          <button type="button" className="m-btn m-btn-primary w-full" onClick={onAdd}>
            <Icon name="plus" /> {inProject ? t.add.habitIn(inProject.name) : t.nav.add}
          </button>
        </div>
        {menuList()}
        <Link href="/mahdi/more" className="m-soft m-4 mt-auto flex items-center gap-3 p-3" aria-label={t.nav.account}>
          <Avatar profile={profile} size={40} />
          <span className="min-w-0 truncate text-sm font-semibold">{t.mawla(profile.displayName)}</span>
        </Link>
      </aside>

      <div className="min-w-0">
        {/* Every screen: the menu (☰) on the right, the name, then the notifications and the account */}
        <header className="m-topbar" aria-label={t.bar.label}>
          <button type="button" className="m-menu-btn lg:hidden" onClick={() => setDrawer(true)} aria-label="القائمة" aria-haspopup="dialog" aria-expanded={drawer}>
            <Icon name="menu" size={22} strokeWidth={2.2} />
          </button>
          <Link href="/mahdi" className="m-brand min-w-0 flex-1 truncate lg:hidden">{t.brand}</Link>
          <span className="hidden flex-1 lg:block" />
          <Link
            href="/mahdi/inbox"
            className="m-menu-btn relative"
            aria-label={unread ? t.bar.inboxUnread(unread) : t.bar.inbox}
            aria-current={pathname.startsWith("/mahdi/inbox") ? "page" : undefined}
          >
            <Icon name="bell" size={22} />
            {unread > 0 && <span className="m-badge m-num" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
          </Link>
          <Link href="/mahdi/more" className="shrink-0 rounded-full" aria-label={t.nav.account} aria-current={pathname.startsWith("/mahdi/more") ? "page" : undefined}>
            <Avatar profile={profile} size={40} />
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

      {/* Phones: a floating bar — four places around the «+»; everything else is in the menu (☰) */}
      <nav aria-label={t.nav.main} className="m-bottom-nav lg:hidden">
        <div className="mx-auto grid h-full max-w-xl grid-cols-5 items-center px-1">
          {BOTTOM.slice(0, 2).map((n) => (
            <Link key={n.href} href={n.href} className="m-nav-item" aria-current={n.match(pathname) ? "page" : undefined}>
              <Icon name={n.icon} /> {n === BOTTOM[1] ? t.nav.projects : n === BOTTOM[0] ? t.nav.home : n.label}
            </Link>
          ))}
          <div className="grid place-items-center">
            <button type="button" className="m-fab" onClick={onAdd} aria-label={inProject ? t.add.habitIn(inProject.name) : t.nav.add}>
              <Icon name="plus" size={28} strokeWidth={2.2} />
            </button>
          </div>
          {BOTTOM.slice(2, 4).map((n) => (
            <Link key={n.href} href={n.href} className="m-nav-item" aria-current={n.match(pathname) ? "page" : undefined}>
              <Icon name={n.icon} /> {n === BOTTOM[2] ? t.nav.reading : t.nav.community}
            </Link>
          ))}
        </div>
      </nav>

      <Drawer open={drawer} onClose={() => setDrawer(false)} head={
        <Link href="/mahdi/more" className="flex items-center gap-3" onClick={() => setDrawer(false)}>
          <Avatar profile={profile} size={52} />
          <span className="min-w-0">
            <span className="m-brand block text-xl">{t.brand}</span>
            <span className="block truncate text-sm font-semibold m-muted">{t.mawla(profile.displayName)}</span>
          </span>
        </Link>
      }>
        {menuList(() => setDrawer(false))}
      </Drawer>

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

/** The side menu (☰): a dialog that slides in from the right, closed by a tap outside, Escape, or picking a place. */
function Drawer({ open, onClose, head, children }: { open: boolean; onClose: () => void; head: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="m-drawer"
      aria-label="القائمة"
      onClose={onClose}
      onClick={(e) => {
        // a tap on the dark outside (the dialog itself, not its content) closes it
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="m-drawer-head flex items-start gap-2">
        <div className="min-w-0 flex-1">{head}</div>
        <button type="button" className="m-icon-btn" onClick={onClose} aria-label={t.common.close}>
          <Icon name="close" size={22} />
        </button>
      </div>
      {children}
      <div className="h-6" />
    </dialog>
  );
}
