"use client";

// «معرض الناس» inside the studio: an entry beside «جاهز بضغطة» with the newest approved works' pictures, opening the
// gallery in a window where «جرّبه» fills this studio's form in place. Hidden while the gallery is empty or its table
// (0112) has not been run.

import Link from "next/link";
import { useEffect, useState } from "react";
import { GALLERY_BASE, type GalleryCard } from "@config/jawad/gallery";
import { track } from "@/lib/feature-track";
import Dialog from "../Dialog";
import GalleryBrowser from "./GalleryBrowser";

export default function GalleryStrip({ signedIn, onTry }: { signedIn: boolean; onTry: (item: GalleryCard) => void }) {
  const [list, setList] = useState<{ items: GalleryCard[]; more: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/jawad/gallery", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { ready?: boolean; items?: GalleryCard[]; more?: boolean } | null) => {
        if (live && b?.ready && b.items?.length) setList({ items: b.items, more: Boolean(b.more) });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (!list) return null;
  const thumbs = list.items.filter((i) => i.kind === "image").slice(0, 3);
  return (
    <>
      <button type="button" className="flex w-full items-center gap-3 rounded-xl border border-jw-line bg-jw-surface-2 p-2 text-start hover:border-jw-accent" onClick={() => (track("studio.gallery_open"), setOpen(true))} aria-haspopup="dialog">
        <span className="flex shrink-0 -space-x-3 rtl:space-x-reverse" aria-hidden>
          {thumbs.length ? (
            thumbs.map((t) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={t.id} src={t.mediaUrl} alt="" loading="lazy" className="size-10 rounded-lg border-2 border-jw-surface-2 object-cover" />
            ))
          ) : (
            <span className="grid size-10 place-items-center rounded-lg bg-jw-accent-soft text-lg">🖼️</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-sm">معرض الناس</b>
          <span className="line-clamp-1 text-xs text-jw-muted">أعمال الناس ببرومبتاتها، اضغط «جرّبه» ويتعبّى النموذج</span>
        </span>
        <span className="text-xs text-jw-accent">افتح</span>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="🖼️ معرض الناس" wide>
        <div className="jw-scroll max-h-[78dvh] space-y-3 overflow-y-auto p-4">
          <GalleryBrowser
            initial={list.items}
            initialMore={list.more}
            signedIn={signedIn}
            compact
            onTry={(item) => {
              track("studio.gallery_try");
              onTry(item);
              setOpen(false);
            }}
          />
          <div className="flex justify-center">
            <Link href={GALLERY_BASE} className="jw-btn jw-btn-quiet text-xs">افتح المعرض كامل ←</Link>
          </div>
        </div>
      </Dialog>
    </>
  );
}
