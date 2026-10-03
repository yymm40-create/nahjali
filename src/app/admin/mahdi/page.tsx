import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@config/site";
import { t } from "@/lib/mahdi/i18n";
import { selectAll } from "@/lib/mahdi/server/snapshot";
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
      </header>
      <MahdiAdminTools data={data} />
    </div>
  );
}
