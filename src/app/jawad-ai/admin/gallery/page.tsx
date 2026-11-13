import Link from "next/link";
import GalleryReview from "@/components/jawad/admin/GalleryReview";
import { requireJawadOwnerPage } from "@/lib/jawad/server/access";
import { REVIEW_FILTERS, reviewList, type ReviewFilter } from "@/lib/jawad/server/gallery";
import { GALLERY_BASE, GALLERY_RULES } from "@config/jawad/gallery";

export const metadata = { title: "معرض الناس" };
export const dynamic = "force-dynamic";

/** «معرض الناس»: the works people sent, waiting for the owner (approve, reject, hide, feature), and the live share links. */
export default async function GalleryAdmin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireJawadOwnerPage("/jawad-ai/admin/gallery");
  const f = (await searchParams).f;
  const filter: ReviewFilter = REVIEW_FILTERS.some((x) => x.id === f) ? (f as ReviewFilter) : "pending";
  const list: Awaited<ReturnType<typeof reviewList>> = await reviewList(filter).catch(() => ({ ready: false, rows: [], counts: {} }));
  return (
    <div className="space-y-4">
      <section className="jw-panel space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">🖼️ معرض الناس</h2>
          <Link href={GALLERY_BASE} className="jw-btn jw-btn-quiet text-xs" target="_blank">افتح المعرض العام ←</Link>
        </div>
        <ul className="list-inside list-disc space-y-0.5 text-xs text-jw-muted">
          {GALLERY_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
      {!list.ready ? (
        <p className="rounded-lg border border-jw-warn/40 bg-jw-warn/10 p-3 text-sm text-jw-warn">«معرض الناس» يحتاج ملف قاعدة البيانات 0112_jawad_gallery.sql في Supabase (SQL Editor ← Run).</p>
      ) : (
        <>
          <nav className="flex flex-wrap gap-1.5" aria-label="حالة الأعمال">
            {REVIEW_FILTERS.map((x) => (
              <Link key={x.id} href={`/jawad-ai/admin/gallery?f=${x.id}`} aria-current={filter === x.id ? "page" : undefined} className={`jw-btn !min-h-8 whitespace-nowrap !px-3 text-xs ${filter === x.id ? "!border-jw-accent/50 text-jw-accent" : "jw-btn-quiet"}`}>
                {x.label}
                {x.id === "pending" && list.counts.pending ? ` (${list.counts.pending})` : ""}
              </Link>
            ))}
          </nav>
          <GalleryReview rows={list.rows} filter={filter} />
        </>
      )}
    </div>
  );
}
