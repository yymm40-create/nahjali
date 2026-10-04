import Link from "next/link";
import type { AdSlot, AdView } from "@/lib/jawad/server/ads";
import AdVideo from "./AdVideo";
import Icon from "./Icon";

/**
 * Three unequal ads: the main one takes about two thirds of the width, the two small ones stack in the last third.
 * Each title sits UNDER its picture or video. On phones the main ad stays first and full width, the two small ones
 * share a row below it. Used on the home page (published ads) and on the admin page (draft preview).
 */
export default function AdsGrid({ ads, emptyHint }: { ads: Record<AdSlot, AdView | null>; emptyHint?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:grid-rows-2">
      <div className="col-span-2 lg:row-span-2">
        <AdCard ad={ads.main} big emptyHint={emptyHint} />
      </div>
      <div className="col-span-1">
        <AdCard ad={ads.side_top} emptyHint={emptyHint} />
      </div>
      <div className="col-span-1">
        <AdCard ad={ads.side_bottom} emptyHint={emptyHint} />
      </div>
    </div>
  );
}

function AdCard({ ad, big = false, emptyHint }: { ad: AdView | null; big?: boolean; emptyHint?: React.ReactNode }) {
  const mediaBox = `relative overflow-hidden rounded-[var(--jw-radius)] border border-jw-line bg-jw-surface ${big ? "aspect-video lg:aspect-auto lg:flex-1 lg:min-h-[300px]" : "aspect-video"}`;
  if (!ad) {
    return (
      <div className="flex h-full flex-col gap-2">
        <div className={`${mediaBox} grid place-items-center border-dashed`}>
          <span className="flex flex-col items-center gap-2 text-jw-faint">
            <Icon name="image" size={big ? 28 : 20} />
            {emptyHint}
          </span>
        </div>
        <span className="h-5" aria-hidden />
      </div>
    );
  }
  const media = ad.media ? (
    ad.media.type === "video" ? (
      <AdVideo src={ad.media.url} poster={ad.posterUrl} label={ad.title} />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={ad.media.url} alt={ad.title} className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" loading={big ? "eager" : "lazy"} />
    )
  ) : null;
  const body = (
    <>
      <div className={mediaBox}>{media}</div>
      <h2 className={`line-clamp-2 font-medium leading-snug ${big ? "text-base sm:text-lg" : "text-sm"}`} dir="auto">{ad.title}</h2>
    </>
  );
  const cls = "group flex h-full flex-col gap-2 rounded-[var(--jw-radius)]";
  if (!ad.href) return <div className={cls}>{body}</div>;
  return ad.external ? (
    <a href={ad.href} className={cls} target="_blank" rel="noopener noreferrer">{body}</a>
  ) : (
    <Link href={ad.href} className={cls}>{body}</Link>
  );
}
