import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { GalleryMedia } from "@/components/jawad/gallery/GalleryBrowser";
import Icon from "@/components/jawad/Icon";
import { jawadSession } from "@/lib/jawad/server/access";
import { sharedWork } from "@/lib/jawad/server/gallery";
import { GALLERY_BASE, shapeOf, tryHref, tryLoginHref } from "@config/jawad/gallery";

export const dynamic = "force-dynamic";

const work = cache((slug: string) => sharedWork(slug).catch(() => null));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const item = await work((await params).slug);
  if (!item) return { title: "الرابط غير متاح", robots: { index: false } };
  const title = item.title || (item.kind === "video" ? "فيديو من الجواد الذكي" : "صورة من الجواد الذكي");
  return {
    title,
    description: "صُنع في الاستوديو الإبداعي في الجواد الذكي. جرّب نفس الإعدادات بنفسك.",
    // a personal link: never listed by search engines
    robots: { index: false, follow: false },
    openGraph: item.kind === "image" ? { title, images: [{ url: item.mediaUrl }] } : { title },
  };
}

/** A person's own work behind its permanent link (its owner turns it off from «أعمالي»; the site's owner can hide it). */
export default async function SharedWork({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [item, { user }] = await Promise.all([work(slug), jawadSession()]);
  if (!item) notFound();
  const shape = shapeOf(item.settings);
  const canTry = item.prompt.trim().length > 0;
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-16 pt-6">
      <article className="jw-panel overflow-hidden">
        <GalleryMedia item={item} />
        <div className="space-y-3 p-4">
          <h1 className="text-lg font-semibold leading-snug" dir="auto">{item.title || (item.kind === "video" ? "فيديو من الجواد الذكي" : "صورة من الجواد الذكي")}</h1>
          <div className="flex flex-wrap gap-1">
            <span className="jw-chip" dir="ltr">{item.generatorName}</span>
            {shape && <span className="jw-chip" dir="ltr">{shape}</span>}
          </div>
          <p className="text-sm text-jw-muted">صُنع في «الاستوديو الإبداعي» في الجواد الذكي.{canTry ? " اضغط «جرّبه في الجواد» وينفتح لك الاستوديو بنفس المولّد والمقاس والبرومبت، وتضيف صورك أنت." : ""}</p>
          <div className="flex flex-wrap gap-2">
            {canTry && (
              <Link href={user ? tryHref(item.id) : tryLoginHref(item.id)} className="jw-btn jw-btn-primary">
                <Icon name="sparkles" size={16} /> جرّبه في الجواد
              </Link>
            )}
            <Link href={GALLERY_BASE} className="jw-btn"><Icon name="grid" size={16} /> معرض الناس</Link>
          </div>
        </div>
      </article>
    </div>
  );
}
