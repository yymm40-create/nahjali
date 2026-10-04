import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@config/site";
import { t } from "@/lib/mahdi/i18n";
import { UUID_RE } from "@/lib/mahdi/server/api";
import AssistantReply from "./AssistantReply";

export const metadata = { title: "رسائل المساعد | لوحة التحكم" };
export const dynamic = "force-dynamic";

const A = t.admin.assistant;
const fmt = (iso: string) => new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" });

interface Msg {
  id: string;
  user_id: string;
  from_owner: boolean;
  body: string;
  created_at: string;
  read_at: string | null;
}

/** Owner-only: questions sent from the «المساعد» button, answered by hand. `?u=<user id>` opens one conversation. */
export default async function AssistantAdminPage({ searchParams }: PageProps<"/admin/mahdi/assistant">) {
  const user = await requireUser("/admin/mahdi/assistant");
  if (!isAdmin(user.email)) notFound();
  const db = createAdminClient();
  const sp = await searchParams;
  const open = typeof sp.u === "string" && UUID_RE.test(sp.u) ? sp.u : null;

  const { data, error } = await db.from("mahdi_assistant_messages").select("id, user_id, from_owner, body, created_at, read_at").order("created_at", { ascending: false }).limit(3000);
  const rows = (data ?? []) as Msg[];

  // One entry per person: their last message, and whether it waits for an answer
  const threads = new Map<string, { last: Msg; waiting: number; count: number }>();
  for (const m of rows) {
    const th = threads.get(m.user_id) ?? threads.set(m.user_id, { last: m, waiting: 0, count: 0 }).get(m.user_id)!;
    th.count++;
    if (!m.from_owner && !m.read_at) th.waiting++;
  }
  const ids = [...threads.keys()];
  const names = new Map<string, { name: string; username: string }>();
  if (ids.length) {
    const [profiles, handles] = await Promise.all([
      db.from("mahdi_profiles").select("user_id, display_name").in("user_id", ids),
      db.from("site_usernames").select("user_id, username").in("user_id", ids),
    ]);
    for (const p of profiles.data ?? []) names.set(p.user_id, { name: p.display_name, username: "" });
    for (const u of handles.data ?? []) names.set(u.user_id, { name: names.get(u.user_id)?.name ?? "", username: u.username });
  }
  const list = [...threads.entries()].sort(([, a], [, b]) => Number(b.waiting > 0) - Number(a.waiting > 0) || (b.last.created_at > a.last.created_at ? 1 : -1));
  const conversation = open ? rows.filter((m) => m.user_id === open).reverse() : [];
  const who = (id: string) => names.get(id) ?? { name: "", username: "" };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href={open ? "/admin/mahdi/assistant" : "/admin/mahdi"} className="text-sm font-bold text-muted">{open ? A.back : t.admin.title}</Link>
        <h1 className="display text-4xl">{A.title}</h1>
        <p className="font-bold text-muted">{A.intro}</p>
      </header>

      {error ? (
        <p className="card p-4 font-bold">{A.notReady}</p>
      ) : open ? (
        <section className="card space-y-4 p-4">
          <h2 className="text-xl font-extrabold">
            <bdi dir="auto">{who(open).name || "—"}</bdi>
            {who(open).username && <span className="ms-2 text-sm text-muted"><bdi dir="auto">@{who(open).username}</bdi></span>}
          </h2>
          <ol className="space-y-2">
            {conversation.length === 0 && <li className="font-bold text-muted">{A.none}</li>}
            {conversation.map((m) => (
              <li key={m.id} className={`max-w-[85%] space-y-1 rounded-2xl px-3 py-2 ${m.from_owner ? "ms-auto bg-gold/15" : "bg-surface-2"}`}>
                <p className="whitespace-pre-line" dir="auto">{m.body}</p>
                <p className="text-xs font-bold text-muted">{m.from_owner ? A.owner : who(open).name} · {fmt(m.created_at)}</p>
              </li>
            ))}
          </ol>
          <AssistantReply userId={open} waiting={threads.get(open)?.waiting ?? 0} />
        </section>
      ) : (
        <section className="card space-y-3 p-4">
          <ul className="space-y-2">
            {list.length === 0 && <li className="font-bold text-muted">{A.none}</li>}
            {list.map(([id, th]) => (
              <li key={id}>
                <Link href={`/admin/mahdi/assistant?u=${id}`} className="block space-y-1 rounded-2xl bg-surface-2 px-3 py-3 hover:ring-2 hover:ring-gold">
                  <span className="flex flex-wrap items-center justify-between gap-2 font-bold">
                    <span>
                      <bdi dir="auto">{who(id).name || "—"}</bdi>
                      {who(id).username && <span className="ms-2 text-sm text-muted"><bdi dir="auto">@{who(id).username}</bdi></span>}
                    </span>
                    <span className={`chip ${th.waiting ? "ring-2 ring-gold" : ""}`}>{th.waiting ? `${A.waiting} (${th.waiting})` : A.answered}</span>
                  </span>
                  <span className="line-clamp-2 block whitespace-pre-line text-sm" dir="auto">{th.last.from_owner ? `${A.owner}: ` : ""}{th.last.body}</span>
                  <span className="block text-xs font-bold text-muted">{fmt(th.last.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
