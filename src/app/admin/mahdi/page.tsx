import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@config/site";
import { t } from "@/lib/mahdi/i18n";
import { selectAll } from "@/lib/mahdi/server/snapshot";
import { coverUrl } from "@/lib/mahdi/server/reading";
import MahdiAdminTools, { type AdminData } from "./MahdiAdminTools";

export const metadata = { title: "لأجل المهدي | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** Owner-only: challenges, religious texts, motivational phrases and community reports of «لأجل المهدي». */
export default async function MahdiAdminPage() {
  const user = await requireUser("/admin/mahdi");
  if (!isAdmin(user.email)) notFound();
  const db = createAdminClient();

  const [sections, challenges, members, texts, phrases, reports, hidden] = await Promise.all([
    db.from("mahdi_challenge_sections").select("*").order("sort_order"),
    db.from("mahdi_challenges").select("*").order("created_at", { ascending: false }),
    selectAll<{ challenge_id: string }>((a, b) => db.from("mahdi_challenge_members").select("challenge_id").order("challenge_id").order("user_id").range(a, b)),
    db.from("mahdi_religious_texts").select("*").order("created_at", { ascending: false }),
    db.from("mahdi_phrases").select("*").order("sort_order"),
    selectAll<{ post_id: string; reason: string }>((a, b) => db.from("mahdi_post_reports").select("post_id, reason").order("post_id").order("user_id").range(a, b)),
    db.from("mahdi_posts").select("id").not("hidden_at", "is", null),
  ]);

  // Books: reported ones and the newest, with how many libraries hold each (empty until migration 0010 runs)
  const [bookReports, bookRows, holders] = await Promise.all([
    selectAll<{ book_id: string; reason: string }>((a, b) => db.from("mahdi_book_reports").select("book_id, reason").order("book_id").order("user_id").range(a, b)).catch(() => []),
    db.from("mahdi_books").select("id, title, author, pages, unit, description, cover_path, hidden_at, hidden_reason, created_at").order("created_at", { ascending: false }).limit(300),
    selectAll<{ book_id: string }>((a, b) => db.from("mahdi_user_books").select("book_id").order("book_id").order("user_id").range(a, b)).catch(() => []),
  ]);
  const bookReasons = new Map<string, string[]>();
  for (const r of bookReports) (bookReasons.get(r.book_id) ?? bookReasons.set(r.book_id, []).get(r.book_id)!).push(r.reason);
  const readers: Record<string, number> = {};
  for (const h of holders) readers[h.book_id] = (readers[h.book_id] ?? 0) + 1;
  const reportedMissing = [...bookReasons.keys()].filter((bid) => !(bookRows.data ?? []).some((b) => b.id === bid));
  const extraBooks = reportedMissing.length
    ? (await db.from("mahdi_books").select("id, title, author, pages, unit, description, cover_path, hidden_at, hidden_reason, created_at").in("id", reportedMissing.slice(0, 100))).data ?? []
    : [];

  // Questions to «المساعد» that wait for an answer (none until migration 0018 runs)
  const waiting = (await db.from("mahdi_assistant_messages").select("id", { count: "exact", head: true }).eq("from_owner", false).is("read_at", null)).count ?? 0;

  // Feedback («شاركنا رأيك»), newest first, with who sent it (empty until migration 0013 runs)
  const fb = (await db.from("mahdi_feedback").select("id, user_id, rating, kind, message, place, created_at").order("created_at", { ascending: false }).limit(500)).data ?? [];
  const fbIds = [...new Set(fb.map((x) => x.user_id as string))];
  const fbNames = new Map<string, string>();
  const fbHandles = new Map<string, string>();
  if (fbIds.length) {
    const [names, handles] = await Promise.all([
      db.from("mahdi_profiles").select("user_id, display_name").in("user_id", fbIds),
      db.from("site_usernames").select("user_id, username").in("user_id", fbIds),
    ]);
    for (const p of names.data ?? []) fbNames.set(p.user_id, p.display_name);
    for (const u of handles.data ?? []) fbHandles.set(u.user_id, u.username);
  }

  const memberCount: Record<string, number> = {};
  for (const m of members) memberCount[m.challenge_id] = (memberCount[m.challenge_id] ?? 0) + 1;

  // Reported posts (with their reports), plus posts already hidden
  const reasons = new Map<string, string[]>();
  for (const r of reports) (reasons.get(r.post_id) ?? reasons.set(r.post_id, []).get(r.post_id)!).push(r.reason);
  const postIds = [...new Set([...reasons.keys(), ...(hidden.data ?? []).map((p) => p.id)])];
  const posts = postIds.length ? await db.from("mahdi_posts").select("id, user_id, kind, payload, closing, created_at, hidden_at, hidden_reason").in("id", postIds.slice(0, 200)) : { data: [] };
  const authors = new Map<string, string>();
  const authorIds = [...new Set((posts.data ?? []).map((p) => p.user_id as string))];
  if (authorIds.length) {
    for (const p of (await db.from("mahdi_profiles").select("user_id, display_name").in("user_id", authorIds)).data ?? []) authors.set(p.user_id, p.display_name);
  }

  const data: AdminData = {
    feedback: fb.map((x) => ({
      id: x.id as string,
      name: fbNames.get(x.user_id) ?? "",
      username: fbHandles.get(x.user_id) ?? "",
      rating: (x.rating as number | null) ?? null,
      kind: x.kind as string,
      message: (x.message as string) ?? "",
      place: (x.place as string) ?? "",
      createdAt: x.created_at as string,
    })),
    books: [...(bookRows.data ?? []), ...extraBooks]
      .map((b) => ({
        id: b.id as string,
        title: b.title as string,
        author: b.author as string,
        pages: b.pages as number,
        unit: (b.unit === "narration" ? "narration" : "page") as "page" | "narration",
        description: b.description as string,
        coverUrl: coverUrl(b.cover_path as string | null),
        hidden: Boolean(b.hidden_at),
        hiddenReason: (b.hidden_reason as string) ?? "",
        reasons: bookReasons.get(b.id) ?? [],
        readers: readers[b.id] ?? 0,
      }))
      .sort((a, b) => Number(a.hidden) - Number(b.hidden) || b.reasons.length - a.reasons.length),
    sections: sections.data ?? [],
    challenges: (challenges.data ?? []).map((c) => ({ ...c, target: Number(c.target), members: memberCount[c.id] ?? 0 })),
    texts: texts.data ?? [],
    phrases: phrases.data ?? [],
    reports: (posts.data ?? [])
      .map((p) => ({
        id: p.id as string,
        author: authors.get(p.user_id) ?? "",
        kind: p.kind as string,
        title: String((p.payload as { title?: string })?.title ?? ""),
        value: String((p.payload as { value?: string })?.value ?? ""),
        createdAt: p.created_at as string,
        hidden: Boolean(p.hidden_at),
        hiddenReason: (p.hidden_reason as string) ?? "",
        reasons: reasons.get(p.id) ?? [],
        count: (reasons.get(p.id) ?? []).length,
      }))
      .sort((a, b) => Number(a.hidden) - Number(b.hidden) || b.count - a.count),
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/admin" className="text-sm font-bold text-muted">{t.admin.back}</Link>
        <h1 className="display text-4xl">{t.admin.title}</h1>
        <p className="font-bold text-muted">{t.admin.intro}</p>
        <Link href="/admin/mahdi/assistant" className={`btn mt-2 w-full ${waiting ? "btn-primary" : "btn-secondary"}`}>{waiting ? t.admin.assistant.linkWaiting(waiting) : t.admin.assistant.link}</Link>
        <Link href="/admin/mahdi/users" className="btn btn-secondary mt-2 w-full">{t.admin.users.link}</Link>
      </header>
      <MahdiAdminTools data={data} />
    </div>
  );
}
