import type { Metadata } from "next";
import Link from "next/link";
import GalleryBrowser from "@/components/jawad/gallery/GalleryBrowser";
import GalleryOpened from "@/components/jawad/gallery/GalleryOpened";
import Icon from "@/components/jawad/Icon";
import { jawadSession } from "@/lib/jawad/server/access";
import { listGallery } from "@/lib/jawad/server/gallery";
import { STUDIO_PATH } from "@config/jawad/gallery";

export const metadata: Metadata = {
  title: "معرض الناس",
  description: "صور وفيديوهات صنعها الناس في الجواد الذكي، مع البرومبت. اضغط «جرّبه» وينفتح لك الاستوديو بنفس الإعدادات.",
};
export const dynamic = "force-dynamic";

/** «معرض الناس»: open to everyone (no sign-in to look); «جرّبه» signs in first when needed, then opens the filled studio. */
export default async function GalleryPage() {
  const [{ user }, list] = await Promise.all([jawadSession(), listGallery().catch(() => ({ ready: false, items: [], more: false }))]);
  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 pb-16 pt-6">
      <GalleryOpened />
      <section className="jw-panel flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-semibold"><Icon name="image" size={20} className="text-jw-accent" /> معرض الناس</h1>
          <p className="text-sm text-jw-muted">أعمال صنعها الناس في الاستوديو الإبداعي، وكل عمل ببرومبته. اضغط «جرّبه» وينفتح الاستوديو بنفس المولّد والمقاس والستايل والبرومبت، وتضيف صورك أنت.</p>
        </div>
        <Link href={STUDIO_PATH} className="jw-btn jw-btn-primary"><Icon name="sparkles" size={16} /> افتح الاستوديو</Link>
      </section>
      {list.ready ? (
        <GalleryBrowser initial={list.items} initialMore={list.more} signedIn={Boolean(user)} />
      ) : (
        <p className="rounded-lg border border-jw-line bg-jw-surface-2 px-3 py-2 text-sm text-jw-muted" role="status">معرض الناس بيفتح قريب.</p>
      )}
    </div>
  );
}
