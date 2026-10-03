import Link from "next/link";
import { notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { riyadhDay } from "@/lib/admin-stats";
import { isAdmin } from "@config/site";
import { t } from "@/lib/mahdi/i18n";
import { selectAll } from "@/lib/mahdi/server/snapshot";

export const metadata = { title: "مستخدمو لأجل المهدي | لوحة التحكم" };
export const dynamic = "force-dynamic";

const U = t.admin.users;
const DAY_MS = 24 * 3600_000;
/** The day `n` days ago in Riyadh (outside the component: reading the clock is fine on a dynamic page). */
const daysAgo = (n: number) => riyadhDay(new Date(Date.now() - n * DAY_MS).toISOString());

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" }) : U.never;
const latest = (...isos: (string | null | undefined)[]) =>
  isos.reduce<string | null>((a, b) => (b && (!a || b > a) ? b : a), null);

interface Row {
  id: string;
  name: string;
  username: string | null;
  email: string;
  siteJoined: string;
  joined: string | null;
  lastSignIn: string | null;
  lastActive: string | null;
  projects: number;
  habits: number;
  logs: number;
  days30: number;
  books: number;
  readMinutes: number;
  groups: number;
  challenges: number;
  push: boolean;
}

/** All site accounts, read page by page (the admin API returns at most 1000 at a time). */
async function allAuthUsers(db: ReturnType<typeof createAdminClient>): Promise<User[]> {
  const out: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 1000) return out;
  }
}

/**
 * Owner-only: who signed up and who uses «لأجل المهدي», as numbers per person.
 * On purpose no habit, project or book names: the app promises users that their data stays theirs.
 */
export default async function MahdiUsersPage({ searchParams }: PageProps<"/admin/mahdi/users">) {
  const user = await requireUser("/admin/mahdi/users");
  if (!isAdmin(user.email)) notFound();
  const sp = await searchParams;
  const showAll = sp.show === "all";
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase().replace(/^@/, "");

  const db = createAdminClient();
  const optional = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]); // tables of later migrations
  const [authUsers, profiles, usernames, projects, habits, logs, books, sessions, groups, challenges, push] = await Promise.all([
    allAuthUsers(db),
    selectAll<{ user_id: string; display_name: string; created_at: string }>((a, b) => db.from("mahdi_profiles").select("user_id, display_name, created_at").order("user_id").range(a, b)),
    optional(selectAll<{ user_id: string; username: string }>((a, b) => db.from("site_usernames").select("user_id, username").order("user_id").range(a, b))),
    selectAll<{ user_id: string; archived_at: string | null }>((a, b) => db.from("mahdi_projects").select("user_id, archived_at").order("id").range(a, b)),
    selectAll<{ user_id: string }>((a, b) => db.from("mahdi_habits").select("user_id").order("id").range(a, b)),
    selectAll<{ user_id: string; log_date: string; updated_at: string }>((a, b) => db.from("mahdi_logs").select("user_id, log_date, updated_at").order("habit_id").order("log_date").range(a, b)),
    optional(selectAll<{ user_id: string }>((a, b) => db.from("mahdi_user_books").select("user_id").order("user_id").order("book_id").range(a, b))),
    optional(selectAll<{ user_id: string; log_date: string; seconds: number; created_at: string }>((a, b) => db.from("mahdi_reading_sessions").select("user_id, log_date, seconds, created_at").order("id").range(a, b))),
    optional(selectAll<{ user_id: string }>((a, b) => db.from("mahdi_group_members").select("user_id").eq("status", "active").order("group_id").order("user_id").range(a, b))),
    selectAll<{ user_id: string }>((a, b) => db.from("mahdi_challenge_members").select("user_id").order("challenge_id").order("user_id").range(a, b)),
    selectAll<{ user_id: string }>((a, b) => db.from("mahdi_push_subscriptions").select("user_id").order("id").range(a, b)),
  ]);

  const count = (rows: { user_id: string }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const profileOf = new Map(profiles.map((p) => [p.user_id, p]));
  const usernameOf = new Map(usernames.map((u) => [u.user_id, u.username]));
  const projectsOf = count(projects.filter((p) => !p.archived_at));
  const habitsOf = count(habits);
  const logsOf = count(logs);
  const booksOf = count(books);
  const groupsOf = count(groups);
  const challengesOf = count(challenges);
  const pushOf = count(push);

  // Active days in the last 30 days and the latest activity (a log or a reading session)
  const since30 = daysAgo(29);
  const since7 = daysAgo(6);
  const days = new Map<string, Set<string>>();
  const lastAct = new Map<string, string>();
  const readSecs = new Map<string, number>();
  const touch = (uid: string, date: string, at: string) => {
    if (date >= since30) (days.get(uid) ?? days.set(uid, new Set()).get(uid)!).add(date);
    if (at > (lastAct.get(uid) ?? "")) lastAct.set(uid, at);
  };
  for (const l of logs) touch(l.user_id, l.log_date, l.updated_at);
  for (const s of sessions) {
    touch(s.user_id, s.log_date, s.created_at);
    readSecs.set(s.user_id, (readSecs.get(s.user_id) ?? 0) + s.seconds);
  }

  const rows: Row[] = authUsers.map((u) => {
    const p = profileOf.get(u.id);
    const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
    return {
      id: u.id,
      name: p?.display_name || meta.full_name || meta.name || "",
      username: usernameOf.get(u.id) ?? null,
      email: u.email ?? "",
      siteJoined: u.created_at,
      joined: p?.created_at ?? null,
      lastSignIn: u.last_sign_in_at ?? null,
      lastActive: latest(lastAct.get(u.id)),
      projects: projectsOf.get(u.id) ?? 0,
      habits: habitsOf.get(u.id) ?? 0,
      logs: logsOf.get(u.id) ?? 0,
      days30: days.get(u.id)?.size ?? 0,
      books: booksOf.get(u.id) ?? 0,
      readMinutes: Math.floor((readSecs.get(u.id) ?? 0) / 60),
      groups: groupsOf.get(u.id) ?? 0,
      challenges: challengesOf.get(u.id) ?? 0,
      push: (pushOf.get(u.id) ?? 0) > 0,
    };
  });

  const entered = rows.filter((r) => r.joined);
  const pct = (n: number) => (entered.length ? Math.round((n / entered.length) * 100) : 0);
  const built = entered.filter((r) => r.habits > 0).length;
  const active7 = entered.filter((r) => [...(days.get(r.id) ?? [])].some((d) => d >= since7)).length;
  const new7 = entered.filter((r) => r.joined && riyadhDay(r.joined) >= since7).length;
  const pushOn = entered.filter((r) => r.push).length;
  const tiles: [string, number, string?][] = [
    [U.tiles.site, rows.length],
    [U.tiles.entered, entered.length],
    [U.tiles.built, built, U.ofEntered(pct(built))],
    [U.tiles.active7, active7, U.ofEntered(pct(active7))],
    [U.tiles.new7, new7],
    [U.tiles.push, pushOn, U.ofEntered(pct(pushOn))],
  ];

  const shown = (showAll ? rows : entered)
    .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.username ?? "").includes(q) || r.email.toLowerCase().includes(q))
    .sort((a, b) => (latest(b.lastActive, b.lastSignIn) ?? "").localeCompare(latest(a.lastActive, a.lastSignIn) ?? ""));

  const tab = (all: boolean) =>
    `/admin/mahdi/users?${new URLSearchParams({ ...(all ? { show: "all" } : {}), ...(q ? { q } : {}) })}`;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/admin/mahdi" className="text-sm font-bold text-muted">{U.back}</Link>
        <h1 className="display text-4xl">{U.title}</h1>
        <p className="font-bold text-muted">{U.intro}</p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="card p-4">
            <p className="text-sm font-bold text-muted">{label}</p>
            <p className="display text-3xl">{value}</p>
            {sub && <p className="text-xs font-bold text-muted">{sub}</p>}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Link href={tab(false)} className={`btn px-3 text-base ${showAll ? "btn-ghost" : "btn-secondary"}`} aria-current={showAll ? undefined : "page"}>{U.show.mahdi}</Link>
          <Link href={tab(true)} className={`btn px-3 text-base ${showAll ? "btn-secondary" : "btn-ghost"}`} aria-current={showAll ? "page" : undefined}>{U.show.all}</Link>
        </div>
        <form className="flex gap-2" action="/admin/mahdi/users">
          {showAll && <input type="hidden" name="show" value="all" />}
          <input name="q" defaultValue={q} dir="auto" placeholder={U.search} className="field min-w-0 flex-1" />
          <button className="btn btn-secondary px-4 text-base">{U.searchBtn}</button>
        </form>
        <p className="text-sm font-bold text-muted">{U.count(shown.length)} · {U.days30Hint}</p>
      </section>

      {shown.length === 0 ? (
        <p className="card p-4 font-bold text-muted">{U.none}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => (
            <li key={r.id} className="card space-y-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-lg font-black">
                  <bdi dir="auto">{r.name || r.email.split("@")[0]}</bdi>
                  {r.push && <span className="ms-2 text-sm" title={U.push}>🔔</span>}
                </p>
                <p className="text-sm font-bold text-muted">
                  {r.username ? <bdi dir="auto">@{r.username}</bdi> : U.noUsername}
                </p>
              </div>
              <p className="break-all text-sm font-bold text-muted" dir="ltr">{r.email}</p>

              {r.joined ? (
                <div className="grid grid-cols-4 gap-2 text-center">
                  {(
                    [
                      [U.projects, r.projects],
                      [U.habits, r.habits],
                      [U.logs, r.logs],
                      [U.days30, r.days30],
                      [U.books, r.books],
                      [U.readMinutes, r.readMinutes],
                      [U.groups, r.groups],
                      [U.challenges, r.challenges],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-surface-2 p-2">
                      <p className="text-xl font-black">{value}</p>
                      <p className="text-xs font-bold text-muted">{label}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-bold text-muted">{U.notEntered}</p>
              )}

              <div className="grid gap-1 text-xs font-bold text-muted sm:grid-cols-2">
                {r.joined && <div>{U.joined}: {fmtDate(r.joined)}</div>}
                {r.joined && <div>{U.lastActive}: {fmtDate(r.lastActive)}</div>}
                <div>{U.lastSignIn}: {fmtDate(r.lastSignIn)}</div>
                {!r.joined && <div>{U.siteJoined}: {fmtDate(r.siteJoined)}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
